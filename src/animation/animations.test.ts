// 同梱する横向きのアニメを、付録「アニメ確認チェックリスト」のうち計算で確かめられる項目で検査する。
// 新しいアニメを登録すると、自動でこの検査の対象になる。正面・後ろ向きは frontAnimations.test.ts で検査する。

import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise } from '../data/exercises';
import { ALL_JOINTS } from './bodyModel';
import { VIEW } from './draw';
import { ANIMATIONS, getAnimation } from './registry';
import { computeFrame, footContact, type Frame, type Vec } from './sideRig';
import { sideFigureAlpha, STYLE } from './draw';
import { FAR_FADE, mixColor } from './drawFront';
import { solveFront } from './frontRig';
import { TURN_POSE } from './scene';
import type { ChairProp, SideAnimation, SupportStage } from './types';
import { validateAnimation } from './validate';

const STEP = 0.02; // 検査する時刻の間隔（秒）

// 運動そのものとして動かす足（体を支えていない足）。床をかすめて動き出すので、滑りの検査から外す
const EXERCISING_FOOT: Record<string, ('near' | 'far')[]> = {
  'S4-side-L1': ['near'], // 膝を伸ばす側の足は、床から前へ振り出す
  'S7-side-L2': ['near'], // 後ろへ上げる側の足は、床から後ろへ振り出す
  'S9-side-L3': ['near'], // 踏み出す側の足
  'S5-side-L2': ['near', 'far'], // 足踏み：上げる足は床を離れながら少し後ろへ動く（支える足が動かないことは、下の種目別の検査で確かめる）
};

// その種目で使える支えの段階（多い順）。種目の下限（例：S3 立位は両手）より少ない段階は使わない。
// つかまらない種目は null だけ
const STAGES: SupportStage[] = ['both', 'one', 'fingertip', 'none'];
function stagesFor(anim: SideAnimation): (SupportStage | null)[] {
  if (!anim.support) return [null];
  const ex = getExercise(anim.exercise);
  const min = ex.minSupport ?? 'none';
  // カウンターの横を歩く種目などは、片手まで
  const max = ex.variants.find((v) => v.level === anim.level)?.maxSupport ?? 'both';
  return STAGES.slice(STAGES.indexOf(max), STAGES.indexOf(min) + 1);
}
// 歩く種目（その場の足の運びで見せ、床の目印を流す）。止まらずに歩き続ける。
// 片足を浮かせている間は、次に足を着く所へ体を運んでいる途中なので、静的な重心の検査から外す
const WALKING = ['D2-side-L3', 'D4-side-L3', 'D5-side-L3'];
const bothFeetDown = (f: Frame) => footContact(f.sk.heel, f.sk.ball, f.sk.toe) !== null && footContact(f.sk.farHeel, f.sk.farBall, f.sk.farToe) !== null;
// 検査に使う段階：いちばん支えが少ない段階（これで安定なら、支えが多い段階でも安定）
function minStage(anim: SideAnimation): SupportStage | null {
  const stages = stagesFor(anim);
  return stages[stages.length - 1]!;
}
// 姿勢を保つ種目（秒数で行う）は、動かない
const isStatic = (anim: SideAnimation) => getExercise(anim.exercise).unit === 'seconds';

const SIDE = ANIMATIONS.filter((a): a is SideAnimation => a.view === 'side');

function sideAnim(id: string): SideAnimation {
  const anim = getAnimation(id);
  if (anim?.view !== 'side') throw new Error(`横向きのアニメがありません：${id}`);
  return anim;
}

function framesOf(anim: SideAnimation, stage: SupportStage | null = minStage(anim)): Frame[] {
  const count = Math.round(anim.cycleSeconds / STEP);
  return Array.from({ length: count + 1 }, (_, i) => computeFrame(anim, Math.min(anim.cycleSeconds, i * STEP), stage));
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

  it('どの字幕も2秒以上出る（一瞬で消える字幕を作らない）。最初の姿勢は「姿勢の文」で出し続ける', () => {
    for (const anim of ANIMATIONS) {
      for (const c of [...anim.captions, ...(anim.reverseCaptions ?? [])]) {
        expect(c.to - c.from, `${anim.id}「${c.text}」`).toBeGreaterThanOrEqual(2);
      }
      if (anim.posture !== undefined) expect([...anim.posture].length, `${anim.id}「${anim.posture}」`).toBeLessThanOrEqual(26);
      // 動きのある種目には、姿勢の文がある（姿勢を保つ種目と横歩きは、字幕が姿勢の説明を兼ねる）
      if (!['B1', 'B2', 'B3', 'B4', 'D3'].includes(anim.exercise)) expect(anim.posture, anim.id).toBeDefined();
    }
  });

  it('確認済みの印は、人が確かめたアニメにだけ付いている', () => {
    // 印を付けるのは、医師などが見本を確かめた後。ここに id を足してから JSON の checked を true にする
    // （tools/confirmed.mjs にも同じ id を入れる。生成スクリプトは、そちらを見て checked を付ける）
    const confirmed: string[] = [
      // 2026-11-14 確認
      'S1-side-L1',
      'S1-side-L2',
      'S1-side-L3',
      'S2-side-L1',
      'S2-side-L2',
      'S3-side-L1',
      'S3-side-L2',
      'S4-side-L1',
      'S5-side-L1',
      'S5-side-L2',
      'S7-side-L2',
      // 2026-11-15 確認（S8 は拳の欠け方を直した後に、もう一度確かめてもらった）
      'S6-front-L2',
      'S8-back-L1',
      'S8-back-L2',
      'W1-front-L1',
      'W1-front-L2',
      'W2-front-L1',
      'W4-side-L2',
      'B1-front-L2',
      'B2-side-L2',
      'B3-side-L3',
      'D3-front-L2',
      'D4-side-L3',
      'D5-side-L3',
      // D2-side-L3 は、向き・膝・腕の振りを作り直した（2026-11-15）。確認待ち
      // 2026-11-15 に直したあと、もう一度確かめてもらった（W3：髪の裾のつなぎ方、B4：腕を開いて揺らす）
      'W3-front-L1',
      'B4-front-L3',
      'S9-side-L3',
      'D1-front-L3',
    ];
    for (const anim of ANIMATIONS) expect(anim.checked === true, anim.id).toBe(confirmed.includes(anim.id));
  });
});

describe.each(SIDE.map((a) => [a.id, a] as const))('%s', (_id, anim) => {
  const frames = framesOf(anim);
  const chair = anim.props.find((p): p is ChairProp => p.type === 'chair');
  const seated = anim.root.mode === 'seat';
  const walking = WALKING.includes(anim.id);
  // 足を踏み出す種目（S9）も、踏み出した足が着くまでは、次に足を着く所へ体を運んでいる途中
  const stepping = walking || anim.id === 'S9-side-L3';
  // D2 は、向きを変える間（6〜8 秒と 14〜16 秒）、人物を裏返しながら、踏む所が母趾球とかかとの間で移る。
  // この間は、足の滑りと静的な重心の検査から外す
  const switching = (t: number) => anim.id === 'D2-side-L3' && ((t > 5.9 && t < 8.1) || t > 13.9 || t < 0.1);

  it('B：重心が常に支える面（足と座面。両手でつかまる種目は支持物も）の上にある', () => {
    for (const f of frames) {
      if (stepping && (!bothFeetDown(f) || switching(f.t))) continue;
      expect(f.stable, `${at(f)} 重心 ${f.com.x.toFixed(3)} 範囲 ${f.support.min.toFixed(3)}〜${f.support.max.toFixed(3)}`).toBe(true);
    }
  });

  it('B：支えている足が滑らず、浮かない', () => {
    const first = frames[0]!;
    const exercising = EXERCISING_FOOT[anim.id] ?? [];
    if (walking) expect(frames.some((f) => f.pose.travel !== 0)).toBe(true);
    if (anim.root.mode !== 'seat' && anim.root.mode !== 'hip' && anim.root.side !== 'far' && !anim.plants?.near) {
      // 足首を起点にする種目：手前の足は床に平らについたまま動かない
      for (const f of frames) {
        expect(f.sk.heel).toEqual(first.sk.heel);
        expect(f.sk.toe).toEqual(first.sk.toe);
        expect(f.sk.heel.y).toBeCloseTo(0, 9);
        expect(f.sk.toe.y).toBeCloseTo(0, 9);
      }
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
    // 床についている足は、ついている間は滑らない。
    // 歩く種目では、床の目印と一緒に動く（足の位置＋歩いた距離が変わらない）ことを確かめる
    // （歩く種目では、床を離れる・着く瞬間を除き、しっかり床についている間で確かめる。
    //   D2 は、つま先歩きとかかと歩きを切り替える1秒間、踏む所が母趾球からかかとへ移るので除く）
    const on = (p: Vec) => Math.abs(p.y) < 0.0002;
    // 歩く種目：足が床についてから離れるまで、床の目印からのずれが小さい（身長160cmで約6mmまで）
    const landed: Record<string, number | null> = { 'near:ball': null, 'near:heel': null, 'far:ball': null, 'far:heel': null };
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!.sk;
      const b = frames[i]!.sk;
      if (walking) {
        const travel = frames[i]!.pose.travel;
        for (const [name, point] of [
          ['near:ball', b.ball],
          ['near:heel', b.heel],
          ['far:ball', b.farBall],
          ['far:heel', b.farHeel],
        ] as const) {
          // （1周の終わりのコマは、歩いた距離が最初に戻るので除く）
          if (!on(point) || switching(frames[i]!.t) || frames[i]!.t >= anim.cycleSeconds) {
            landed[name] = null;
            continue;
          }
          // 床の上での位置。人物が左向き（facing = -1）のときは、股関節の真上の線を軸に裏返して描かれる
          const onFloor = frames[i]!.pose.facing * (point.x - b.hip.x) + travel;
          if (landed[name] === null) landed[name] = onFloor;
          expect(Math.abs(onFloor - landed[name]!), `${name} ${at(frames[i]!)}`).toBeLessThan(0.004);
        }
        continue;
      }
      if (!exercising.includes('near') && footContact(a.heel, a.ball, a.toe) && footContact(b.heel, b.ball, b.toe)) {
        expect(Math.abs(b.ball.x - a.ball.x), at(frames[i]!)).toBeLessThan(0.001);
      }
      if (!exercising.includes('far') && footContact(a.farHeel, a.farBall, a.farToe) && footContact(b.farHeel, b.farBall, b.farToe)) {
        expect(Math.abs(b.farBall.x - a.farBall.x), at(frames[i]!)).toBeLessThan(0.001);
      }
    }
    // どのコマでも、少なくとも片方の足が床についている
    for (const f of frames) {
      const onFloor = footContact(f.sk.heel, f.sk.ball, f.sk.toe) ?? footContact(f.sk.farHeel, f.sk.farBall, f.sk.farToe);
      expect(onFloor, at(f)).not.toBeNull();
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
    // 歩く種目は止まらずに歩き続けるので、1周の終わりの速さから始める。足を運ぶ分、速さの変化を少し大きく許す
    let prevSpeed = walking ? speedBetween(frames[frames.length - 2]!, frames[frames.length - 1]!) : 0;
    for (let i = 1; i < frames.length; i++) {
      const speed = speedBetween(frames[i - 1]!, frames[i]!);
      expect(speed, at(frames[i]!)).toBeLessThan(0.42);
      expect(Math.abs(speed - prevSpeed), at(frames[i]!)).toBeLessThan(walking ? 0.07 : 0.05);
      prevSpeed = speed;
    }
  });

  it('A：上げ下げ（動きのひと区切り）が、それぞれ 2〜3 秒', () => {
    if (walking) {
      // 歩く種目は止まらずに歩き続ける。1歩は 1.5〜2 秒（下の種目別の検査で確かめる）
      expect(anim.floor).toBeDefined();
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
    if (walking) return; // 歩き続ける種目は、端まで行って戻るごとに数える
    for (let k = 1; k <= counts; k++) {
      const t = (anim.cycleSeconds * k) / counts;
      const speed = speedBetween(computeFrame(anim, t - STEP), computeFrame(anim, t));
      expect(speed, `t=${t.toFixed(2)}`).toBeLessThan(0.004);
    }
  });

  it('C：支えの段階（両手・片手・指先・なし）どおりにつかまり、手が支持物に触れている（S-10）', () => {
    if (!anim.support) return;
    const support = anim.support;
    expect(anim.props.length, '支持物を常に描く').toBeGreaterThan(0);
    const farSide = support.hand === 'far'; // 体の向こう側のカウンターには、奥の手でつかまる
    for (const stage of stagesFor(anim)) {
      for (const f of framesOf(anim, stage)) {
        const where = `${stage} ${at(f)}`;
        if (!stepping || (bothFeetDown(f) && !switching(f.t))) expect(f.stable, where).toBe(true);
        expect(f.sk.holding.near, where).toBe(stage !== 'none' && !farSide);
        expect(f.sk.holding.far, where).toBe(stage !== 'none' && (farSide || stage === 'both'));
        const lift = stage === 'fingertip' ? 0.022 : 0;
        const gripX = support.x + (support.follow ? f.sk.hip.x : 0); // 体と一緒に動く支えは、股関節からの距離
        if (f.sk.holding.near) {
          expect(dist(f.sk.hand, { x: gripX, y: support.y + lift }), where).toBeLessThan(0.005);
          expect(f.sk.arm.elbow, where).toBeGreaterThan(5); // 腕が伸びきらない（無理なく届く）
        } else {
          expect(f.sk.hand.y, where).toBeLessThan(support.y - 0.02); // 手は体の横に下ろしている
        }
        if (f.sk.holding.far) {
          expect(dist(f.sk.farHand, { x: gripX, y: support.y + (farSide ? lift : 0) }), where).toBeLessThan(0.005);
          expect(f.sk.arm.farElbow, where).toBeGreaterThan(5);
        } else {
          expect(f.sk.farHand.y, where).toBeLessThan(support.y - 0.02);
        }
        for (const [shoulder, elbow] of [
          [f.sk.arm.shoulder, f.sk.arm.elbow],
          [f.sk.arm.farShoulder, f.sk.arm.farElbow],
        ] as const) {
          expect(elbow, where).toBeLessThanOrEqual(145);
          expect(shoulder, where).toBeGreaterThanOrEqual(-50);
          expect(shoulder, where).toBeLessThanOrEqual(180);
        }
      }
    }
    // 手を置く点は、椅子の背の上か、カウンターの上
    if (chair) {
      expect(support.y).toBeCloseTo(chair.backHeight, 6);
      expect(Math.abs(support.x - chair.x)).toBeLessThan(0.025);
    } else {
      const counter = anim.props.find((p) => p.type === 'counter');
      expect(counter && counter.type === 'counter' ? counter.height : null).toBe(support.y);
      expect(farSide).toBe(true);
    }
  });

  it('C：下半身の動きは、支えの段階によらず同じ。体が支持物にぶつからない', () => {
    if (!anim.support || !chair) return;
    const stages = stagesFor(anim);
    const reference = framesOf(anim, stages[0]!);
    for (const stage of stages.slice(1)) {
      framesOf(anim, stage).forEach((f, i) => {
        for (const key of ['hip', 'knee', 'ankle', 'toe', 'farKnee', 'farAnkle', 'farToe', 'head'] as const) {
          expect(dist(f.sk[key], reference[i]!.sk[key]), `${stage} ${key} ${at(f)}`).toBeLessThan(1e-9);
        }
      });
    }
    // 膝やつま先が、椅子の背（柱の手前の面）より前に出ない
    const post = chair.x - 0.012;
    for (const f of reference) {
      for (const p of [f.sk.knee, f.sk.farKnee]) expect(p.x + 0.043, at(f)).toBeLessThan(post);
      for (const p of [f.sk.toe, f.sk.farToe]) expect(p.x + 0.012, at(f)).toBeLessThan(post);
    }
  });

  it('C：支持物（椅子）が常に画面内にある', () => {
    for (const p of anim.props) {
      if (p.type === 'counter') {
        // カウンターは、画面の端から端まで続く
        expect(p.x).toBeLessThanOrEqual(VIEW.minX);
        expect(p.x + p.length).toBeGreaterThanOrEqual(VIEW.maxX);
        expect(p.height).toBeLessThan(VIEW.maxY);
        continue;
      }
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

describe('立って行う種目（レベル2・横向き。仕様との照合）', () => {
  const upright = (f: Frame) => Math.abs(f.sk.shoulder.x - f.sk.hip.x) < 0.01;

  it('S2 かかと上げ：体重を前（親指側）に乗せてから、母趾球を床に付けたまま、両足のかかとを上げる', () => {
    const anim = sideAnim('S2-side-L2');
    const frames = framesOf(anim, 'none');
    const top = frames.reduce((a, b) => (b.sk.heel.y > a.sk.heel.y ? b : a));
    expect(top.sk.heel.y).toBeGreaterThan(0.05);
    expect(top.sk.farHeel.y).toBeCloseTo(top.sk.heel.y, 6);
    expect(top.sk.toe.y).toBeCloseTo(0, 9);
    expect(top.sk.head.y).toBeGreaterThan(frames[0]!.sk.head.y + 0.02); // 体が持ち上がる
    // かかとが床を離れている間、重心は母趾球より前にある（つかまらなくても倒れない）
    for (const f of frames) {
      if (f.sk.heel.y > 0.006) expect(f.com.x, at(f)).toBeGreaterThanOrEqual(f.sk.ball.x);
      expect(f.pose.knee).toBeLessThan(5); // 膝は伸ばしたまま
    }
  });

  it('S3 つま先上げ：両手でつかまり、かかとを床に付けたまま、両足のつま先を上げる', () => {
    const anim = sideAnim('S3-side-L2');
    expect(stagesFor(anim)).toEqual(['both']); // 後ろに倒れないよう、両手でつかまる段階だけ
    const frames = framesOf(anim, 'both');
    const top = frames.reduce((a, b) => (b.sk.toe.y > a.sk.toe.y ? b : a));
    expect(top.sk.toe.y).toBeGreaterThan(0.03);
    expect(top.sk.heel.y).toBeCloseTo(0, 9);
    for (const f of frames) {
      expect(upright(f), at(f)).toBe(true);
      expect(f.sk.holding).toEqual({ near: true, far: true });
    }
  });

  it('S5 膝上げ（足踏み）：左右交互に上げ、支える足は動かず、上体はまっすぐ', () => {
    const anim = sideAnim('S5-side-L2');
    expect(anim.countsPerCycle).toBe(2);
    const frames = framesOf(anim);
    const rest = frames[0]!;
    for (const f of frames) {
      const nearUp = f.sk.knee.y > rest.sk.knee.y + 0.003;
      const farUp = f.sk.farKnee.y > rest.sk.farKnee.y + 0.003;
      expect(nearUp && farUp, at(f)).toBe(false);
      if (nearUp) expect(dist(f.sk.farAnkle, rest.sk.farAnkle), at(f)).toBeLessThan(1e-9);
      if (farUp) expect(dist(f.sk.ankle, rest.sk.ankle), at(f)).toBeLessThan(1e-9);
      expect(upright(f), at(f)).toBe(true);
      expect(dist(f.sk.hip, rest.sk.hip)).toBeLessThan(1e-9);
    }
    expect(Math.max(...frames.map((f) => f.sk.knee.y))).toBeGreaterThan(rest.sk.knee.y + 0.06);
  });

  it('S7 脚の後ろ上げ：片方の脚を後ろへ上げて止める。上体を前に倒さず、腰を反らさない', () => {
    const anim = sideAnim('S7-side-L2');
    const frames = framesOf(anim);
    const rest = frames[0]!;
    const back = frames.reduce((a, b) => (b.sk.ankle.x < a.sk.ankle.x ? b : a));
    expect(rest.sk.ankle.x - back.sk.ankle.x).toBeGreaterThan(0.1); // 足が後ろへ動く
    expect(back.sk.heel.y).toBeGreaterThan(0.02);
    expect(back.pose.hip).toBeGreaterThanOrEqual(-15); // 股関節の伸展の可動域の中
    for (const f of frames) {
      expect(f.pose.spine).toBe(0);
      expect(upright(f), at(f)).toBe(true);
      expect(dist(f.sk.farAnkle, rest.sk.farAnkle)).toBeLessThan(1e-9); // 支える足は動かない
    }
    expect(frames.filter((f) => f.pose.hip < -13.9).length * STEP).toBeGreaterThanOrEqual(0.95); // 止める
  });

  it('W4 ふくらはぎ伸ばし：後ろ足のかかとを床につけたまま、前の膝を曲げて伸ばし、10秒止める', () => {
    const anim = sideAnim('W4-side-L2');
    const frames = framesOf(anim);
    const start = frames[0]!;
    const deep = frames.reduce((a, b) => (b.pose.ankle > a.pose.ankle ? b : a));
    expect(start.sk.farAnkle.x - start.sk.ankle.x).toBeGreaterThan(0.15); // 片足を後ろに引いている
    for (const f of frames) {
      expect(f.sk.heel.y).toBeCloseTo(0, 9); // 後ろ足のかかとは床についたまま
      expect(f.sk.farHeel.y).toBeCloseTo(0, 6);
      expect(f.pose.knee).toBeLessThan(5); // 後ろの膝は伸ばしたまま
      expect(f.pose.ankle).toBeLessThanOrEqual(20 + 1e-9); // 足首の背屈の可動域の中
    }
    expect(deep.pose.farKnee).toBeGreaterThan(start.pose.farKnee + 20); // 前の膝を曲げる
    const held = frames.filter((f) => f.pose.ankle > 19.999);
    expect(held.length * STEP).toBeGreaterThanOrEqual(10);
    expect(held.length * STEP).toBeLessThan(10.2);
  });

  it('B2 足を半歩ずらして立つ：前の足を足の半分だけ前に置き、姿勢を保つ（動かない）', () => {
    const anim = sideAnim('B2-side-L2');
    const frames = framesOf(anim);
    const first = frames[0]!;
    // 前の足のつま先（親指）が、後ろの足の土踏まずの横：足の長さの半分だけずれている
    expect(first.sk.heel.x - first.sk.farHeel.x).toBeCloseTo(0.076, 3);
    for (const f of frames) {
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      expect(f.sk.heel.y).toBeCloseTo(0, 6);
      expect(f.sk.farHeel.y).toBeCloseTo(0, 6);
      expect(f.sk.toe.y).toBeCloseTo(0, 6);
      expect(upright(f)).toBe(true);
    }
  });
});

describe('レベル3の種目（横向き。仕様との照合）', () => {
  it('S1 レベル3：椅子に軽く触れるところまで腰を下ろし、座らずに立つ。腕は体の横', () => {
    const anim = sideAnim('S1-side-L3');
    const chair = anim.props.find((p): p is ChairProp => p.type === 'chair')!;
    const frames = framesOf(anim);
    const low = frames.reduce((a, b) => (b.sk.hip.y < a.sk.hip.y ? b : a));
    for (const f of frames) expect(f.onSeat, at(f)).toBe(false); // 座面に体重を乗せない（足だけで支える）
    // いちばん低いとき、お尻が座面に触れる高さ（座ったときと同じ高さ）まで下りる
    expect(low.sk.hip.y - chair.seatHeight).toBeGreaterThan(0.04);
    expect(low.sk.hip.y - chair.seatHeight).toBeLessThan(0.07);
    expect(low.sk.hip.x).toBeLessThan(chair.x + chair.seatDepth); // 座面の上
    expect(frames[0]!.pose.knee).toBeLessThan(6); // 立った姿勢から始まり、立った姿勢で終わる
    expect(anim.contacts).toBeUndefined();
    expect(anim.support).toBeUndefined();
    // レベル2と同じ姿勢を通る（椅子に触れる姿勢は、レベル2でお尻が離れる姿勢）
    const l2 = sideAnim('S1-side-L2');
    expect(low.pose.hip).toBeCloseTo(computeFrame(l2, 1.6).pose.hip, 6);
  });

  it('S9 ランジ：片足を大きく前へ踏み出し、上体をまっすぐに保って、両膝を曲げて浅く腰を落とし、足を戻す', () => {
    const anim = sideAnim('S9-side-L3');
    const frames = framesOf(anim, 'none');
    const start = frames[0]!;
    const deep = frames.reduce((a, b) => (b.sk.hip.y < a.sk.hip.y ? b : a));
    expect(Math.abs(start.sk.ankle.x - start.sk.farAnkle.x)).toBeLessThan(0.001); // 足をそろえて始める
    expect(deep.sk.ankle.x - start.sk.ankle.x).toBeCloseTo(0.38, 2); // 踏み出す幅（身長160cmで約61cm）
    // いちばん下の形
    expect(Math.abs(deep.sk.knee.x - deep.sk.ankle.x)).toBeLessThan(0.01); // 前の膝が足首の真上（つま先より前に出ない）
    expect(deep.pose.knee).toBeGreaterThan(35);
    expect(deep.pose.knee).toBeLessThan(55); // 浅め（深いランジは90度）
    expect(start.sk.hip.y - deep.sk.hip.y).toBeGreaterThan(0.05);
    expect(start.sk.hip.y - deep.sk.hip.y).toBeLessThan(0.09); // 深くしゃがまない
    expect(deep.sk.hip.x).toBeGreaterThan(deep.sk.farBall.x); // 腰は両足の間
    expect(deep.sk.hip.x).toBeLessThan(deep.sk.heel.x);
    expect(deep.sk.farHeel.y).toBeGreaterThan(0.05); // 後ろの足はかかとが上がる
    expect(deep.pose.farKnee).toBeGreaterThan(50); // 後ろの膝も曲がる
    expect(Math.abs(deep.sk.farKnee.x - deep.sk.hip.x)).toBeLessThan(0.06); // 後ろの膝は、腰のほぼ下へ下りる
    for (const f of frames) {
      expect(f.sk.farBall.y, at(f)).toBeCloseTo(0, 6); // 後ろの足は、母趾球を床に付けたまま
      expect(Math.abs(f.sk.shoulder.x - f.sk.hip.x), at(f)).toBeLessThan(0.03); // 上体はまっすぐ
      // 踏み出した足が浮いている間、重心は「後ろの足」と「次に足を着く所」の間にある
      expect(f.com.x, at(f)).toBeGreaterThan(start.sk.farHeel.x);
      expect(f.com.x, at(f)).toBeLessThan(deep.sk.toe.x);
    }
    // かかとから着く
    const landing = frames.find((f) => f.t > 1 && Math.abs(f.sk.heel.y) < 0.002 && f.sk.ankle.x > start.sk.ankle.x + 0.3)!;
    expect(landing.sk.toe.y).toBeGreaterThan(0.005);
    const end = frames[frames.length - 1]!;
    expect(dist(end.sk.ankle, start.sk.ankle)).toBeLessThan(1e-6); // 足を戻す
    expect(frames.filter((f) => f.sk.hip.y < deep.sk.hip.y + 1e-4).length * STEP).toBeGreaterThanOrEqual(0.45); // 少し止める
  });

  it('B3 足を一直線にして立つ：前の足のかかとを、後ろの足のつま先につけて、姿勢を保つ', () => {
    const frames = framesOf(sideAnim('B3-side-L3'));
    const first = frames[0]!;
    expect(first.sk.heel.x).toBeCloseTo(first.sk.farToe.x, 3); // 前のかかと＝後ろのつま先
    for (const f of frames) {
      expect(dist(f.sk.head, first.sk.head)).toBeLessThan(1e-9);
      for (const p of [f.sk.heel, f.sk.toe, f.sk.farHeel, f.sk.farToe]) expect(p.y).toBeCloseTo(0, 6);
    }
  });

  it('D4 継ぎ足歩き：かかとを、もう片方の足のつま先につけて進む。1往復は8歩（アニメ4周）', () => {
    const anim = sideAnim('D4-side-L3');
    expect(anim.cyclesPerLap).toBe(4);
    expect(anim.floor?.perCycle).toBeCloseTo(2 * 0.152, 6); // 1周で2歩、1歩は足の長さ
    // 足を着いた瞬間（t = 0）、前の足のかかとが、後ろの足のつま先につく
    const landing = computeFrame(anim, 0);
    expect(landing.sk.heel.y).toBeCloseTo(0, 3);
    expect(landing.sk.heel.x).toBeCloseTo(landing.sk.farToe.x, 2);
    const half = computeFrame(anim, anim.cycleSeconds / 2);
    expect(half.sk.farHeel.x).toBeCloseTo(half.sk.toe.x, 2);
    for (const f of framesOf(anim)) {
      expect(f.pose.spine).toBe(0); // 上体はまっすぐ、目線は前
      expect(f.pose.neck).toBe(0);
    }
  });

  it('D2 つま先歩き・かかと歩き：往きはかかとを上げてつま先で歩き、向きを変えて、戻りはつま先を上げてかかとで歩く', () => {
    const anim = sideAnim('D2-side-L3');
    const frames = framesOf(anim);
    expect(anim.cycleSeconds).toBe(16); // 往き 6 秒（4歩）、向きを変える 2 秒、戻り 6 秒（4歩）、向きを変える 2 秒
    const out = frames.filter((f) => f.t > 0.3 && f.t < 5.7);
    const back = frames.filter((f) => f.t > 8.3 && f.t < 13.7);
    for (const f of out) {
      // つま先歩き：どちらの足も、かかとが床から離れている。右向き
      expect(f.sk.heel.y, at(f)).toBeGreaterThan(0.02);
      expect(f.sk.farHeel.y, at(f)).toBeGreaterThan(0.02);
      expect(f.pose.facing, at(f)).toBe(1);
    }
    for (const f of back) {
      // かかと歩き：床についている足は、かかとで踏み、つま先が上がっている。左向き（説明の「戻り」と絵が合う）
      for (const [heel, toe] of [
        [f.sk.heel, f.sk.toe],
        [f.sk.farHeel, f.sk.farToe],
      ] as const) {
        if (Math.abs(heel.y) < 0.0005) expect(toe.y, at(f)).toBeGreaterThan(0.004);
      }
      expect(f.pose.facing, at(f)).toBe(-1);
    }
    expect(Math.max(...back.map((f) => Math.max(f.sk.toe.y, f.sk.farToe.y)))).toBeGreaterThan(0.02);
    // 向きは、向きを変える 2 秒の間だけ、なめらかに変わる（急に裏返らない）
    for (let i = 1; i < frames.length; i++) {
      const d = Math.abs(frames[i]!.pose.facing - frames[i - 1]!.pose.facing);
      if (frames[i]!.t < anim.cycleSeconds) expect(d, at(frames[i]!)).toBeLessThan(0.12);
    }
    // 歩いた距離：往きは増え（0.1 ずつ4歩）、戻りは減って、元の所に戻る
    expect(anim.floor?.perCycle).toBe(0);
    expect(computeFrame(anim, 6).pose.travel).toBeCloseTo(0.4, 3);
    expect(computeFrame(anim, 8).pose.travel).toBeCloseTo(0.4, 3);
    expect(computeFrame(anim, 14).pose.travel).toBeCloseTo(0, 3);
    for (let i = 1; i < frames.length; i++) {
      const d = frames[i]!.pose.travel - frames[i - 1]!.pose.travel;
      if (frames[i]!.t > 0.2 && frames[i]!.t < 5.8) expect(d, at(frames[i]!)).toBeGreaterThan(0);
      if (frames[i]!.t > 8.2 && frames[i]!.t < 13.8) expect(d, at(frames[i]!)).toBeLessThan(0);
    }
    // 膝は伸ばしぎみに歩く：床についている脚の膝は、30 度より深く曲げない（作り直す前は 45 度前後）
    for (const f of [...out, ...back]) {
      if (Math.abs(f.sk.ball.y) < 0.0005 || Math.abs(f.sk.heel.y) < 0.0005) expect(f.pose.knee, at(f)).toBeLessThan(30);
      if (Math.abs(f.sk.farBall.y) < 0.0005 || Math.abs(f.sk.farHeel.y) < 0.0005) expect(f.pose.farKnee, at(f)).toBeLessThan(30);
    }
    // つま先で歩く間は、かかとの分だけ体が高い
    expect(out[0]!.sk.hip.y - back[0]!.sk.hip.y).toBeGreaterThan(0.015);
    // 腕の振り：ふつうの歩行（片側 20 度前後）よりやや小さく、出した足と反対の腕が前へ出る
    const walking = [...out, ...back];
    const range = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(range(walking.map((f) => f.pose.shoulder))).toBeGreaterThan(20);
    expect(range(walking.map((f) => f.pose.shoulder))).toBeLessThanOrEqual(24.001);
    for (const f of walking) {
      expect(f.pose.shoulder + f.pose.farShoulder, at(f)).toBeCloseTo(6, 3); // 左右の腕は、互い違いに振る
      // 手前の脚が前（股関節を曲げている）のとき、手前の腕は後ろ
      if (f.pose.hip - f.pose.farHip > 12) expect(f.pose.shoulder, at(f)).toBeLessThan(f.pose.farShoulder);
      if (f.pose.farHip - f.pose.hip > 12) expect(f.pose.farShoulder, at(f)).toBeLessThan(f.pose.shoulder);
    }
    // つかまらない手前の腕は、絵の上でも振れている（奥の手はカウンターに置いたまま）
    const hands = out.map((f) => computeFrame(anim, f.t, 'one').sk.hand.x);
    expect(range(hands)).toBeGreaterThan(0.08);
    expect(stagesFor(anim)).toEqual(['one']); // 常につかまる。カウンターの横なので片手
  });

  it('向きを変える途中は、横向きの人物を薄くして後ろ姿に入れ替える（線のように細くはしない）', () => {
    expect(sideFigureAlpha(1)).toBe(1);
    expect(sideFigureAlpha(-1)).toBe(1);
    expect(sideFigureAlpha(0.9)).toBe(1); // 向きを変え始めは、横向きのまま
    expect(sideFigureAlpha(0.5)).toBe(0); // 途中は後ろ姿だけ
    expect(sideFigureAlpha(0)).toBe(0);
    expect(sideFigureAlpha(-0.5)).toBe(0);
    for (let v = 0; v < 1; v += 0.01) expect(sideFigureAlpha(v + 0.01)).toBeGreaterThanOrEqual(sideFigureAlpha(v));
    // D2：向きを変える 2 秒のうち、後ろ姿だけが見える時間が 0.5 秒以上ある（一瞬で入れ替わらない）
    const anim = sideAnim('D2-side-L3');
    const backOnly = framesOf(anim).filter((f) => f.t > 6 && f.t < 8 && sideFigureAlpha(f.pose.facing) === 0);
    expect(backOnly.length * STEP).toBeGreaterThan(0.5);
    // 後ろ姿の腕は、見ている側から奥のカウンターへ伸びている。肩は元の色、手へ行くにつれて少しだけ薄くする
    // （横から見たときの奥側の腕の色に近づけるが、同じ薄さまではしない）
    expect(mixColor(STYLE.top, STYLE.topFar, 0)).toBe('rgb(63, 111, 143)');
    expect(mixColor(STYLE.top, STYLE.topFar, 1)).toBe('rgb(142, 170, 189)');
    expect(FAR_FADE).toBeGreaterThan(0.3);
    expect(FAR_FADE).toBeLessThan(1);
    // 後ろ姿は、足をそろえて立ち、両手でカウンター（上の面の高さ 0.54）を握っている。
    // 手の中心はカウンターの上の面より少し上で、手の下のほうだけがカウンターに隠れる（半分より多く見える）
    const counter = anim.props.find((p) => p.type === 'counter')!;
    expect(counter.height).toBe(0.54);
    const sk = solveFront(TURN_POSE, { view: 'back', root: { mode: 'stand', x: 0, y: 0.5202 } });
    for (const side of ['r', 'l'] as const) {
      expect(sk[side].hand.y).toBeGreaterThan(counter.height + 0.003);
      expect(sk[side].hand.y - 0.025).toBeLessThan(counter.height - 0.01); // 手の下の端は、カウンターの上の面より下
      expect(Math.abs(sk[side].heel.y)).toBeLessThan(0.01);
    }
  });

  it('D5 後ろ歩き：往きは後ろへ4歩、戻りは前を向いたまま前へ4歩で、元の所に戻る', () => {
    const anim = sideAnim('D5-side-L3');
    const frames = framesOf(anim);
    const half = anim.cycleSeconds / 2;
    const farthest = frames.reduce((a, b) => (b.pose.travel < a.pose.travel ? b : a));
    expect(farthest.pose.travel).toBeCloseTo(-0.4, 3); // 後ろへ 0.1 ずつ4歩
    expect(farthest.t).toBeCloseTo(half, 1);
    expect(anim.floor?.perCycle).toBe(0);
    for (let i = 1; i < frames.length; i++) {
      const d = frames[i]!.pose.travel - frames[i - 1]!.pose.travel;
      if (frames[i]!.t < half - 0.2 && frames[i]!.t > 0.2) expect(d, at(frames[i]!)).toBeLessThan(0); // 後ろへ
      if (frames[i]!.t > half + 0.2 && frames[i]!.t < anim.cycleSeconds - 0.2) expect(d, at(frames[i]!)).toBeGreaterThan(0); // 前へ
    }
    for (const f of frames) expect(f.pose.spine).toBe(0);
  });

  it.each(['S9-side-L3', 'D2-side-L3', 'D4-side-L3', 'D5-side-L3'])('%s：カウンターは体の向こう側。奥の手だけでつかまり、両手の指定でも片手で行う', (id) => {
    const anim = sideAnim(id);
    expect(anim.support?.hand).toBe('far');
    expect(anim.props.some((p) => p.type === 'counter')).toBe(true);
    expect(stagesFor(anim)[0]).toBe('one');
    const variant = getExercise(anim.exercise).variants.find((v) => v.level === 3)!;
    expect(variant.maxSupport).toBe('one');
  });
});
