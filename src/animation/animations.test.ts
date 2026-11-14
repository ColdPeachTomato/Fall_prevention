// 同梱する横向きのアニメを、付録「アニメ確認チェックリスト」のうち計算で確かめられる項目で検査する。
// 新しいアニメを登録すると、自動でこの検査の対象になる。正面・後ろ向きは frontAnimations.test.ts で検査する。

import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise } from '../data/exercises';
import { ALL_JOINTS } from './bodyModel';
import { VIEW } from './draw';
import { ANIMATIONS, getAnimation } from './registry';
import { computeFrame, footContact, type Frame, type Vec } from './sideRig';
import type { SideAnimation } from './types';
import { validateAnimation } from './validate';

const STEP = 0.02; // 検査する時刻の間隔（秒）

// 運動そのものとして動かす足（体を支えていない足）。床をかすめて動き出すので、滑りの検査から外す
const EXERCISING_FOOT: Record<string, ('near' | 'far')[]> = {
  'S4-side-L1': ['near'], // 膝を伸ばす側の足は、床から前へ振り出す
};

const SIDE = ANIMATIONS.filter((a): a is SideAnimation => a.view === 'side');

function sideAnim(id: string): SideAnimation {
  const anim = getAnimation(id);
  if (anim?.view !== 'side') throw new Error(`横向きのアニメがありません：${id}`);
  return anim;
}

function framesOf(anim: SideAnimation): Frame[] {
  const count = Math.round(anim.cycleSeconds / STEP);
  return Array.from({ length: count + 1 }, (_, i) => computeFrame(anim, Math.min(anim.cycleSeconds, i * STEP)));
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const at = (f: Frame) => `t=${f.t.toFixed(2)}`;

// 体の主な点のうち、いちばん速く動いている点の速さ（身長/秒）
function speedBetween(a: Frame, b: Frame): number {
  const points = ['head', 'hip', 'knee', 'ankle', 'toe', 'hand', 'farKnee', 'farAnkle', 'farToe'] as const;
  return Math.max(...points.map((k) => dist(a.sk[k], b.sk[k]) / STEP));
}

// 動いている時間帯（止まっている所で区切る）
function movingPhases(frames: Frame[]): { from: number; to: number }[] {
  const MOVING = 0.004; // これより遅ければ止まっているとみなす（身長/秒）
  const PAUSE = 0.15; // これより長く止まっていたら、動きの区切りとする（秒）
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

describe('アニメの登録', () => {
  it('運動データの animationId と、登録済みのアニメが1対1で対応する', () => {
    for (const anim of ANIMATIONS) {
      const variant = getExercise(anim.exercise).variants.find((v) => v.level === anim.level);
      expect(variant?.animationId, anim.id).toBe(anim.id);
      expect(variant?.view, anim.id).toBe(anim.view);
    }
    expect(new Set(ANIMATIONS.map((a) => a.id)).size).toBe(ANIMATIONS.length);
    // 運動データが参照するアニメは、すべて登録されている
    for (const ex of EXERCISES) {
      for (const v of ex.variants) {
        if (v.animationId === null) continue;
        const anim = getAnimation(v.animationId);
        expect(anim, `${ex.id} L${v.level}`).toBeDefined();
        expect(anim?.exercise).toBe(ex.id);
        expect(anim?.view).toBe(v.view);
      }
    }
  });

  it('レベル1の8種目（W1・W2・W3・S1・S2・S3・S4・S5・S8 のうち座位と S1）にアニメがある', () => {
    for (const id of ['W1', 'W2', 'W3', 'S1', 'S2', 'S3', 'S4', 'S5', 'S8']) {
      const variant = getExercise(id).variants.find((v) => v.level === 1);
      expect(getAnimation(variant?.animationId), id).toBeDefined();
    }
  });

  it('逆向きに再生できるアニメは、回す向きがある種目（W1・W2）だけ', () => {
    for (const anim of ANIMATIONS) {
      expect(anim.reverseCaptions !== undefined, anim.id).toBe(getExercise(anim.exercise).directions !== undefined);
    }
  });

  it('レベル1で横向きの種目（S1〜S5）と、S1 のレベル2にアニメがある', () => {
    for (const id of ['S1-side-L1', 'S1-side-L2', 'S2-side-L1', 'S3-side-L1', 'S4-side-L1', 'S5-side-L1']) {
      expect(getAnimation(id), id).toBeDefined();
    }
  });

  it('書き出した JSON を読み直しても、同じデータとして検証に通る', () => {
    for (const anim of ANIMATIONS) {
      const r = validateAnimation(JSON.parse(JSON.stringify(anim)));
      expect(r.ok, anim.id).toBe(true);
      if (r.ok) expect(r.anim).toEqual(anim);
    }
  });

  it('字幕は、先に確保した2行に収まる長さ（26文字以内）にする', () => {
    // 字幕の場所は2行分を先に取ってある（styles.css の .anim-caption）。これより長いと、下の表示が動いてしまう
    for (const anim of ANIMATIONS) {
      for (const c of [...anim.captions, ...(anim.reverseCaptions ?? [])]) {
        expect([...c.text].length, `${anim.id}「${c.text}」`).toBeLessThanOrEqual(26);
      }
    }
  });

  it('確認済みの印は、人が確かめるまで付けない', () => {
    // 印を付けるのは、医師などが見本を確かめた後。ここに id を足してから JSON の checked を true にする
    const confirmed: string[] = [];
    for (const anim of ANIMATIONS) expect(anim.checked === true, anim.id).toBe(confirmed.includes(anim.id));
  });
});

describe.each(SIDE.map((a) => [a.id, a] as const))('%s', (_id, anim) => {
  const frames = framesOf(anim);
  const chair = anim.props.find((p) => p.type === 'chair');
  const seated = anim.root.mode === 'seat';

  it('B：重心が常に支える面（足と座面）の上にある', () => {
    for (const f of frames) expect(f.stable, `${at(f)} 重心 ${f.com.x.toFixed(3)} 範囲 ${f.support.min.toFixed(3)}〜${f.support.max.toFixed(3)}`).toBe(true);
  });

  it('B：支えている足が滑らず、浮かない', () => {
    const first = frames[0]!;
    if (!seated) {
      // 足を起点にする種目：両足とも床に平らについたまま動かない
      for (const f of frames) {
        expect(f.sk.heel).toEqual(first.sk.heel);
        expect(f.sk.toe).toEqual(first.sk.toe);
        expect(f.sk.heel.y).toBeCloseTo(0, 9);
        expect(f.sk.toe.y).toBeCloseTo(0, 9);
        expect(dist(f.sk.farAnkle, first.sk.farAnkle), at(f)).toBeLessThan(1e-6);
      }
      return;
    }
    // 足を床に付ける指定がある脚：支点が床の上で動かない
    for (const [plant, key] of [
      [anim.plants?.near, 'near'],
      [anim.plants?.far, 'far'],
    ] as const) {
      if (!plant) continue;
      for (const f of frames) {
        const heel = key === 'near' ? f.sk.heel : f.sk.farHeel;
        const ball = key === 'near' ? f.sk.ball : f.sk.farBall;
        const pivot = plant.pivot === 'ball' ? ball : heel;
        expect(pivot.x, at(f)).toBeCloseTo(plant.x, 9);
        expect(pivot.y, at(f)).toBeCloseTo(0, 9);
      }
    }
    // 床についている足は、ついている間は滑らない
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!.sk;
      const b = frames[i]!.sk;
      const exercising = EXERCISING_FOOT[anim.id] ?? [];
      if (!exercising.includes('near') && footContact(a.heel, a.ball, a.toe) && footContact(b.heel, b.ball, b.toe)) {
        expect(Math.abs(b.ball.x - a.ball.x), at(frames[i]!)).toBeLessThan(0.001);
      }
      if (!exercising.includes('far') && footContact(a.farHeel, a.farBall, a.farToe) && footContact(b.farHeel, b.farBall, b.farToe)) {
        expect(Math.abs(b.farBall.x - a.farBall.x), at(frames[i]!)).toBeLessThan(0.001);
      }
    }
    // 足が床にめり込まない（振り出す足が床をかすめる分として、身長の 0.4%（身長160cmで約6mm）までは許す）
    for (const f of frames) {
      for (const p of [f.sk.heel, f.sk.ball, f.sk.toe, f.sk.farHeel, f.sk.farBall, f.sk.farToe]) {
        expect(p.y, at(f)).toBeGreaterThan(-0.004);
      }
    }
  });

  it('B：関節が可動域を超えない', () => {
    for (const f of frames) {
      for (const j of ALL_JOINTS) {
        expect(f.pose[j.name], `${j.name} ${at(f)}`).toBeGreaterThanOrEqual(j.min - 1e-9);
        expect(f.pose[j.name], `${j.name} ${at(f)}`).toBeLessThanOrEqual(j.max + 1e-9);
      }
      // 手の接触を反映した後の腕も確かめる
      for (const [shoulder, elbow] of [
        [f.sk.arm.shoulder, f.sk.arm.elbow],
        [f.sk.arm.farShoulder, f.sk.arm.farElbow],
      ] as const) {
        expect(elbow, at(f)).toBeGreaterThanOrEqual(-5);
        expect(elbow, at(f)).toBeLessThanOrEqual(145);
        expect(shoulder, at(f)).toBeGreaterThanOrEqual(-50);
        expect(shoulder, at(f)).toBeLessThanOrEqual(180);
      }
    }
  });

  it('B：手を付く表現では、手が実際に触れている', () => {
    for (const f of frames) {
      if (f.hands < 0.999) continue;
      if (f.sk.handTarget) expect(dist(f.sk.hand, f.sk.handTarget), at(f)).toBeLessThan(0.005);
      if (f.sk.farHandTarget) expect(dist(f.sk.farHand, f.sk.farHandTarget), at(f)).toBeLessThan(0.005);
    }
  });

  it('A：座っている間は、お尻が座面の上にある', () => {
    if (!chair) return;
    for (const f of frames) {
      if (!f.onSeat) continue;
      expect(f.sk.hip.y - chair.seatHeight, at(f)).toBeGreaterThan(0.04);
      expect(f.sk.hip.y - chair.seatHeight, at(f)).toBeLessThan(0.07);
      expect(f.sk.hip.x).toBeGreaterThan(chair.x);
      expect(f.sk.hip.x).toBeLessThan(chair.x + chair.seatDepth);
    }
    if (seated) expect(frames.every((f) => f.onSeat)).toBe(true);
  });

  it('A：反動がなく、ゆっくり動く（速さと、速さの変化に上限がある）', () => {
    // 速さの上限：1秒に身長の 42%（身長160cmで約67cm/秒）。速さの変化：1コマで急に変わらない
    let prevSpeed = 0;
    for (let i = 1; i < frames.length; i++) {
      const speed = speedBetween(frames[i - 1]!, frames[i]!);
      expect(speed, at(frames[i]!)).toBeLessThan(0.42);
      expect(Math.abs(speed - prevSpeed), at(frames[i]!)).toBeLessThan(0.05);
      prevSpeed = speed;
    }
  });

  it('A：上げ下げ（動きのひと区切り）が、それぞれ 2〜3 秒', () => {
    const phases = movingPhases(frames);
    expect(phases.length).toBeGreaterThanOrEqual(2);
    for (const p of phases) {
      // 動き始めと止まり際はごくゆっくりなので、測った長さは少し短く出る
      expect(p.to - p.from, `${p.from.toFixed(2)}〜${p.to.toFixed(2)}`).toBeGreaterThanOrEqual(1.85);
      expect(p.to - p.from, `${p.from.toFixed(2)}〜${p.to.toFixed(2)}`).toBeLessThanOrEqual(3.05);
    }
  });

  it('A：1往復の終わりが最初の姿勢に戻る（回数のカウントと合う）', () => {
    const start = frames[0]!;
    const end = frames[frames.length - 1]!;
    for (const j of ALL_JOINTS) expect(end.pose[j.name], j.name).toBeCloseTo(start.pose[j.name], 6);
  });

  it('A：回数を数える時点では、動きが止まっている', () => {
    const counts = anim.countsPerCycle ?? 1;
    for (let k = 1; k <= counts; k++) {
      const t = (anim.cycleSeconds * k) / counts;
      const speed = speedBetween(computeFrame(anim, t - STEP), computeFrame(anim, t));
      expect(speed, `t=${t.toFixed(2)}`).toBeLessThan(0.004);
    }
  });

  it('C：支持物（椅子）が常に画面内にある', () => {
    for (const p of anim.props) {
      expect(p.x - 0.02).toBeGreaterThan(VIEW.minX);
      expect(p.x + p.seatDepth).toBeLessThan(VIEW.maxX);
      expect(p.backHeight).toBeLessThan(VIEW.maxY);
    }
  });

  it('E：人物の全身と足元が画面からはみ出さない', () => {
    for (const f of frames) {
      const sk = f.sk;
      const xs = [
        sk.head.x + 0.075,
        sk.head.x - 0.075,
        sk.toe.x + 0.02,
        sk.farToe.x + 0.02,
        sk.heel.x - 0.01,
        sk.ankle.x + 0.045,
        sk.elbow.x - 0.035,
        sk.hand.x + 0.03,
        sk.hip.x - 0.07,
      ];
      expect(Math.max(...xs), at(f)).toBeLessThan(VIEW.maxX);
      expect(Math.min(...xs), at(f)).toBeGreaterThan(VIEW.minX);
      expect(sk.head.y + 0.075).toBeLessThan(VIEW.maxY);
    }
    expect(VIEW.minY).toBeLessThan(0);
  });

  it('D：字幕が1往復のすべての時間をすき間なく覆う', () => {
    const sorted = [...anim.captions].sort((a, b) => a.from - b.from);
    expect(sorted[0]?.from).toBe(0);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.from).toBeCloseTo(sorted[i - 1]!.to, 9);
    expect(sorted[sorted.length - 1]?.to).toBe(anim.cycleSeconds);
  });

  it('D：注意点の印（矢印や線）がある', () => {
    expect(anim.marks.length).toBeGreaterThan(0);
  });
});

describe('S1 椅子からの立ち座り（仕様との照合）', () => {
  const l1 = sideAnim('S1-side-L1');
  const l2 = sideAnim('S1-side-L2');

  it.each([l1, l2])('$id：開始姿勢は足を少し引いて座る（足首が膝より後ろ）', (anim) => {
    const f = computeFrame(anim, 0);
    expect(f.onSeat).toBe(true);
    expect(f.sk.ankle.x).toBeLessThan(f.sk.knee.x - 0.05);
    expect(f.pose.spine).toBe(0); // 背筋を伸ばす
  });

  it.each([l1, l2])('$id：お尻が離れる前に前かがみになる', (anim) => {
    const frames = framesOf(anim);
    const before = frames[frames.findIndex((f) => !f.onSeat) - 1]!;
    expect(before.sk.shoulder.x).toBeGreaterThan(before.sk.hip.x + 0.15); // 肩が股関節より前
    expect(before.sk.head.x).toBeGreaterThan(before.sk.knee.x - 0.02); // 頭が膝の上あたりまで出る
  });

  it.each([l1, l2])('$id：立ったときは体がまっすぐ伸びる', (anim) => {
    const top = framesOf(anim).reduce((a, b) => (b.sk.head.y > a.sk.head.y ? b : a));
    expect(top.pose.knee).toBeLessThan(6);
    expect(Math.abs(top.sk.head.x - top.sk.ankle.x)).toBeLessThan(0.04);
  });

  it('レベル1は手を太ももに付いて立ち、立ったら手を離す', () => {
    expect(l1.contacts?.near).toBeDefined();
    expect(computeFrame(l1, 0).hands).toBeCloseTo(1, 6);
    const top = framesOf(l1).reduce((a, b) => (b.sk.head.y > a.sk.head.y ? b : a));
    expect(top.hands).toBeLessThan(0.01);
  });

  it('レベル2は手を使わない（腕は体の横に下ろしたまま。ふらついたらすぐつかまれる）', () => {
    expect(l2.contacts).toBeUndefined();
    for (const f of framesOf(l2)) {
      expect(f.hands).toBe(0);
      // 腕はほぼ真下に下がり、肘はほぼ伸びている
      const fromDown = (Math.atan2(f.sk.hand.x - f.sk.shoulder.x, f.sk.shoulder.y - f.sk.hand.y) * 180) / Math.PI;
      expect(Math.abs(fromDown), at(f)).toBeLessThan(15);
      expect(f.sk.arm.elbow, at(f)).toBeLessThan(20);
    }
    // 座っているときと立ったときは、手が体の横（股関節のあたり）にある
    for (const t of [0, 3.5]) {
      const f = computeFrame(l2, t);
      expect(Math.abs(f.sk.hand.x - f.sk.hip.x)).toBeLessThan(0.08);
    }
  });

  it('レベル1と2で、下半身の動きは同じ', () => {
    for (const t of [0, 1, 1.4, 2, 3, 4, 5, 6]) {
      const a = computeFrame(l1, t);
      const b = computeFrame(l2, t);
      expect(a.sk.hip.x).toBeCloseTo(b.sk.hip.x, 9);
      expect(a.sk.hip.y).toBeCloseTo(b.sk.hip.y, 9);
      expect(a.sk.knee.x).toBeCloseTo(b.sk.knee.x, 9);
    }
  });
});

describe('座って行う種目（仕様との照合）', () => {
  const upright = (f: Frame) => Math.abs(f.sk.shoulder.x - f.sk.hip.x) < 0.005 && Math.abs(f.sk.head.x - f.sk.hip.x) < 0.005;

  it.each(['S2-side-L1', 'S3-side-L1', 'S4-side-L1', 'S5-side-L1'])('%s：背筋を伸ばして座り、手は座面の横を持ったまま', (id) => {
    for (const f of framesOf(sideAnim(id))) {
      expect(upright(f), at(f)).toBe(true);
      expect(f.hands).toBeCloseTo(1, 6);
    }
  });

  it('S2 かかと上げ：母趾球を床に付けたまま、両足のかかとが上がって下りる', () => {
    const anim = sideAnim('S2-side-L1');
    const start = computeFrame(anim, 0);
    const top = framesOf(anim).reduce((a, b) => (b.sk.heel.y > a.sk.heel.y ? b : a));
    expect(start.sk.heel.y).toBeCloseTo(0, 6);
    expect(top.sk.heel.y).toBeGreaterThan(0.04);
    expect(top.sk.farHeel.y).toBeCloseTo(top.sk.heel.y, 9);
    expect(top.sk.toe.y).toBeCloseTo(0, 9);
    expect(top.sk.knee.y).toBeGreaterThan(start.sk.knee.y + 0.02);
  });

  it('S3 つま先上げ：かかとを床に付けたまま、両足のつま先が上がって下りる', () => {
    const anim = sideAnim('S3-side-L1');
    const start = computeFrame(anim, 0);
    const top = framesOf(anim).reduce((a, b) => (b.sk.toe.y > a.sk.toe.y ? b : a));
    expect(start.sk.toe.y).toBeCloseTo(0, 6);
    expect(top.sk.toe.y).toBeGreaterThan(0.03);
    expect(top.sk.farToe.y).toBeCloseTo(top.sk.toe.y, 9);
    expect(top.sk.heel.y).toBeCloseTo(0, 9);
  });

  it('S4 膝伸ばし：片方の膝を伸ばして1秒止め、もう片方の足と太ももは動かない', () => {
    const anim = sideAnim('S4-side-L1');
    const frames = framesOf(anim);
    const start = frames[0]!;
    const straight = frames.filter((f) => f.pose.knee < 12.5);
    expect(straight.length * STEP).toBeGreaterThanOrEqual(0.95); // 伸ばして止める
    expect(Math.min(...frames.map((f) => f.pose.knee))).toBeGreaterThanOrEqual(5); // 伸ばしきらない
    for (const f of frames) {
      expect(dist(f.sk.knee, start.sk.knee), at(f)).toBeLessThan(1e-9); // 太ももは座面に乗ったまま
      expect(dist(f.sk.farAnkle, start.sk.farAnkle), at(f)).toBeLessThan(1e-9);
      expect(f.sk.farHeel.y).toBeCloseTo(0, 2);
    }
    expect(straight[0]!.sk.ankle.y).toBeGreaterThan(start.sk.ankle.y + 0.15);
  });

  it('S5 膝上げ：左右交互に上げ、片方を上げている間、もう片方の足は床についている', () => {
    const anim = sideAnim('S5-side-L1');
    expect(anim.countsPerCycle).toBe(2);
    const frames = framesOf(anim);
    const rest = frames[0]!;
    const half = anim.cycleSeconds / 2;
    for (const f of frames) {
      const nearUp = f.sk.knee.y > rest.sk.knee.y + 0.005;
      const farUp = f.sk.farKnee.y > rest.sk.farKnee.y + 0.005;
      expect(nearUp && farUp, at(f)).toBe(false); // 両足を同時に上げない
      if (nearUp) expect(f.t).toBeLessThan(half);
      if (farUp) expect(f.t).toBeGreaterThan(half);
    }
    expect(Math.max(...frames.map((f) => f.sk.knee.y))).toBeGreaterThan(rest.sk.knee.y + 0.08);
    expect(Math.max(...frames.map((f) => f.sk.farKnee.y))).toBeCloseTo(Math.max(...frames.map((f) => f.sk.knee.y)), 6);
  });
});
