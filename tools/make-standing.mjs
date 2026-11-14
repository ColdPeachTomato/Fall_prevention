// 立って行うレベル2の種目のキーフレームを作る。
// 横向き：S2・S3・S5・S7・W4・B2（つかまる所は体の前）
// 正面　：W1・S6・B1・D3（つかまる所は体の横。両手のときだけ体の前に薄く描く。D3 はいつも前のカウンター）
// 後ろ　：S8（つかまらない。椅子は横に置く）
// 下半身のキーフレームは支えの段階によらず共通で、腕だけが段階に合わせて支持物に付く。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tidyCaptions } from './captions.mjs';

const outDir = process.argv[2];
const RAD = Math.PI / 180;
const round = (v) => Math.round(v * 10000) / 10000;
const save = [];

// ── 横向き ──────────────────────────────────────────────────
const ROOT_X = -0.17; // 足首の位置
const HIP_Y = 0.53; // まっすぐ立ったときの股関節の高さ
const sideChair = (x) => ({ type: 'chair', x, seatHeight: 0.242, seatDepth: 0.22, backHeight: 0.54 });
const sideSupport = (chairX) => ({ x: round(chairX - 0.01), y: 0.54 });
const base = { ankle: 0, knee: 0, hip: 0, spine: 0, neck: 0, shoulder: 3, elbow: 8 };
const skf = (t, pose, label) => ({ t, pose, label });
const sideCommon = (id, exercise, extra) => ({ id, exercise, level: 2, view: 'side', checked: false, ...extra });
const UPRIGHT_LINE = (to) => ({ type: 'line', from: 0, to, anchor: 'hip', dx: 0, dy: 0.3, angle: 0, length: 0.72 });

// S2 かかと上げ（立って）：母趾球を床に付けたまま、かかとを上げる。体重は前（親指側）に乗る
{
  const ball = round(ROOT_X + 0.08);
  // かかとを上げる前に、体重を前（親指側）へ移す。かかとが床を離れた後は、母趾球とつま先だけで支える
  const stand = { ...base, footPitch: 0, ankle: 4 };
  const forward = { ...base, footPitch: 0, ankle: 9.5 };
  const up = { ...base, footPitch: 30, ankle: -22.5 };
  save.push({
    ...sideCommon('S2-side-L2', 'S2', { cycleSeconds: 5.7 }),
    root: { x: ROOT_X },
    plants: { near: { pivot: 'ball', x: ball }, far: { pivot: 'ball', x: ball } },
    props: [sideChair(0.08)],
    support: sideSupport(0.08),
    highlight: ['shank', 'foot'],
    keyframes: [
      skf(0, stand, 'まっすぐ立つ'),
      skf(0.3, stand, '動き始め'),
      skf(1, forward, '体重を前に乗せる'),
      skf(2.6, up, 'かかとを上げる'),
      skf(3.1, up, '下ろし始め'),
      skf(4.7, forward, 'かかとを下ろす'),
      skf(5.4, stand, '体重を戻す'),
    ],
    captions: [
      { from: 0, to: 0.3, text: 'つかまる所の前に、まっすぐ立ちます' },
      { from: 0.3, to: 3.1, text: '親指側に体重を乗せ、かかとを上げます' },
      { from: 3.1, to: 5.7, text: 'ゆっくり下ろします' },
    ],
    marks: [
      { type: 'arrow', from: 1, to: 2.6, anchor: 'heel', dx: -0.05, dy: 0.01, angle: 0, length: 0.09 },
      { type: 'arrow', from: 3.2, to: 4.7, anchor: 'heel', dx: -0.05, dy: 0.1, angle: 180, length: 0.09 },
    ],
  });
}

// S3 つま先上げ（立って）：かかとを床に付けたまま、つま先を上げる。後ろに倒れないよう両手でつかまる
{
  const heel = round(ROOT_X - 0.042);
  const up = { ...base, footPitch: -15, ankle: 15 };
  save.push({
    ...sideCommon('S3-side-L2', 'S3', { cycleSeconds: 5 }),
    root: { x: ROOT_X },
    plants: { near: { pivot: 'heel', x: heel }, far: { pivot: 'heel', x: heel } },
    props: [sideChair(0.08)],
    support: sideSupport(0.08),
    highlight: ['foot'],
    keyframes: [
      skf(0, { ...base, footPitch: 0 }, 'まっすぐ立つ'),
      skf(0.3, { ...base, footPitch: 0 }, '動き始め'),
      skf(2.3, up, 'つま先を上げる'),
      skf(2.8, up, '下ろし始め'),
      skf(4.8, { ...base, footPitch: 0 }, '下ろす'),
    ],
    captions: [
      { from: 0, to: 0.3, text: '両手でつかまって、まっすぐ立ちます' },
      { from: 0.3, to: 2.8, text: 'つま先をゆっくり上げます' },
      { from: 2.8, to: 5, text: 'ゆっくり下ろします' },
    ],
    marks: [
      { type: 'arrow', from: 0.3, to: 2.3, anchor: 'toe', dx: 0.03, dy: 0.02, angle: 0, length: 0.08 },
      { type: 'arrow', from: 2.9, to: 4.8, anchor: 'toe', dx: 0.03, dy: 0.1, angle: 180, length: 0.08 },
    ],
  });
}

// S5 膝上げ（足踏み・立って）：左右交互に膝を上げる。上体はまっすぐ
{
  const far = { farAnkle: 0, farKnee: 0, farHip: 0 };
  const rest = { ...base, ...far };
  // 上げた足は床と平行に保つ（つま先が先に下がらない）。膝とつま先が、前の椅子に当たらない高さにする
  const nearUp = { ...base, hip: 45, knee: 62, ankle: 15, ...far };
  const farUp = { ...base, farHip: 45, farKnee: 62, farAnkle: 15 };
  save.push({
    ...sideCommon('S5-side-L2', 'S5', { cycleSeconds: 9.6, countsPerCycle: 2 }),
    root: { mode: 'hip', x: ROOT_X, y: HIP_Y, pelvis: 0 },
    props: [sideChair(0.09)],
    support: sideSupport(0.09),
    highlight: ['thigh', 'shank'],
    keyframes: [
      skf(0, rest, 'まっすぐ立つ'),
      skf(0.2, rest, '手前の膝を上げ始める'),
      skf(2.2, nearUp, '手前の膝を上げる'),
      skf(2.5, nearUp, '手前を下ろし始める'),
      skf(4.5, rest, '手前を下ろす'),
      skf(5, rest, '奥の膝を上げ始める'),
      skf(7, farUp, '奥の膝を上げる'),
      skf(7.3, farUp, '奥を下ろし始める'),
      skf(9.3, rest, '奥を下ろす'),
    ],
    captions: [
      { from: 0, to: 0.2, text: 'つかまる所の前に、まっすぐ立ちます' },
      { from: 0.2, to: 2.5, text: '片方の膝をゆっくり上げます' },
      { from: 2.5, to: 4.8, text: 'ゆっくり下ろします' },
      { from: 4.8, to: 7.3, text: '反対の膝をゆっくり上げます' },
      { from: 7.3, to: 9.6, text: 'ゆっくり下ろします' },
    ],
    marks: [
      UPRIGHT_LINE(9.6),
      { type: 'arrow', from: 0.2, to: 2.2, anchor: 'knee', dx: -0.02, dy: 0.07, angle: 0, length: 0.08 },
      { type: 'arrow', from: 5, to: 7, anchor: 'farKnee', dx: -0.02, dy: 0.07, angle: 0, length: 0.08 },
    ],
  });
}

// S7 脚の後ろ上げ：片方の脚を、膝をほぼ伸ばしたまま後ろへ上げる。上体は前に倒さず、腰を反らさない
{
  const far = { farAnkle: 0, farKnee: 0, farHip: 0 };
  const rest = { ...base, ...far };
  const up = { ...base, hip: -14, knee: 8, ankle: 14, ...far };
  save.push({
    ...sideCommon('S7-side-L2', 'S7', { cycleSeconds: 6 }),
    root: { mode: 'hip', x: ROOT_X, y: HIP_Y, pelvis: 0 },
    props: [sideChair(0.08)],
    support: sideSupport(0.08),
    highlight: ['near:thigh', 'near:shank', 'near:foot'],
    keyframes: [
      skf(0, rest, 'まっすぐ立つ'),
      skf(0.3, rest, '動き始め'),
      skf(2.5, up, '後ろへ上げる'),
      skf(3.5, up, '止める（下ろし始め）'),
      skf(5.7, rest, '下ろす'),
    ],
    captions: [
      { from: 0, to: 0.3, text: 'つかまる所の前に、まっすぐ立ちます' },
      { from: 0.3, to: 2.5, text: '片方の脚を、ゆっくり後ろへ上げます' },
      { from: 2.5, to: 3.5, text: '上げたまま止めます' },
      { from: 3.5, to: 6, text: 'ゆっくり下ろします' },
    ],
    marks: [
      UPRIGHT_LINE(6),
      { type: 'arrow', from: 0.3, to: 2.4, anchor: 'heel', dx: -0.04, dy: 0.02, angle: -70, length: 0.09 },
    ],
  });
}

// W4 ふくらはぎ伸ばし：片足を後ろに引き、かかとを床につけたまま、前の膝を曲げて伸ばし、10秒止める
{
  const backFoot = -0.33; // 後ろ足（手前側。伸ばす側）の足首
  const stride = 0.2;
  const chairX = round(backFoot + 0.35);
  const start = { ...base, ankle: 12, hip: -7 };
  const stretch = { ...base, ankle: 20, hip: -13 };
  const HOLD = 10;
  save.push({
    ...sideCommon('W4-side-L2', 'W4', { cycleSeconds: 5.6 + HOLD }),
    root: { x: backFoot },
    plants: { far: { pivot: 'heel', x: round(backFoot + stride - 0.042) } },
    props: [sideChair(chairX)],
    support: sideSupport(chairX),
    highlight: ['near:shank'],
    keyframes: [
      skf(0, start, '片足を後ろに引いて立つ'),
      skf(0.3, start, '動き始め'),
      skf(2.8, stretch, '前の膝を曲げて伸ばす'),
      skf(2.8 + HOLD, stretch, '止める（戻し始め）'),
      skf(5.3 + HOLD, start, '戻す'),
    ],
    captions: [
      { from: 0, to: 0.3, text: '片足を後ろに引き、かかとを床につけます' },
      { from: 0.3, to: 2.8, text: '前の膝を曲げ、ふくらはぎを伸ばします' },
      { from: 2.8, to: 2.8 + HOLD, text: '反動をつけず、そのまま10秒止めます' },
      { from: 2.8 + HOLD, to: 5.6 + HOLD, text: 'ゆっくり戻します' },
    ],
    marks: [{ type: 'arrow', from: 0.3, to: 2.8 + HOLD, anchor: 'heel', dx: -0.035, dy: 0.1, angle: 180, length: 0.075 }],
  });
}

// B2 足を半歩ずらして立つ：前の足の親指を、後ろの足の土踏まずの横に置き、そのまま保つ
{
  const frontHeel = -0.174;
  const half = 0.076; // 足の長さの半分
  const pose = { ...base };
  save.push({
    ...sideCommon('B2-side-L2', 'B2', { cycleSeconds: 4 }),
    root: { mode: 'hip', x: round(frontHeel + 0.042 - half / 2), y: 0.527, pelvis: 0 },
    plants: { near: { pivot: 'heel', x: frontHeel }, far: { pivot: 'heel', x: round(frontHeel - half) } },
    props: [sideChair(0.08)],
    support: sideSupport(0.08),
    highlight: ['foot'],
    keyframes: [skf(0, pose, '足を半歩ずらして立つ'), skf(2, pose, 'そのまま保つ')],
    captions: [{ from: 0, to: 4, text: '前の足の親指を、後ろの足の土踏まずの横に置きます' }],
    marks: [UPRIGHT_LINE(4)],
  });
}

// ── 正面・後ろ向き ──────────────────────────────────────────
const LEG = 0.491; // 太もも＋すね
const UP = -0.98; // 立った脚の、上への成分（わずかな余裕を持たせる）
const STAND_Y = round(0.039 + LEG * -UP);
const HIP_HALF = 0.08;
const FOOT = 0.055; // 立ったときの足の位置（体の中心から）
// 股関節から足までの向き。sign：右 +1、左 -1。shift：骨盤の横への移動
const legOut = (footX, shift, sign) => round(((footX - (shift + sign * HIP_HALF)) * sign) / LEG);
const leg = (side, out, up = UP) => ({ [`${side}KneeOut`]: out, [`${side}KneeUp`]: up, [`${side}AnkleOut`]: out, [`${side}AnkleUp`]: up });
const fkf = (t, pose, label) => ({ t: round(t), pose, label });
const frontCommon = (id, exercise, view, viewBox, extra) => ({
  id,
  exercise,
  level: 2,
  view,
  checked: false,
  ...extra,
  root: { mode: 'stand', x: 0, y: STAND_Y },
  viewBox,
});
const chairAt = (x, extra) => ({ type: 'chair', x, width: 0.3, seatHeight: 0.242, backHeight: 0.54, ...extra });
// つかまる所：片手・指先・なしのときは体の左横の椅子、両手のときは体の前の椅子（薄く描く）
const SIDE_CHAIR_X = -0.44;
const supportProps = (center) => [chairAt(SIDE_CHAIR_X, { showFor: ['one', 'fingertip', 'none'] }), chairAt(center, { showFor: ['both'], inFront: true })];
const supportPoints = (center) => ({ hand: 'l', side: { x: SIDE_CHAIR_X + 0.14, y: 0.54 }, front: { x: center, half: 0.1, y: 0.54 } });
const TOES = { rToeOut: 0.1, rToeUp: 0 };
const fullBox = (minX, maxX) => ({ minX, maxX, minY: -0.075, maxY: 1.06 });

// B1 足をそろえて立つ：そのまま保つ
{
  const pose = { ...leg('r', legOut(0.03, 0, 1)), ...TOES };
  save.push({
    ...frontCommon('B1-front-L2', 'B1', 'front', fullBox(-0.62, 0.34), { cycleSeconds: 4 }),
    support: supportPoints(0),
    props: supportProps(0),
    highlight: ['foot'],
    keyframes: [fkf(0, pose, '足をそろえて立つ'), fkf(2, pose, 'そのまま保つ')],
    captions: [{ from: 0, to: 4, text: '足をそろえて立ちます。ふらついたら、つかまります' }],
    marks: [{ type: 'line', from: 0, to: 4, anchor: 'pelvis', dx: 0, dy: 0.1, angle: 0, length: 1.0 }],
  });
}

// 片脚で支える種目：体重を左足に乗せる（骨盤を左へ寄せる）
const WEIGHT_SHIFT = -0.06;
const stanceLeft = { shift: WEIGHT_SHIFT, ...leg('l', legOut(-FOOT, WEIGHT_SHIFT, -1)), lToeOut: 0.1, lToeUp: 0 };

// S6 脚の横上げ：骨盤を水平に保ち、上体を傾けずに、片方の脚を横へ上げる
{
  const ABDUCT = 28;
  const rest = { ...stanceLeft, ...leg('r', legOut(FOOT, WEIGHT_SHIFT, 1)), ...TOES };
  const up = { ...stanceLeft, ...leg('r', round(Math.sin(ABDUCT * RAD)), round(-Math.cos(ABDUCT * RAD))), ...TOES };
  save.push({
    ...frontCommon('S6-front-L2', 'S6', 'front', fullBox(-0.62, 0.36), { cycleSeconds: 6 }),
    support: supportPoints(WEIGHT_SHIFT),
    props: supportProps(WEIGHT_SHIFT),
    highlight: ['r:thigh', 'r:shank', 'r:foot'],
    keyframes: [
      fkf(0, rest, '体重を反対の足に乗せて立つ'),
      fkf(0.3, rest, '動き始め'),
      fkf(2.5, up, '横へ上げる'),
      fkf(3.5, up, '止める（下ろし始め）'),
      fkf(5.7, rest, '下ろす'),
    ],
    captions: [
      { from: 0, to: 0.3, text: 'つかまる所のそばに、まっすぐ立ちます' },
      { from: 0.3, to: 2.5, text: '片方の脚を、ゆっくり横へ上げます' },
      { from: 2.5, to: 3.5, text: '上げたまま止めます。上体は傾けません' },
      { from: 3.5, to: 6, text: 'ゆっくり下ろします' },
    ],
    marks: [
      { type: 'line', from: 0, to: 6, anchor: 'lumbar', dx: 0, dy: 0, angle: 90, length: 0.36 },
      { type: 'arrow', from: 0.3, to: 2.4, anchor: 'r.ankle', dx: 0.06, dy: 0.02, angle: 65, length: 0.09 },
    ],
  });
}

// W1 足首回し（立って）：体重を反対の足に乗せ、片足を少し前に出して、かかとを床につけたまま、つま先で円を描く
{
  const CYCLE = 3;
  const NAMES = ['つま先を下げる', '内へ', '内から上へ', '上へ', '上から外へ', '外へ', '外から下へ', '下へ'];
  const keys = [];
  for (let i = 0; i < 8; i++) {
    const theta = 180 + 45 * i; // 0：上、90：外、180：下、270：内
    keys.push(
      fkf(
        (CYCLE * i) / 8,
        { ...stanceLeft, rKneeOut: 0.05, rKneeUp: -0.96, rToeOut: round(0.3 * Math.sin(theta * RAD)), rToeUp: round(0.2 + 0.18 * Math.cos(theta * RAD)) },
        NAMES[i],
      ),
    );
  }
  save.push({
    ...frontCommon('W1-front-L2', 'W1', 'front', fullBox(-0.62, 0.34), { cycleSeconds: CYCLE }),
    plants: { r: { x: FOOT } },
    support: supportPoints(WEIGHT_SHIFT),
    props: supportProps(WEIGHT_SHIFT),
    highlight: ['r:foot'],
    keyframes: keys,
    posture: 'つかまる所のそばに立ち、体重を反対の足に乗せます',
    captions: [{ from: 0, to: CYCLE, text: 'かかとを床につけたまま、つま先で外へ円を描きます' }],
    reverseCaptions: [{ from: 0, to: CYCLE, text: 'かかとを床につけたまま、つま先で内へ円を描きます' }],
    marks: [{ type: 'arc', from: 0, to: CYCLE, anchor: 'r.heel', dx: 0, dy: 0.045, radius: 0.085, start: -75, sweep: 150 }],
  });
}

// D3 横歩き（カウンター沿い）：カウンターに向かい、足を交差させずに、小さく横へ。右へ3歩、左へ3歩で1往復
{
  const STEP = 0.1; // 1歩の幅
  const STEPS = 3;
  const MOVE = 1; // 足を1回動かす時間
  const JOIN = 0.05; // 出す足と寄せる足の間
  const PAUSE = 0.2; // 1歩ごとの間
  const LIFT = -0.955; // 動かす足を、床から少し浮かせる
  const startX = -0.15;
  const pose = (shift, footL, footR, liftL, liftR) => ({
    shift: round(shift),
    ...leg('r', legOut(footR, shift, 1), liftR ? LIFT : UP),
    ...leg('l', legOut(footL, shift, -1), liftL ? LIFT : UP),
    ...TOES,
    lToeOut: 0.1,
    lToeUp: 0,
  });
  const keys = [];
  let t = 0;
  let shift = startX;
  let footL = startX - FOOT;
  let footR = startX + FOOT;
  const addStep = (dir) => {
    // 進む側の足を出す → 反対の足を寄せる
    const lead = dir > 0 ? 'r' : 'l';
    const d = dir * STEP;
    const name = dir > 0 ? '右' : '左';
    keys.push(fkf(t, pose(shift, footL, footR, false, false), `${name}へ：足を出し始める`));
    const l1 = lead === 'l' ? footL + d : footL;
    const r1 = lead === 'r' ? footR + d : footR;
    keys.push(fkf(t + MOVE / 2, pose(shift + d / 4, (footL + l1) / 2, (footR + r1) / 2, lead === 'l', lead === 'r'), `${name}へ：足を出す（途中）`));
    keys.push(fkf(t + MOVE, pose(shift + d / 2, l1, r1, false, false), `${name}へ：足を出した`));
    t += MOVE + JOIN;
    keys.push(fkf(t, pose(shift + d / 2, l1, r1, false, false), `${name}へ：足を寄せ始める`));
    const l2 = lead === 'l' ? l1 : l1 + d;
    const r2 = lead === 'r' ? r1 : r1 + d;
    keys.push(fkf(t + MOVE / 2, pose(shift + (d * 3) / 4, (l1 + l2) / 2, (r1 + r2) / 2, lead !== 'l', lead !== 'r'), `${name}へ：足を寄せる（途中）`));
    keys.push(fkf(t + MOVE, pose(shift + d, l2, r2, false, false), `${name}へ：足を寄せた`));
    t += MOVE + PAUSE;
    shift += d;
    footL = l2;
    footR = r2;
  };
  for (let i = 0; i < STEPS; i++) addStep(1);
  const turn = t;
  for (let i = 0; i < STEPS; i++) addStep(-1);
  const cycle = round(t);
  save.push({
    ...frontCommon('D3-front-L2', 'D3', 'front', fullBox(-0.48, 0.48), { cycleSeconds: cycle }),
    support: { hand: 'l', front: { x: 0, half: 0.1, y: 0.54, follow: true } },
    props: [{ type: 'counter', x: 0, width: 0.9, height: 0.54, inFront: true }],
    highlight: ['thigh', 'shank', 'foot'],
    keyframes: keys,
    captions: [
      { from: 0, to: round(turn), text: 'カウンターに向かい、小さく右へ進みます' },
      { from: round(turn), to: cycle, text: '足を交差させず、小さく左へ戻ります' },
    ],
    marks: [
      { type: 'arrow', from: 0, to: round(turn - PAUSE), anchor: 'head', dx: 0.09, dy: 0, angle: 90, length: 0.1 },
      { type: 'arrow', from: round(turn), to: round(cycle - PAUSE), anchor: 'head', dx: -0.09, dy: 0, angle: -90, length: 0.1 },
    ],
  });
}

// S8 肩甲骨寄せ（バンド。立って、後ろから見る）：つかまらずに行う。つかまる所はすぐ横に置く
{
  const DOWN = 12;
  const SPREAD = 55;
  const legs = { ...leg('r', legOut(FOOT, 0, 1)), ...TOES };
  const band = (alpha, scapula) => {
    const out = round(Math.sin(alpha * RAD) * Math.cos(DOWN * RAD));
    const up = round(-Math.sin(DOWN * RAD));
    // 前に伸ばした腕は奥（負）。肘が手より手前なので、腕が拳に少し重なる（座って行うレベル1と同じ）
    const forward = Math.cos(alpha * RAD) * Math.cos(DOWN * RAD);
    return { ...legs, scapula, rElbowOut: out, rElbowUp: up, rElbowDepth: round(-forward * 0.4), rHandOut: out, rHandUp: up, rHandDepth: round(-forward) };
  };
  save.push({
    ...frontCommon('S8-back-L2', 'S8', 'back', fullBox(-0.58, 0.47), { cycleSeconds: 8 }),
    props: [chairAt(-0.42, { width: 0.26 }), { type: 'band' }],
    highlight: ['upperArm', 'forearm', 'scapula'],
    keyframes: [
      fkf(0, band(0, 0), 'バンドを肩幅に持つ'),
      fkf(0.3, band(0, 0), '引き始め'),
      fkf(2.7, band(SPREAD, 1), '引き広げる'),
      fkf(5.2, band(SPREAD, 1), '止める（戻し始め）'),
      fkf(7.6, band(0, 0), '戻す'),
    ],
    captions: [
      { from: 0, to: 0.3, text: 'まっすぐ立ち、バンドを胸の前で持ちます' },
      { from: 0.3, to: 2.7, text: '肘を伸ばしたまま、左右に引き広げます' },
      { from: 2.7, to: 5.2, text: '肩甲骨を寄せて止めます。肩は上げません' },
      { from: 5.2, to: 8, text: 'ゆっくり戻します' },
    ],
    marks: [
      { type: 'line', from: 0, to: 8, anchor: 'chest', dx: 0, dy: 0.055, angle: 90, length: 0.62 },
      { type: 'arrow', from: 0.3, to: 2.6, anchor: 'r.hand', dx: 0.03, dy: -0.07, angle: 90, length: 0.09 },
      { type: 'arrow', from: 0.3, to: 2.6, anchor: 'l.hand', dx: -0.03, dy: -0.07, angle: -90, length: 0.09 },
    ],
  });
}

for (const anim of save) {
  writeFileSync(join(outDir, `${anim.id}.json`), JSON.stringify(tidyCaptions(anim), null, 2) + '\n');
  console.log(anim.id, anim.view, anim.keyframes.length, 'keyframes', anim.cycleSeconds, 's');
}
