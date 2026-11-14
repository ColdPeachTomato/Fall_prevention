// 同梱する正面・後ろ向きのアニメを、付録「アニメ確認チェックリスト」のうち計算で確かめられる項目と、
// 付録「動きの仕様」で検査する。新しいアニメを登録すると、自動で共通の検査の対象になる。

import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import { BODY, FRONT_CHANNELS, FRONT_VECTORS } from './bodyModel';
import { faceShift, HAND_HIDDEN_MAX, handBite, handCover, NEAR_SHADE, shadeByDepth, thighInset } from './drawFront';
import { computeFrontFrame, frontFootContact, type FrontFrame } from './frontRig';
import { ANIMATIONS, getAnimation } from './registry';
import type { Vec } from './sideRig';
import type { BodySide, FrontAnimation, FrontChairProp, SupportStage } from './types';
import { validateAnimation } from './validate';

const STEP = 0.02; // 検査する時刻の間隔（秒）
const SIDES: BodySide[] = ['r', 'l'];

// 止まらずに回し続ける種目（1周を1回と数える）。動きの区切りや、数える時点で止まることは求めない
const CIRCLING = ['W1-front-L1', 'W2-front-L1', 'W1-front-L2'];

// 運動そのものとして動かす足（体を支えていない足）。床をかすめて動き出すので、滑りの検査から外す。
// 支える足が動かないことは、下の種目別の検査で確かめる
const EXERCISING_FOOT: Record<string, BodySide[]> = {
  'S6-front-L2': ['r'], // 横へ上げる側の足
  'D1-front-L3': ['r'], // 前・横・後ろの床に触れる側の足
  'D3-front-L2': ['r', 'l'], // 横歩き：出す足と寄せる足を、交互に小さく浮かせて動かす
};

// 歩く種目。片足を浮かせている間は、次に足を着く所へ体を運んでいる途中なので、
// 「重心が支えの範囲の中」は両足が床についているコマで確かめ、浮かせている間は種目別の検査で確かめる
const STEPPING = ['D3-front-L2'];
const bothFeetDown = (f: FrontFrame) => frontFootContact(f.sk.r) !== null && frontFootContact(f.sk.l) !== null;

// その種目で使える支えの段階（多い順）。つかまらない種目は null だけ
const STAGES: SupportStage[] = ['both', 'one', 'fingertip', 'none'];
function stagesFor(anim: FrontAnimation): (SupportStage | null)[] {
  if (!anim.support) return [null];
  const min = getExercise(anim.exercise).minSupport ?? 'none';
  return STAGES.slice(0, STAGES.indexOf(min) + 1);
}
function minStage(anim: FrontAnimation): SupportStage | null {
  const stages = stagesFor(anim);
  return stages[stages.length - 1]!;
}
const isStatic = (anim: FrontAnimation) => getExercise(anim.exercise).unit === 'seconds';
// その段階のときに描く支持物
const shownProps = (anim: FrontAnimation, stage: SupportStage | null) =>
  anim.props.filter((p) => p.type !== 'band' && (p.showFor === undefined || p.showFor.includes(stage ?? 'none')));

const FRONT = ANIMATIONS.filter((a): a is FrontAnimation => a.view !== 'side');

function frontAnim(id: string): FrontAnimation {
  const anim = getAnimation(id);
  if (!anim || anim.view === 'side') throw new Error(`正面・後ろ向きのアニメがありません：${id}`);
  return anim;
}

function framesOf(anim: FrontAnimation, stage: SupportStage | null = minStage(anim)): FrontFrame[] {
  const count = Math.round(anim.cycleSeconds / STEP);
  return Array.from({ length: count + 1 }, (_, i) => computeFrontFrame(anim, Math.min(anim.cycleSeconds, i * STEP), stage));
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const at = (f: FrontFrame) => `t=${f.t.toFixed(2)}`;

function points(f: FrontFrame): Vec[] {
  const list: Vec[] = [f.sk.head, f.sk.chest];
  for (const s of SIDES) list.push(f.sk[s].elbow, f.sk[s].hand, f.sk[s].knee, f.sk[s].ankle, f.sk[s].toe);
  return list;
}

// 体の主な点のうち、いちばん速く動いている点の速さ（身長/秒）
function speedBetween(a: FrontFrame, b: FrontFrame): number {
  const pa = points(a);
  const pb = points(b);
  return Math.max(...pa.map((p, i) => dist(p, pb[i]!) / STEP));
}

// 動いている時間帯（止まっている所で区切る）
function movingPhases(frames: FrontFrame[]): { from: number; to: number }[] {
  const MOVING = 0.004;
  const PAUSE = 0.15;
  const phases: { from: number; to: number }[] = [];
  let start: number | null = null;
  let lastMoving = 0;
  for (let i = 1; i < frames.length; i++) {
    const t = frames[i]!.t;
    if (speedBetween(frames[i - 1]!, frames[i]!) > MOVING) {
      if (start === null) start = frames[i - 1]!.t;
      lastMoving = t;
    } else if (start !== null && t - lastMoving > PAUSE) {
      phases.push({ from: start, to: lastMoving });
      start = null;
    }
  }
  if (start !== null) phases.push({ from: start, to: lastMoving });
  return phases;
}

// 点 p が、中心 c のまわりを何周したか（正：画面で時計回り）
function turnsAround(path: Vec[], c: Vec): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a0 = Math.atan2(path[i - 1]!.x - c.x, path[i - 1]!.y - c.y);
    const a1 = Math.atan2(path[i]!.x - c.x, path[i]!.y - c.y);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
  }
  return total / (2 * Math.PI);
}

const center = (path: Vec[]): Vec => ({
  x: (Math.min(...path.map((p) => p.x)) + Math.max(...path.map((p) => p.x))) / 2,
  y: (Math.min(...path.map((p) => p.y)) + Math.max(...path.map((p) => p.y))) / 2,
});

describe('正面・後ろ向きのアニメの登録', () => {
  it('座位の4種目（レベル1）と、立位の7種目（レベル2・3）がある', () => {
    const list = (mode: string) => FRONT.filter((a) => a.root.mode === mode).map((a) => `${a.id}:${a.view}`).sort();
    expect(list('seat')).toEqual(['S8-back-L1:back', 'W1-front-L1:front', 'W2-front-L1:front', 'W3-front-L1:front']);
    expect(list('stand')).toEqual([
      'B1-front-L2:front',
      'B4-front-L3:front',
      'D1-front-L3:front',
      'D3-front-L2:front',
      'S6-front-L2:front',
      'S8-back-L2:back',
      'W1-front-L2:front',
    ]);
  });

  it('値の範囲や、見かけの長さが実際の長さを超えるデータは、検証で拒否する', () => {
    const base = JSON.parse(JSON.stringify(frontAnim('W3-front-L1'))) as FrontAnimation;
    const withPose = (pose: Record<string, number>) => ({ ...base, keyframes: base.keyframes.map((k, i) => (i === 0 ? { ...k, pose: { ...k.pose, ...pose } } : k)) });
    expect(validateAnimation(base).ok).toBe(true);
    expect(validateAnimation(withPose({ turn: 60 })).ok).toBe(false); // 回旋の可動域を超える
    expect(validateAnimation(withPose({ rElbowOut: 0.9, rElbowUp: 0.9 })).ok).toBe(false); // 腕が伸びて見える
    expect(validateAnimation(withPose({ rWristOut: 0 })).ok).toBe(false); // 知らない項目
    expect(validateAnimation({ ...base, root: { mode: 'foot', x: 0, y: 0 } }).ok).toBe(false);
    expect(validateAnimation({ ...base, support: { hand: 'x', front: { x: 0, half: 0.1, y: 0.5 } } }).ok).toBe(false);
    expect(validateAnimation({ ...base, viewBox: undefined }).ok).toBe(false);
  });
});

describe.each(FRONT.map((a) => [a.id, a] as const))('%s', (_id, anim) => {
  const frames = framesOf(anim);
  const chair = anim.props.find((p): p is FrontChairProp => p.type === 'chair');
  const circling = CIRCLING.includes(anim.id);
  const seated = anim.root.mode === 'seat';

  it('B：重心が常に支える面（足と座面）の上にある（つかまらなくても倒れない）', () => {
    for (const f of frames) {
      if (STEPPING.includes(anim.id) && !bothFeetDown(f)) continue;
      expect(f.stable, `${at(f)} 重心 ${f.com.x.toFixed(3)} 範囲 ${f.support.min.toFixed(3)}〜${f.support.max.toFixed(3)}`).toBe(true);
    }
  });

  it('B：支えている足が滑らず、浮かない', () => {
    const exercising = EXERCISING_FOOT[anim.id] ?? [];
    for (const side of SIDES) {
      const plant = anim.plants?.[side];
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i]!;
        const limb = f.sk[side];
        // 足が床にめり込まない
        expect(limb.heel.y, at(f)).toBeGreaterThan(-0.004);
        expect(limb.toe.y, at(f)).toBeGreaterThan(-0.004);
        if (plant) {
          // かかとを床に付ける指定がある足：かかとは動かず、つま先だけが動く
          expect(limb.heel.x, at(f)).toBeCloseTo(plant.x, 9);
          expect(limb.heel.y, at(f)).toBeCloseTo(0, 9);
          // すねの見かけの長さは、実際の長さを超えない（短く見える分は、足を前に出しているため）
          const shank = dist(limb.knee, limb.ankle);
          expect(shank, at(f)).toBeLessThanOrEqual(BODY.shank + 0.001);
          expect(shank, at(f)).toBeGreaterThan(BODY.shank * 0.9);
        } else if (i > 0 && !exercising.includes(side)) {
          // 床についている足は、ついている間は滑らない
          const before = frames[i - 1]!.sk[side];
          if (frontFootContact(before) && frontFootContact(limb)) expect(Math.abs(limb.heel.x - before.heel.x), at(f)).toBeLessThan(0.001);
        }
      }
    }
    // どのコマでも、少なくとも片方の足が床についている
    for (const f of frames) expect(frontFootContact(f.sk.r) ?? frontFootContact(f.sk.l), at(f)).not.toBeNull();
  });

  it('B：値が範囲を超えず、手足の見かけの長さが実際の長さを超えない', () => {
    for (const f of frames) {
      for (const c of FRONT_CHANNELS) {
        expect(f.pose[c.name], `${c.name} ${at(f)}`).toBeGreaterThanOrEqual(c.min - 1e-9);
        expect(f.pose[c.name], `${c.name} ${at(f)}`).toBeLessThanOrEqual(c.max + 1e-9);
      }
      for (const [out, up] of FRONT_VECTORS) {
        expect(Math.hypot(f.pose[out], f.pose[up]), `${out} ${at(f)}`).toBeLessThanOrEqual(1.0005);
      }
    }
  });

  it('A：座っている間は、お尻が座面の上にあり、椅子の幅に収まる', () => {
    if (!seated) {
      // 立って行う種目：座面を支えに数えない
      for (const f of frames) expect(f.onSeat, at(f)).toBe(false);
      return;
    }
    expect(chair).toBeDefined();
    if (!chair) return;
    for (const f of frames) {
      expect(f.onSeat, at(f)).toBe(true);
      expect(f.sk.pelvis.y - chair.seatHeight, at(f)).toBeGreaterThan(0.04);
      expect(f.sk.pelvis.y - chair.seatHeight, at(f)).toBeLessThan(0.07);
      expect(Math.abs(f.sk.pelvis.x - chair.x)).toBeLessThan(0.01);
    }
  });

  it('A：背筋を伸ばしている（体幹を横に傾けない）', () => {
    for (const f of frames) {
      expect(Math.abs(f.sk.head.x - f.sk.pelvis.x), at(f)).toBeLessThan(0.005);
      expect(Math.abs(f.sk.r.shoulder.y - f.sk.l.shoulder.y), at(f)).toBeLessThan(1e-9);
    }
  });

  it('A：反動がなく、ゆっくり動く（速さと、速さの変化に上限がある）', () => {
    let prevSpeed = circling ? speedBetween(frames[frames.length - 2]!, frames[frames.length - 1]!) : 0;
    for (let i = 1; i < frames.length; i++) {
      const speed = speedBetween(frames[i - 1]!, frames[i]!);
      expect(speed, at(frames[i]!)).toBeLessThan(0.42);
      expect(Math.abs(speed - prevSpeed), at(frames[i]!)).toBeLessThan(0.05);
      prevSpeed = speed;
    }
  });

  it('A：動きのひと区切りが 2〜3 秒（回し続ける種目は、1周が 3〜4 秒で、止まらずに回る）', () => {
    if (circling) {
      expect(anim.cycleSeconds).toBeGreaterThanOrEqual(3);
      expect(anim.cycleSeconds).toBeLessThanOrEqual(4);
      for (let i = 1; i < frames.length; i++) expect(speedBetween(frames[i - 1]!, frames[i]!), at(frames[i]!)).toBeGreaterThan(0.01);
      return;
    }
    const phases = movingPhases(frames);
    if (isStatic(anim)) {
      // 姿勢を保つ種目は動かない（残りの秒数は画面に出す）
      expect(phases).toHaveLength(0);
      return;
    }
    expect(phases.length).toBeGreaterThanOrEqual(2);
    for (const p of phases) {
      expect(p.to - p.from, `${p.from.toFixed(2)}〜${p.to.toFixed(2)}`).toBeGreaterThanOrEqual(1.85);
      expect(p.to - p.from, `${p.from.toFixed(2)}〜${p.to.toFixed(2)}`).toBeLessThanOrEqual(3.05);
    }
  });

  it('A：1往復の終わりが最初の姿勢に戻る（回数のカウントと合う）', () => {
    const start = frames[0]!;
    const end = frames[frames.length - 1]!;
    for (const c of FRONT_CHANNELS) expect(end.pose[c.name], c.name).toBeCloseTo(start.pose[c.name], 6);
  });

  it('A：回数を数える時点では、動きが止まっている（回し続ける種目は、1周の終わりで数える）', () => {
    const counts = anim.countsPerCycle ?? 1;
    if (circling) {
      expect(counts).toBe(1);
      return;
    }
    for (let k = 1; k <= counts; k++) {
      const t = (anim.cycleSeconds * k) / counts;
      const speed = speedBetween(computeFrontFrame(anim, t - STEP), computeFrontFrame(anim, t));
      expect(speed, `t=${t.toFixed(2)}`).toBeLessThan(0.004);
    }
  });

  it('C：支持物（椅子・カウンター）を、どの支えの段階でも描き、常に画面内にある（S-10）', () => {
    for (const stage of stagesFor(anim)) {
      const props = shownProps(anim, stage);
      expect(props.length, String(stage)).toBeGreaterThan(0);
      for (const p of props) {
        if (p.type === 'band') continue;
        expect(p.x - p.width / 2, String(stage)).toBeGreaterThan(anim.viewBox.minX);
        expect(p.x + p.width / 2, String(stage)).toBeLessThan(anim.viewBox.maxX);
        expect(p.type === 'chair' ? p.backHeight : p.height).toBeLessThan(anim.viewBox.maxY);
      }
    }
  });

  it('C：支えの段階（両手・片手・指先・なし）どおりにつかまり、手が支持物に触れている（S-10）', () => {
    const support = anim.support;
    if (!support) return;
    for (const stage of stagesFor(anim)) {
      for (const f of framesOf(anim, stage)) {
        const where = `${stage} ${at(f)}`;
        if (!STEPPING.includes(anim.id) || bothFeetDown(f)) expect(f.stable, where).toBe(true);
        for (const side of SIDES) {
          const limb = f.sk[side];
          const holds = stage === 'both' || ((stage === 'one' || stage === 'fingertip') && side === support.hand);
          expect(limb.holding, `${where} ${side}`).toBe(holds);
          if (!holds) continue;
          expect(limb.handTarget).toBeDefined();
          expect(dist(limb.hand, limb.handTarget!), where).toBeLessThan(1e-9);
          // 手を置く点は、支持物の上（指先のときは少し上）
          const lift = stage === 'fingertip' ? 0.022 : 0;
          const top = stage !== 'both' && support.side ? support.side.y : support.front.y;
          expect(limb.hand.y, where).toBeCloseTo(top + lift, 9);
          // 腕の見かけの長さは、実際の長さを超えない（無理なく届く）
          expect(dist(limb.shoulder, limb.elbow), where).toBeLessThanOrEqual(BODY.upperArm + 1e-6);
          expect(dist(limb.elbow, limb.hand), where).toBeLessThanOrEqual(BODY.forearm + BODY.palm + 1e-6);
          expect(dist(limb.shoulder, limb.hand), where).toBeLessThan(BODY.upperArm + BODY.forearm + BODY.palm - 0.005);
        }
      }
      // 手を置く点の高さに、その段階で描く支持物の上の面がある
      const tops = shownProps(anim, stage).map((p) => (p.type === 'chair' ? p.backHeight : p.type === 'counter' ? p.height : 0));
      const y = stage !== 'both' && support.side ? support.side.y : support.front.y;
      expect(tops, String(stage)).toContain(y);
    }
  });

  it('C：下半身の動きは、支えの段階によらず同じ', () => {
    if (!anim.support) return;
    const stages = stagesFor(anim);
    const reference = framesOf(anim, stages[0]!);
    for (const stage of stages.slice(1)) {
      framesOf(anim, stage).forEach((f, i) => {
        expect(dist(f.sk.head, reference[i]!.sk.head)).toBeLessThan(1e-9);
        for (const side of SIDES) {
          for (const key of ['hip', 'knee', 'ankle', 'heel', 'toe'] as const) {
            expect(dist(f.sk[side][key], reference[i]!.sk[side][key]), `${stage} ${side}.${key} ${at(f)}`).toBeLessThan(1e-9);
          }
        }
      });
    }
  });

  it('E：人物の全身と足元が画面からはみ出さない', () => {
    for (const f of frames) {
      const xs = [f.sk.head.x - 0.06, f.sk.head.x + 0.06];
      const ys = [f.sk.head.y + 0.075];
      for (const s of SIDES) {
        const limb = f.sk[s];
        for (const p of [limb.elbow, limb.hand, limb.knee, limb.ankle, limb.heel, limb.toe]) {
          xs.push(p.x - 0.04, p.x + 0.04);
          ys.push(p.y + 0.04);
        }
      }
      expect(Math.max(...xs), at(f)).toBeLessThan(anim.viewBox.maxX);
      expect(Math.min(...xs), at(f)).toBeGreaterThan(anim.viewBox.minX);
      expect(Math.max(...ys), at(f)).toBeLessThan(anim.viewBox.maxY);
    }
    expect(anim.viewBox.minY).toBeLessThan(0);
  });

  it('E：画面の縦横の比が、縦画面に収まる形になっている', () => {
    const aspect = (anim.viewBox.maxX - anim.viewBox.minX) / (anim.viewBox.maxY - anim.viewBox.minY);
    expect(aspect).toBeGreaterThan(0.6);
    expect(aspect).toBeLessThan(1.05);
  });

  it('D：字幕が1往復のすべての時間をすき間なく覆う（逆向きの字幕も）', () => {
    for (const captions of [anim.captions, anim.reverseCaptions]) {
      if (!captions) continue;
      const sorted = [...captions].sort((a, b) => a.from - b.from);
      expect(sorted[0]?.from).toBe(0);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.from).toBeCloseTo(sorted[i - 1]!.to, 9);
      expect(sorted[sorted.length - 1]?.to).toBe(anim.cycleSeconds);
    }
  });

  it('D：注意点の印（矢印や線）がある。動かしている部位を目立たせている', () => {
    expect(anim.marks.length).toBeGreaterThan(0);
    expect(anim.highlight.length).toBeGreaterThan(0);
  });
});

describe('W1 足首回し（動きの仕様との照合）', () => {
  const anim = frontAnim('W1-front-L1');
  const frames = framesOf(anim);

  it('椅子に座り、片足（右）を少し前に出して、かかとを床につけたままにする', () => {
    expect(anim.plants?.r).toBeDefined();
    expect(anim.plants?.l).toBeUndefined();
    for (const f of frames) {
      expect(f.sk.r.heel.y).toBeCloseTo(0, 9);
      // 足を前に出しているので、すねは少し短く見える
      expect(dist(f.sk.r.knee, f.sk.r.ankle), at(f)).toBeLessThan(BODY.shank);
    }
  });

  it('つま先で円を描く（1往復で1周。1周を1回と数える）', () => {
    const path = frames.map((f) => f.sk.r.toe);
    expect(Math.abs(turnsAround(path, center(path)))).toBeCloseTo(1, 3);
    expect(anim.countsPerCycle ?? 1).toBe(1);
    const width = Math.max(...path.map((p) => p.x)) - Math.min(...path.map((p) => p.x));
    const height = Math.max(...path.map((p) => p.y)) - Math.min(...path.map((p) => p.y));
    expect(width).toBeGreaterThan(0.06); // 身長160cmで横に約10cm以上
    expect(height).toBeGreaterThan(0.04);
    expect(Math.min(...path.map((p) => p.y))).toBeGreaterThanOrEqual(0); // つま先は床にめり込まない
  });

  it('そのまま再生すると外回し（上を通るとき、つま先が体の外へ向かう）。逆向きの再生が内回し', () => {
    const top = frames.reduce((a, b) => (b.sk.r.toe.y > a.sk.r.toe.y ? b : a));
    const after = computeFrontFrame(anim, top.t + 0.1);
    const outward = (after.sk.r.toe.x - top.sk.r.toe.x) * top.sk.r.sign;
    expect(outward).toBeGreaterThan(0);
    expect(anim.captions[0]?.text).toContain('外');
    expect(anim.reverseCaptions?.[0]?.text).toContain('内');
  });

  it('反対の足、膝、上半身は動かさず、手は座面の横を持つ', () => {
    const first = frames[0]!;
    for (const f of frames) {
      expect(dist(f.sk.l.toe, first.sk.l.toe)).toBeLessThan(1e-9);
      expect(dist(f.sk.r.knee, first.sk.r.knee)).toBeLessThan(1e-9);
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      for (const s of SIDES) {
        expect(dist(f.sk[s].hand, first.sk[s].hand)).toBeLessThan(1e-9);
        expect(Math.abs(f.sk[s].hand.y - 0.257)).toBeLessThan(0.005);
        expect(Math.abs(Math.abs(f.sk[s].hand.x) - 0.165)).toBeLessThan(0.005);
      }
    }
  });
});

describe('W2 腕回し（動きの仕様との照合）', () => {
  const anim = frontAnim('W2-front-L1');
  const frames = framesOf(anim);

  it('指先を肩に置いたまま、両肘で同時に（左右対称に）円を描く', () => {
    for (const f of frames) {
      for (const s of SIDES) expect(dist(f.sk[s].hand, f.sk[s].shoulder), at(f)).toBeLessThan(0.08);
      expect(f.sk.r.elbow.x, at(f)).toBeCloseTo(-f.sk.l.elbow.x, 9);
      expect(f.sk.r.elbow.y, at(f)).toBeCloseTo(f.sk.l.elbow.y, 9);
    }
    const path = frames.map((f) => f.sk.r.elbow);
    expect(Math.abs(turnsAround(path, center(path)))).toBeCloseTo(1, 3);
  });

  it('そのまま再生すると、前→上→後ろ→下の順（後ろ回し）。逆向きの再生が前回し', () => {
    const q = anim.cycleSeconds / 4;
    const rel = (t: number) => {
      const f = computeFrontFrame(anim, t);
      return { out: (f.sk.r.elbow.x - f.sk.r.shoulder.x) * f.sk.r.sign, up: f.sk.r.elbow.y - f.sk.r.shoulder.y };
    };
    const [down, forward, up, back] = [rel(0), rel(q), rel(2 * q), rel(3 * q)];
    expect(down.up).toBeLessThan(-0.17); // 肘は体の横に下りている
    expect(Math.hypot(forward.out, forward.up)).toBeLessThan(BODY.upperArm * 0.35); // 前に向けた腕は短く見える
    expect(up.up).toBeGreaterThan(0.14);
    expect(back.out).toBeGreaterThan(0.14); // 後ろでは肘が外へ開く
    expect(Math.abs(back.up)).toBeLessThan(0.03);
    expect(anim.captions[0]?.text).toContain('前から上、後ろ');
    expect(anim.reverseCaptions?.[0]?.text).toContain('後ろから上、前');
  });

  it('肩と、肩に置いた手も、肘と同じ向きに一緒に動く（回す向きが分かるように）', () => {
    const shoulders = frames.map((f) => f.sk.r.shoulder);
    const hands = frames.map((f) => f.sk.r.hand);
    const elbows = frames.map((f) => f.sk.r.elbow);
    const rangeY = (path: Vec[]) => Math.max(...path.map((p) => p.y)) - Math.min(...path.map((p) => p.y));
    expect(rangeY(shoulders)).toBeGreaterThan(0.04); // 肩が上下に動く（身長160cmで約7cm）
    expect(rangeY(hands)).toBeGreaterThan(0.1); // 手は、肩の動きに自分の動きが加わって、さらに大きく動く
    // 肩も手も、肘と同じ向きに1周する
    const direction = Math.sign(turnsAround(elbows, center(elbows)));
    expect(turnsAround(shoulders, center(shoulders)) * direction).toBeCloseTo(1, 3);
    expect(turnsAround(hands, center(hands)) * direction).toBeCloseTo(1, 3);
    // 肘が上のとき肩も上がり、肘が下のとき肩も下がる
    const top = frames.reduce((a, b) => (b.sk.r.elbow.y > a.sk.r.elbow.y ? b : a));
    const bottom = frames.reduce((a, b) => (b.sk.r.elbow.y < a.sk.r.elbow.y ? b : a));
    expect(top.sk.r.shoulder.y).toBeGreaterThan(bottom.sk.r.shoulder.y + 0.04);
  });

  it('肘が前に来ると腕を少し濃く描き、腕が手に少し重なる。手は消えない（回す向きが分かるように）', () => {
    const q = anim.cycleSeconds / 4;
    const depth = (t: number) => computeFrontFrame(anim, t).pose.rElbowDepth;
    expect(depth(q)).toBeGreaterThan(0.9); // 前
    expect(depth(3 * q)).toBeLessThan(-0.7); // 後ろ
    expect(Math.abs(depth(0))).toBeLessThan(0.05); // 下
    expect(Math.abs(depth(2 * q))).toBeLessThan(0.05); // 上
    for (const f of frames) expect(f.pose.lElbowDepth).toBeCloseTo(f.pose.rElbowDepth, 9); // 左右同じ
    for (const f of frames) expect(f.pose.rHandDepth).toBe(0); // 手は肩に置いたまま
    // 腕は、肘が前に来るにつれてなめらかに手に重なり、前を過ぎると離れる
    expect(handCover(depth(q))).toBe(1);
    expect(handCover(depth(0))).toBeLessThan(0.05);
    expect(handCover(depth(3 * q))).toBe(0);
    const covers = frames.filter((f) => f.t >= 0 && f.t <= q).map((f) => handCover(f.pose.rElbowDepth));
    for (let i = 1; i < covers.length; i++) {
      expect(covers[i]!).toBeGreaterThanOrEqual(covers[i - 1]! - 1e-9);
      expect(covers[i]! - covers[i - 1]!).toBeLessThan(0.08); // 急に切り替わらない
    }
    // 手は消えない：いちばん重なったときでも、隠れるのは手の直径の3割まで。隠れるのは肘のある側
    expect(HAND_HIDDEN_MAX).toBeLessThanOrEqual(0.3);
    for (const f of frames) {
      for (const limb of [f.sk.r, f.sk.l]) {
        const cover = handCover(f.pose.rElbowDepth);
        const bite = handBite(limb, cover);
        if (cover === 0) {
          expect(bite, at(f)).toBeNull();
          continue;
        }
        // 手の中心から、隠す円のふちまでの距離（手の半径 0.025 のうち、残る分）
        const gap = Math.hypot(bite!.x - limb.hand.x, bite!.y - limb.hand.y) - bite!.r;
        expect(gap, at(f)).toBeGreaterThanOrEqual(0.025 * (1 - 2 * HAND_HIDDEN_MAX) - 1e-9);
        expect(gap, at(f)).toBeLessThanOrEqual(0.025 + 1e-9);
        // 隠す円は、手から見て肘の側にある
        const toElbow = { x: limb.elbow.x - limb.hand.x, y: limb.elbow.y - limb.hand.y };
        const toBite = { x: bite!.x - limb.hand.x, y: bite!.y - limb.hand.y };
        if (Math.hypot(toElbow.x, toElbow.y) > 0.03) expect(toElbow.x * toBite.x + toElbow.y * toBite.y, at(f)).toBeGreaterThan(0);
      }
    }
  });

  it('大きな円を描く（肘が、肩より上にも外にも大きく動く）', () => {
    const path = frames.map((f) => f.sk.r.elbow);
    expect(Math.max(...path.map((p) => p.y)) - Math.min(...path.map((p) => p.y))).toBeGreaterThan(0.3);
  });

  it('体幹と脚は動かさない', () => {
    const first = frames[0]!;
    for (const f of frames) {
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      for (const s of SIDES) expect(dist(f.sk[s].toe, first.sk[s].toe)).toBeLessThan(1e-9);
    }
  });
});

describe('前後の見せ方（正面・後ろ向きで共通）', () => {
  const sum = (rgb: string) => rgb.match(/\d+/g)!.map(Number).reduce((a, b) => a + b, 0);
  const BASE = '#e8743b';

  it('手前にある所は少しだけ濃く、奥にある所は元の色のまま', () => {
    expect(shadeByDepth(BASE, 0)).toBe('rgb(232, 116, 59)');
    expect(shadeByDepth(BASE, -1)).toBe(shadeByDepth(BASE, 0)); // 奥は薄くしない
    expect(sum(shadeByDepth(BASE, 1))).toBeLessThan(sum(shadeByDepth(BASE, 0)));
    expect(sum(shadeByDepth(BASE, 0.5))).toBeLessThan(sum(shadeByDepth(BASE, 0)));
    expect(sum(shadeByDepth(BASE, 0.5))).toBeGreaterThan(sum(shadeByDepth(BASE, 1)));
    // 「少しだけ」：いちばん手前でも、元の色の8割より暗くしない
    expect(NEAR_SHADE).toBeLessThanOrEqual(0.2);
    expect(sum(shadeByDepth(BASE, 1))).toBeGreaterThanOrEqual(sum(shadeByDepth(BASE, 0)) * 0.79);
  });

  it('腕の前後を持つのは、腕が前後に動く種目だけ（W2：肘を回す、W3：腕をこちらへ伸ばす）', () => {
    for (const other of FRONT) {
      if (other.exercise === 'W2' || other.exercise === 'W3') continue;
      for (const k of other.keyframes) {
        for (const key of ['rElbowDepth', 'lElbowDepth', 'rHandDepth', 'lHandDepth'] as const) expect(k.pose[key] ?? 0, other.id).toBe(0);
      }
    }
  });

  it('W3：こちらへ伸ばした腕は、手がいちばん手前。腕が手に重なることはない', () => {
    const anim = frontAnim('W3-front-L1');
    for (const f of framesOf(anim)) {
      for (const side of ['r', 'l'] as const) {
        const elbow = f.pose[`${side}ElbowDepth`];
        const hand = f.pose[`${side}HandDepth`];
        expect(hand).toBeGreaterThan(0.45); // ひねった側の反対の腕は、肩が後ろへ引かれる分だけ奥になる
        expect(hand).toBeLessThanOrEqual(1);
        expect(elbow).toBeCloseTo(hand / 2, 2);
        expect(handCover(elbow - hand)).toBe(0);
      }
    }
  });

  it('立って内へ傾いた脚だけ、付け根を少し内側に寄せて描く。確認済みのアニメの見え方は変えない', () => {
    expect(thighInset(0)).toBe(0);
    expect(thighInset(0.5)).toBe(0); // 外へ上げた脚は寄せない
    expect(thighInset(-0.06)).toBe(0);
    expect(thighInset(-1)).toBeLessThanOrEqual(0.018); // 「ほんの少し」（身長160cmで3cmまで）
    const s6 = frontAnim('S6-front-L2');
    for (const f of framesOf(s6)) {
      expect(thighInset(f.pose.lKneeOut)).toBeGreaterThan(0.01); // 支える脚（左）
      expect(thighInset(f.pose.rKneeOut)).toBeLessThan(0.006); // 上げる脚（右）は、ほぼそのまま
    }
    for (const done of FRONT.filter((a) => a.checked === true && a.root.mode === 'stand')) {
      for (const f of framesOf(done)) {
        expect(thighInset(f.pose.rKneeOut), done.id).toBe(0);
        expect(thighInset(f.pose.lKneeOut), done.id).toBe(0);
      }
    }
  });
});

describe('W3 腕を上げて体をひねる（動きの仕様との照合）', () => {
  const anim = frontAnim('W3-front-L1');
  const frames = framesOf(anim);
  const half = anim.cycleSeconds / 2;

  it('両腕を肩の高さで前に伸ばし、手のひらを合わせたまま動く', () => {
    for (const f of frames) {
      expect(dist(f.sk.r.hand, f.sk.l.hand), at(f)).toBeLessThan(0.006);
      for (const s of SIDES) {
        expect(f.sk[s].hand.y, at(f)).toBeCloseTo(f.sk[s].shoulder.y, 9);
        expect(f.sk[s].elbow.y, at(f)).toBeCloseTo(f.sk[s].shoulder.y, 9);
      }
    }
    // 正面を向いているとき、手は体の中央にある
    expect(Math.abs(frames[0]!.sk.r.hand.x)).toBeLessThan(0.002);
  });

  it('右へ約45度（40度）ひねって戻し、次に左へひねる。片側1回ずつ数える', () => {
    expect(anim.countsPerCycle).toBe(2);
    const first = frames.filter((f) => f.t < half);
    const second = frames.filter((f) => f.t >= half);
    expect(Math.max(...first.map((f) => f.pose.turn))).toBeCloseTo(40, 6);
    expect(Math.min(...first.map((f) => f.pose.turn))).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.min(...second.map((f) => f.pose.turn))).toBeCloseTo(-40, 6);
    expect(Math.max(...second.map((f) => f.pose.turn))).toBeLessThanOrEqual(1e-9);
    expect(computeFrontFrame(anim, half).pose.turn).toBeCloseTo(0, 6);
  });

  it('胸と腕を一緒にひねる（手は、ひねった側へ動く。肩の幅は狭く見える）', () => {
    const right = frames.reduce((a, b) => (b.pose.turn > a.pose.turn ? b : a));
    const left = frames.reduce((a, b) => (b.pose.turn < a.pose.turn ? b : a));
    // 正面は鏡のように描くので、右へひねると手は画面の右へ動く
    expect(right.sk.r.hand.x * right.sk.r.sign).toBeGreaterThan(0.2);
    expect(left.sk.l.hand.x * left.sk.l.sign).toBeGreaterThan(0.2);
    expect(right.sk.r.hand.x).toBeCloseTo(-left.sk.r.hand.x, 3);
    const width = (f: FrontFrame) => Math.abs(f.sk.r.shoulder.x - f.sk.l.shoulder.x);
    expect(width(right)).toBeLessThan(width(frames[0]!) * 0.8);
  });

  it('頭も少し同じ向きを向き、鼻・前髪は向いた側へ、後ろ髪の裾は反対の側へ動く', () => {
    const right = frames.reduce((x, y) => (y.pose.turn > x.pose.turn ? y : x));
    const left = frames.reduce((x, y) => (y.pose.turn < x.pose.turn ? y : x));
    // 正面は鏡のように描くので、右へひねると顔は画面の右へ寄る
    expect(faceShift('front', right.pose.turn)).toBeGreaterThan(0.015);
    expect(faceShift('front', left.pose.turn)).toBeCloseTo(-faceShift('front', right.pose.turn), 9);
    expect(faceShift('front', 0)).toBe(0);
    // 手の動く向きと同じ
    expect(Math.sign(faceShift('front', right.pose.turn))).toBe(Math.sign(right.sk.r.hand.x));
    // 後ろから見ると、後頭部は反対へ動く
    expect(faceShift('back', right.pose.turn)).toBeLessThan(0);
    // 頭の幅を超えるほどは動かない（頭の回転は、胸の半分）
    expect(Math.abs(faceShift('front', right.pose.turn))).toBeLessThan(0.02);
  });

  it('骨盤と足は正面のまま動かさない', () => {
    const first = frames[0]!;
    for (const f of frames) {
      expect(dist(f.sk.pelvis, first.sk.pelvis)).toBeLessThan(1e-9);
      for (const s of SIDES) {
        expect(dist(f.sk[s].hip, first.sk[s].hip)).toBeLessThan(1e-9);
        expect(dist(f.sk[s].knee, first.sk[s].knee)).toBeLessThan(1e-9);
        expect(dist(f.sk[s].toe, first.sk[s].toe)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('S8 肩甲骨寄せ（動きの仕様との照合）', () => {
  const anim = frontAnim('S8-back-L1');
  const frames = framesOf(anim);

  it('後ろから見た図で、バンドを両手で持つ', () => {
    expect(anim.view).toBe('back');
    expect(anim.props.some((p) => p.type === 'band')).toBe(true);
  });

  it('始めは、バンドを胸の前で肩幅に持つ（手は肩の幅、肩より少し低い）', () => {
    const f = frames[0]!;
    for (const s of SIDES) {
      expect(f.sk[s].hand.x).toBeCloseTo(f.sk[s].shoulder.x, 6);
      expect(f.sk[s].shoulder.y - f.sk[s].hand.y).toBeGreaterThan(0.04);
      expect(f.sk[s].shoulder.y - f.sk[s].hand.y).toBeLessThan(0.12);
    }
  });

  it('肘を伸ばしたまま、左右対称に引き広げる', () => {
    const widest = frames.reduce((a, b) => (b.sk.r.hand.x > a.sk.r.hand.x ? b : a));
    expect(widest.sk.r.hand.x - widest.sk.r.shoulder.x).toBeGreaterThan(0.25);
    for (const f of frames) {
      expect(f.sk.r.hand.x, at(f)).toBeCloseTo(-f.sk.l.hand.x, 9);
      for (const s of SIDES) {
        // 肩・肘・手が一直線（肘が曲がっていない）
        const limb = f.sk[s];
        const cross = (limb.elbow.x - limb.shoulder.x) * (limb.hand.y - limb.shoulder.y) - (limb.elbow.y - limb.shoulder.y) * (limb.hand.x - limb.shoulder.x);
        expect(Math.abs(cross), at(f)).toBeLessThan(1e-9);
      }
    }
  });

  it('肩甲骨を寄せて 2〜3 秒止め、ゆっくり戻す', () => {
    const held = frames.filter((f) => f.pose.scapula > 0.999);
    expect(held.length * STEP).toBeGreaterThanOrEqual(2);
    expect(held.length * STEP).toBeLessThanOrEqual(3.05);
    expect(frames[0]!.pose.scapula).toBe(0);
    for (const f of held) expect(f.sk.r.hand.x).toBeCloseTo(held[0]!.sk.r.hand.x, 3);
  });

  it('肩を上げない（肩の高さが、始めから終わりまで変わらない）。高さの目安の線を出す', () => {
    const first = frames[0]!;
    for (const f of frames) {
      for (const s of SIDES) expect(f.sk[s].shoulder.y, at(f)).toBeCloseTo(first.sk[s].shoulder.y, 9);
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
    }
    const line = anim.marks.find((m) => m.type === 'line');
    expect(line?.anchor).toBe('chest');
    expect(line && line.type === 'line' ? line.angle : null).toBe(90); // 水平の線
    expect(line?.from).toBe(0);
    expect(line?.to).toBe(anim.cycleSeconds);
  });
});

describe('立って行う種目（レベル2・正面と後ろ向き。仕様との照合）', () => {
  const footRange = (f: FrontFrame, side: BodySide) => frontFootContact(f.sk[side])!;

  it('B1 足をそろえて立つ：両足をそろえ、姿勢を保つ（動かない）', () => {
    const frames = framesOf(frontAnim('B1-front-L2'));
    const first = frames[0]!;
    expect(Math.abs(first.sk.r.ankle.x - first.sk.l.ankle.x)).toBeLessThan(0.07); // 足の幅（0.055）ほどの間隔＝両足が並んでつく
    expect(first.sk.r.ankle.x).toBeCloseTo(-first.sk.l.ankle.x, 6);
    for (const f of frames) {
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      for (const s of SIDES) expect(dist(f.sk[s].toe, first.sk[s].toe)).toBeLessThan(1e-9);
    }
  });

  it('S6 脚の横上げ：体重を反対の足に乗せ、骨盤を水平に保ち、上体を傾けずに、片方の脚を横へ上げる', () => {
    const anim = frontAnim('S6-front-L2');
    const frames = framesOf(anim, 'none');
    const rest = frames[0]!;
    const top = frames.reduce((a, b) => (b.sk.r.ankle.y > a.sk.r.ankle.y ? b : a));
    expect(top.sk.r.ankle.y).toBeGreaterThan(rest.sk.r.ankle.y + 0.04);
    expect(top.sk.r.ankle.x - rest.sk.r.ankle.x).toBeGreaterThan(0.15); // 横（体の外）へ動く
    const angle = (Math.atan2(top.sk.r.ankle.x - top.sk.r.hip.x, top.sk.r.hip.y - top.sk.r.ankle.y) * 180) / Math.PI;
    expect(angle).toBeGreaterThan(20);
    expect(angle).toBeLessThanOrEqual(45); // 股関節の外転の参考可動域の中
    for (const f of frames) {
      expect(f.pose.lean).toBe(0); // 上体を傾けない
      expect(f.sk.r.hip.y).toBeCloseTo(f.sk.l.hip.y, 9); // 骨盤は水平
      expect(dist(f.sk.l.heel, rest.sk.l.heel), at(f)).toBeLessThan(1e-9); // 支える足は動かない
      // 重心は、支える足（左足）の上にある
      const range = footRange(f, 'l');
      expect(f.com.x, at(f)).toBeGreaterThanOrEqual(range.min);
      expect(f.com.x, at(f)).toBeLessThanOrEqual(range.max);
    }
    const mark = anim.marks.find((m) => m.type === 'line');
    expect(mark?.anchor).toBe('lumbar'); // 骨盤を水平に保つ線
  });

  it('W1 足首回し（立って）：体重を反対の足に乗せ、かかとを床につけたまま、つま先で円を描く', () => {
    const anim = frontAnim('W1-front-L2');
    const frames = framesOf(anim, 'none');
    const first = frames[0]!;
    const path = frames.map((f) => f.sk.r.toe);
    expect(Math.abs(turnsAround(path, center(path)))).toBeCloseTo(1, 3);
    for (const f of frames) {
      expect(f.sk.r.heel.y).toBeCloseTo(0, 9);
      expect(dist(f.sk.l.heel, first.sk.l.heel)).toBeLessThan(1e-9);
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      const range = footRange(f, 'l');
      expect(f.com.x, at(f)).toBeGreaterThanOrEqual(range.min);
      expect(f.com.x, at(f)).toBeLessThanOrEqual(range.max);
    }
    // 座って行うレベル1と、つま先の動きは同じ
    const seated = framesOf(frontAnim('W1-front-L1'));
    frames.forEach((f, i) => {
      expect(f.pose.rToeOut).toBeCloseTo(seated[i]!.pose.rToeOut, 9);
      expect(f.pose.rToeUp).toBeCloseTo(seated[i]!.pose.rToeUp, 9);
    });
    expect(anim.reverseCaptions).toBeDefined();
  });

  it('D3 横歩き：右へ3歩、左へ3歩で元の所に戻る。足を交差させず、片足ずつ小さく動かす', () => {
    const anim = frontAnim('D3-front-L2');
    const frames = framesOf(anim, 'none');
    const first = frames[0]!;
    const far = frames.reduce((a, b) => (b.sk.pelvis.x > a.sk.pelvis.x ? b : a));
    expect(far.sk.pelvis.x - first.sk.pelvis.x).toBeCloseTo(0.3, 3); // 0.1 ずつ3歩
    expect(far.t).toBeLessThan(anim.cycleSeconds / 2 + 0.01);
    let steps = 0;
    let wasMovingR = false;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!;
      const b = frames[i]!;
      // 足を交差させない（右足はいつも左足より右。間は足の幅より広い）
      expect(b.sk.r.ankle.x - b.sk.l.ankle.x, at(b)).toBeGreaterThan(0.1);
      expect(b.sk.r.ankle.x - b.sk.l.ankle.x, at(b)).toBeLessThan(0.22); // 小さな歩幅
      // 片足ずつ動かす：片方が動いている間、もう片方は床の上で動かない
      // （キーフレームの値を小数4桁に丸めているので、止まっている足にもごく小さな誤差が出る）
      const dR = Math.abs(b.sk.r.heel.x - a.sk.r.heel.x);
      const dL = Math.abs(b.sk.l.heel.x - a.sk.l.heel.x);
      const movedR = dR > 3e-4;
      const movedL = dL > 3e-4;
      expect(movedR && movedL, at(b)).toBe(false);
      if (movedR) {
        expect(dL, at(b)).toBeLessThan(1e-4);
        expect(Math.abs(b.sk.l.heel.y), at(b)).toBeLessThan(1e-4);
      }
      if (movedL) {
        expect(dR, at(b)).toBeLessThan(1e-4);
        expect(Math.abs(b.sk.r.heel.y), at(b)).toBeLessThan(1e-4);
      }
      if (movedR && !wasMovingR) steps++;
      wasMovingR = movedR;
      // 浮かせている間、重心は「支える足」と「次に足を着く所」の間にある
      if (!bothFeetDown(b)) {
        expect(b.com.x, at(b)).toBeGreaterThan(b.sk.l.heel.x - 0.03);
        expect(b.com.x, at(b)).toBeLessThan(b.sk.r.heel.x + 0.03);
      }
      expect(Math.abs(b.sk.head.x - b.sk.pelvis.x)).toBeLessThan(1e-9); // 上体を傾けない
    }
    expect(steps).toBe(6); // 右足を動かすのは、右へ3回・左へ3回
    // 体と一緒に、手もカウンターの上を動く
    const held = framesOf(anim, 'both');
    for (const f of held) {
      expect(f.sk.r.hand.x - f.sk.pelvis.x).toBeCloseTo(0.1, 9);
      expect(f.sk.l.hand.x - f.sk.pelvis.x).toBeCloseTo(-0.1, 9);
    }
    expect(anim.props.some((p) => p.type === 'counter' && p.inFront)).toBe(true);
  });

  it('S8 肩甲骨寄せ（立って）：つかまらずに行い、腕の動きは座って行うレベル1と同じ。つかまる所は横に描く', () => {
    const anim = frontAnim('S8-back-L2');
    expect(anim.support).toBeUndefined();
    expect(shownProps(anim, null).some((p) => p.type === 'chair')).toBe(true);
    const frames = framesOf(anim);
    const seated = framesOf(frontAnim('S8-back-L1'));
    frames.forEach((f, i) => {
      for (const key of ['rElbowOut', 'rElbowUp', 'rHandOut', 'rHandUp', 'scapula'] as const) expect(f.pose[key]).toBeCloseTo(seated[i]!.pose[key], 9);
      for (const s of SIDES) {
        expect(f.sk[s].shoulder.y).toBeCloseTo(frames[0]!.sk[s].shoulder.y, 9); // 肩を上げない
        expect(Math.abs(f.sk[s].heel.y)).toBeLessThan(0.002); // 両足で立つ
      }
    });
    // 横の椅子に、広げた腕が当たらない（椅子の背は腕より低い）
    const chair = anim.props.find((p): p is FrontChairProp => p.type === 'chair')!;
    for (const f of frames) expect(Math.min(f.sk.r.hand.y, f.sk.l.hand.y)).toBeGreaterThan(chair.backHeight + 0.05);
  });
});

describe('レベル3の種目（正面。仕様との照合）', () => {
  const inFoot = (f: FrontFrame, side: BodySide) => {
    const range = frontFootContact(f.sk[side])!;
    return f.com.x >= range.min && f.com.x <= range.max;
  };

  it('B4 片足で立つ：片足を床から少し浮かせ、上体を傾けずに、姿勢を保つ', () => {
    const frames = framesOf(frontAnim('B4-front-L3'), 'none');
    const first = frames[0]!;
    expect(first.sk.r.heel.y).toBeGreaterThan(0.03); // 浮かせている
    expect(first.sk.r.heel.y).toBeLessThan(0.12); // 少しだけ
    expect(frontFootContact(first.sk.r)).toBeNull();
    for (const f of frames) {
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      expect(f.pose.lean).toBe(0);
      expect(inFoot(f, 'l'), at(f)).toBe(true); // 重心は支える足の上
    }
  });

  it('D1 足先タッチ：前・横・後ろの順に床に触れ、そのたびに足を戻す。3か所で1回', () => {
    const anim = frontAnim('D1-front-L3');
    expect(anim.countsPerCycle ?? 1).toBe(1);
    const frames = framesOf(anim, 'none');
    const rest = frames[0]!;
    const third = anim.cycleSeconds / 3;
    const touch = (k: number) => computeFrontFrame(anim, k * third + 2.65, 'none');
    const [front, side, back] = [touch(0), touch(1), touch(2)];
    // 触れるとき、つま先は床にある
    for (const f of [front, side, back]) expect(Math.abs(f.sk.r.toe.y)).toBeLessThan(0.002);
    // 前は手前（濃く・大きく）、後ろは奥（薄く・小さく）、横は体の外へ
    expect(front.pose.rKneeDepth).toBeCloseTo(1, 6);
    expect(back.pose.rKneeDepth).toBeCloseTo(-1, 6);
    expect(side.pose.rKneeDepth).toBeCloseTo(0, 6);
    for (const f of frames) expect(f.pose.lKneeDepth, at(f)).toBe(0); // 支える足は、描き方を変えない
    expect(side.sk.r.toe.x - rest.sk.r.toe.x).toBeGreaterThan(0.1);
    // そのたびに足を戻す
    for (const k of [1, 2, 3]) expect(dist(computeFrontFrame(anim, k * third - 0.02, 'none').sk.r.toe, rest.sk.r.toe)).toBeLessThan(0.002);
    // 重心は支える足の上に保つ。支える足は動かない
    for (const f of frames) {
      expect(inFoot(f, 'l'), at(f)).toBe(true);
      expect(dist(f.sk.l.heel, rest.sk.l.heel)).toBeLessThan(1e-9);
      expect(f.pose.lean).toBe(0);
    }
    expect(anim.captions.map((c) => c.text.match(/前|横|後ろ/)?.[0])).toEqual(['前', '横', '後ろ']);
  });
});
