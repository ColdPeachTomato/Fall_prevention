// レベル3の種目のキーフレームを作る。
// 横向き：S1（座らずに立つ）、S9（ランジ）、B3（足を一直線にして立つ）、D2・D4・D5（カウンターに沿って歩く）
// 正面　：B4（片足で立つ）、D1（足先タッチ）
// 歩く種目は、その場の足の運びで見せ、床の目印を流して進んでいることを表す（travel）。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tidyCaptions } from './captions.mjs';

const outDir = process.argv[2];
const RAD = Math.PI / 180;
const round = (v) => Math.round(v * 10000) / 10000;
const save = [];

// 寸法（bodyModel.ts と同じ値）
const THIGH = 0.245;
const SHANK = 0.246;
const ANKLE_H = 0.039;
const HEEL_BACK = 0.042;
const BALL_FRONT = 0.08;
const dir = (deg) => ({ x: Math.sin(deg * RAD), y: Math.cos(deg * RAD) });

// 足の裏の基準点（足首の真下）と足の傾きから、足首の位置を求める。
// pitch > 0：かかとを上げる（母趾球が支点）。pitch < 0：つま先を上げる（かかとが支点）。lift：床から浮かせる高さ
function ankleOf(soleX, pitch, lift = 0) {
  const u = dir(90 + pitch);
  const v = { x: -u.y, y: u.x };
  if (pitch > 0) return { x: soleX + BALL_FRONT - u.x * BALL_FRONT + v.x * ANKLE_H, y: lift - u.y * BALL_FRONT + v.y * ANKLE_H };
  if (pitch < 0) return { x: soleX - HEEL_BACK + u.x * HEEL_BACK + v.x * ANKLE_H, y: lift + u.y * HEEL_BACK + v.y * ANKLE_H };
  return { x: soleX, y: ANKLE_H + lift };
}

// 股関節 H と足首 A を結ぶ脚の関節角度（膝は前に出る）。phi：骨盤の前傾、pitch：足の傾き
function legAngles(H, A, phi, pitch) {
  const dx = A.x - H.x;
  const dy = A.y - H.y;
  const d = Math.min(THIGH + SHANK - 1e-6, Math.hypot(dx, dy));
  let toAnkle = Math.atan2(dx, dy) / RAD;
  if (toAnkle < 0) toAnkle += 360;
  const alpha = Math.acos((THIGH * THIGH + d * d - SHANK * SHANK) / (2 * THIGH * d)) / RAD;
  const interior = Math.acos((THIGH * THIGH + SHANK * SHANK - d * d) / (2 * THIGH * SHANK)) / RAD;
  const thighDown = toAnkle - alpha;
  const knee = 180 - interior;
  return { hip: round(phi + 180 - thighDown), knee: round(knee), ankle: round(thighDown + knee - 180 - pitch) };
}

const ARMS = { spine: 0, neck: 0, shoulder: 3, elbow: 8 };
const skf = (t, pose, label) => ({ t: round(t), pose, label });
const sideCommon = (id, exercise, extra) => ({ id, exercise, level: 3, view: 'side', checked: false, ...extra });
const UPRIGHT_LINE = (to) => ({ type: 'line', from: 0, to, anchor: 'hip', dx: 0, dy: 0.3, angle: 0, length: 0.72 });
const COUNTER = { type: 'counter', x: -0.42, length: 0.8, height: 0.54 };

// ── S1 椅子からの立ち座り（レベル3）：椅子に軽く触れるところまで腰を下ろし、座らずに立つ ──
{
  // 姿勢はレベル2と同じ（立つ → 腰を下ろす途中 → お尻が座面に触れる）。座面には体重を乗せない
  const l2 = JSON.parse(readFileSync(join(outDir, 'S1-side-L2.json'), 'utf8'));
  const poseAt = (t) => l2.keyframes.find((k) => k.t === t).pose;
  const stand = poseAt(3.3);
  const mid = poseAt(4.5);
  const low = poseAt(5);
  const touch = poseAt(5.5);
  save.push({
    ...sideCommon('S1-side-L3', 'S1', { cycleSeconds: 6 }),
    root: l2.root,
    props: l2.props,
    highlight: ['thigh', 'shank'],
    keyframes: [
      skf(0, stand, '椅子の前に立つ'),
      skf(0.3, stand, '動き始め'),
      skf(1.35, mid, '腰を下ろす 1'),
      skf(2.1, low, '腰を下ろす 2'),
      skf(2.85, touch, '椅子に軽く触れる'),
      skf(3.15, touch, '立ち上がり始め'),
      skf(3.9, low, '立ち上がり 1'),
      skf(4.65, mid, '立ち上がり 2'),
      skf(5.7, stand, '立つ'),
    ],
    posture: '椅子のすぐ前に立ちます',
    captions: [
      { from: 0, to: 3.15, text: '椅子に軽く触れるまで、ゆっくり腰を下ろします' },
      { from: 3.15, to: 6, text: '座らずに、そのまま立ち上がります' },
    ],
    marks: [
      { type: 'arrow', from: 0.3, to: 2.8, anchor: 'hip', dx: -0.13, dy: 0.02, angle: 180, length: 0.11 },
      { type: 'arrow', from: 3.2, to: 5.6, anchor: 'head', dx: 0.02, dy: 0.1, angle: 0, length: 0.11 },
    ],
  });
}

// ── S9 ランジ（浅め）：1回ごとに片足を大きく前へ踏み出し、両膝を曲げて浅く腰を落とし、前の足で押して戻る ──
// 形のよりどころ（一般的なランジの指導内容）：
//  ・歩幅は、前の膝が足首の真上に来る（つま先より前に出ない）長さにする。歩幅が短いと、前の膝が前へ出てしまう
//  ・上体はまっすぐ。腰は両足の間に、まっすぐ下ろす
//  ・後ろの足はかかとを上げ、後ろの膝は腰の下へ下ろす
//  ・戻るときは、前の足（かかと）で床を押す
// 高齢者向けの浅い形として、前の膝の曲げは約45度（深いランジは90度）にとどめる
{
  const R = -0.3; // 後ろに残る足（奥側）の足首
  const STRIDE = 0.38; // 踏み出す幅（身長160cmで約61cm）
  // 腰の位置（R から）、骨盤の前傾、後ろ足のかかとの上げ具合、前足の位置・傾き・浮かせる高さ
  const pose = (hx, hy, phi, backPitch, frontX, frontPitch, frontLift) => {
    const H = { x: R + hx, y: hy };
    const back = legAngles(H, ankleOf(R, backPitch), phi, backPitch);
    const front = legAngles(H, ankleOf(R + frontX, frontPitch, frontLift), phi, frontPitch);
    for (const [name, a] of [['後ろ', back], ['前', front]]) {
      if (a.ankle > 20 || a.ankle < -45 || a.hip < -15 || a.knee > 130) throw new Error(`S9：${name}の脚の角度が可動域を超えています ${JSON.stringify(a)}`);
    }
    return { ...ARMS, hip: front.hip, knee: front.knee, ankle: front.ankle, farHip: back.hip, farKnee: back.knee, farAnkle: back.ankle, farFootPitch: backPitch };
  };
  // いちばん下：前のすねは垂直（膝が足首の真上）、前の膝は約45度。腰は両足の間
  const KNEE = 45;
  const bottomX = STRIDE - THIGH * Math.sin(KNEE * RAD);
  const bottomY = ANKLE_H + SHANK + THIGH * Math.cos(KNEE * RAD);
  const stand = pose(0, 0.53, 0, 0, 0, 0, 0);
  const swing = pose(0.09, 0.515, 1, 10, STRIDE / 2, 0, 0.05); // 前の足を浮かせて運ぶ。後ろのかかとが上がり始める
  const landed = pose(0.19, 0.49, 3, 30, STRIDE, -5, 0); // かかとから着く
  const bottom = pose(bottomX, bottomY, 4, 45, STRIDE, 0, 0);
  // 着いてから沈む途中：前の足の裏を床に付ける（途中の姿勢を決めて、足が床にめり込まないようにする）
  const sinking = pose((0.19 + bottomX) / 2, (0.49 + bottomY) / 2 + 0.004, 3.5, 38, STRIDE, 0, 0);
  save.push({
    ...sideCommon('S9-side-L3', 'S9', { cycleSeconds: 6.5 }),
    root: { x: R, side: 'far' },
    plants: { far: { pivot: 'ball', x: round(R + BALL_FRONT) } },
    props: [COUNTER],
    support: { x: 0.12, y: 0.54, hand: 'far', follow: true }, // 体と一緒に、手がカウンターの上を前へすべる（体の少し前）
    highlight: ['near:thigh', 'near:shank'],
    keyframes: [
      skf(0, stand, '足をそろえて立つ'),
      skf(0.3, stand, '動き始め'),
      skf(1.2, swing, '片足を前へ出す'),
      skf(2.1, landed, 'かかとから着く'),
      skf(2.55, sinking, '足の裏を付けて沈む'),
      skf(3, bottom, '浅く腰を落とす'),
      skf(3.5, bottom, '戻り始め'),
      skf(3.95, sinking, '前の足で押して上がる'),
      skf(4.4, landed, '前の足で押す'),
      skf(5.3, swing, '足を戻す'),
      skf(6.2, stand, '足をそろえる'),
    ],
    posture: 'カウンターの横に、足をそろえて立ちます',
    captions: [
      { from: 0, to: 3.5, text: '片足を大きく前に踏み出し、浅く腰を落とします' },
      { from: 3.5, to: 6.5, text: '前の足で床を押して、足を戻します' },
    ],
    marks: [
      UPRIGHT_LINE(6.5),
      { type: 'arrow', from: 2.1, to: 3, anchor: 'hip', dx: -0.1, dy: 0.04, angle: 180, length: 0.08 },
    ],
  });
}

// ── B3 足を一直線にして立つ：前の足のかかとを、後ろの足のつま先につけて、そのまま保つ ──
{
  const frontHeel = -0.15;
  const footLength = 0.152;
  const pose = { ankle: 0, knee: 0, hip: 0, ...ARMS };
  save.push({
    ...sideCommon('B3-side-L3', 'B3', { cycleSeconds: 4 }),
    root: { mode: 'hip', x: round(frontHeel + HEEL_BACK - footLength / 2), y: 0.522, pelvis: 0 },
    plants: { near: { pivot: 'heel', x: frontHeel }, far: { pivot: 'heel', x: round(frontHeel - footLength) } },
    props: [{ type: 'chair', x: 0.08, seatHeight: 0.242, seatDepth: 0.22, backHeight: 0.54 }],
    support: { x: 0.07, y: 0.54 },
    highlight: ['foot'],
    keyframes: [skf(0, pose, '足を一直線にして立つ'), skf(2, pose, 'そのまま保つ')],
    captions: [{ from: 0, to: 4, text: '前の足のかかとを、後ろの足のつま先につけます' }],
    marks: [UPRIGHT_LINE(4)],
  });
}

// ── カウンターに沿って歩く種目 ──────────────────────────────
const HX = -0.06;
const HY = 0.518; // 継ぎ足歩き（歩幅が大きい）の股関節の高さ
const FLAT_CENTER = -0.015; // ふつうの歩き：重心が両足の間の中ほどに来るよう、足を少し後ろへ寄せる
const HY_SMALL = 0.52; // 小さな歩幅で歩くときの股関節の高さ（膝がほぼ伸びる）
const WALK_SUPPORT = { x: round(HX + 0.1), y: 0.54, hand: 'far' };

const ease = (a, b, w) => a + ((b - a) * (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, w))))) / 2;

// 床についている間の、足の傾き。u：その足が床に着いてからの時間（0 以上、T + ds 以下）
const PITCH = {
  // ふつうの歩き：もう片方の足が着いたら、かかとから床を離れる
  flat: (u, T, ds) => (u <= T ? 0 : ease(0, 14, (u - T) / ds)),
  // つま先歩き：かかとを上げたまま
  toe: () => 25,
  // かかと歩き：つま先を上げて着き、後ろへ残るにつれて少し下ろす（足首の背屈が参考可動域を超えないように）
  heel: (u, T, ds) => -9 + (6 * u) / (T + ds),
};

// 歩いている姿勢。その場で足を運び、床についている足は床と一緒に後ろへ動く。
// T：1歩の時間、ds：両足が床についている時間、L：歩幅、pitchOf(u)：床についている間の足の傾き、
// center：床を踏む所を体の真下に寄せるための、足の位置のずれ（つま先歩きは後ろへ、かかと歩きは前へ）
function walkPose(tau, T, ds, L, pitchOf, center, travel, hipY = HY) {
  const H = { x: HX, y: hipY };
  const period = 2 * T;
  const stanceEnd = T + ds;
  const front = (L * (1 + ds / T)) / 2 + center;
  const v = L / T;
  const stanceAnkle = (u) => ankleOf(HX + front - v * u, pitchOf(u), 0);
  const solve = (legTau) => {
    const u = ((legTau % period) + period) % period;
    let ankle;
    let pitch;
    if (u <= stanceEnd) {
      pitch = pitchOf(u);
      ankle = stanceAnkle(u);
    } else {
      // 浮かせて前へ運ぶ間：足首を、床を離れた所から次に着く所へ運ぶ。両端の速さは床の速さに合わせる
      const w = (u - stanceEnd) / (T - ds);
      const from = stanceAnkle(stanceEnd);
      const to = stanceAnkle(0);
      const m = -v * (T - ds);
      const w2 = w * w;
      const w3 = w2 * w;
      ankle = {
        x: (2 * w3 - 3 * w2 + 1) * from.x + (w3 - 2 * w2 + w) * m + (-2 * w3 + 3 * w2) * to.x + (w3 - w2) * m,
        y: ease(from.y, to.y, w) + 0.035 * Math.sin(Math.PI * w) ** 2,
      };
      // 足の傾きは、離れたときの傾きから着くときの傾きへ。足首の角度が可動域に収まるように直す
      const tilt = legAngles(H, ankle, 0, 0).ankle; // すねの前への傾き
      pitch = Math.max(tilt - 18, Math.min(tilt + 40, ease(pitchOf(stanceEnd), pitchOf(0), w)));
    }
    const angles = legAngles(H, ankle, 0, pitch);
    if (angles.ankle > 20 || angles.ankle < -45) throw new Error(`足首の角度が可動域を超えています（${angles.ankle}、tau=${legTau}）`);
    return angles;
  };
  const n = solve(tau);
  const f = solve(tau + T);
  return { ...ARMS, hip: n.hip, knee: n.knee, ankle: n.ankle, farHip: f.hip, farKnee: f.knee, farAnkle: f.ankle, travel: round(travel) };
}

// D4 継ぎ足歩き：かかとを、もう片方の足のつま先につけて進む。アニメの1周で2歩。4周（片道4歩、往復8歩）で1往復
{
  const T = 2;
  const ds = 0.5;
  const L = 0.152; // 足の長さ＝かかとがつま先につく歩幅
  const keys = [];
  for (let i = 0; i < 32; i++) {
    const t = i * 0.125;
    keys.push(skf(t, walkPose(t, T, ds, L, (u) => PITCH.flat(u, T, ds), FLAT_CENTER, (L / T) * t), i % 16 === 0 ? '足を着く' : '歩く'));
  }
  save.push({
    ...sideCommon('D4-side-L3', 'D4', { cycleSeconds: 4, cyclesPerLap: 4 }),
    root: { mode: 'hip', x: HX, y: HY, pelvis: 0 },
    floor: { spacing: L, perCycle: round(2 * L) },
    props: [COUNTER],
    support: WALK_SUPPORT,
    highlight: ['foot'],
    keyframes: keys,
    posture: 'カウンターの横に立ち、目線は前に向けます',
    captions: [{ from: 0, to: 4, text: 'かかとを、反対の足のつま先につけて進みます' }],
    marks: [UPRIGHT_LINE(4), { type: 'arrow', from: 0, to: 4, anchor: 'head', dx: 0.09, dy: 0.02, angle: 90, length: 0.09 }],
  });
}

// D2 つま先歩き・かかと歩き：往き（4歩）はつま先で、戻り（4歩）はかかとで歩く。アニメの1周が1往復
{
  const T = 1.5;
  const ds = 0.4;
  const L = 0.1;
  const cycle = 8 * T;
  const half = cycle / 2;
  // 往きはつま先歩き（重み 0）、戻りはかかと歩き（重み 1）。切り替えは1秒かけてなめらかに
  const weightAt = (t) => {
    if (t < 0.5) return ease(1, 0, t + 0.5);
    if (t < half - 0.5) return 0;
    if (t < half + 0.5) return ease(0, 1, t - (half - 0.5));
    if (t < cycle - 0.5) return 1;
    return ease(1, 0, t - (cycle - 0.5));
  };
  const keys = [];
  for (let i = 0; i < 64; i++) {
    const t = i * (cycle / 64);
    const w = weightAt(t);
    const pitchOf = (u) => PITCH.toe() * (1 - w) + PITCH.heel(u, T, ds) * w;
    const center = -0.07 * (1 - w) + 0.04 * w;
    keys.push(skf(t, walkPose(t, T, ds, L, pitchOf, center, (L / T) * t, HY_SMALL), t < half ? 'つま先で歩く' : 'かかとで歩く'));
  }
  save.push({
    ...sideCommon('D2-side-L3', 'D2', { cycleSeconds: cycle }),
    root: { mode: 'hip', x: HX, y: HY_SMALL, pelvis: 0 },
    floor: { spacing: L, perCycle: round(8 * L) },
    props: [COUNTER],
    support: WALK_SUPPORT,
    highlight: ['foot'],
    keyframes: keys,
    posture: 'カウンターに片手でつかまって立ちます',
    captions: [
      { from: 0, to: half, text: 'かかとを上げ、つま先で小さく歩きます' },
      { from: half, to: cycle, text: '戻りは、つま先を上げ、かかとで歩きます' },
    ],
    marks: [UPRIGHT_LINE(cycle), { type: 'arrow', from: 0, to: cycle, anchor: 'head', dx: 0.09, dy: 0.02, angle: 90, length: 0.09 }],
  });
}

// D5 後ろ歩き：往き（4歩）は後ろへ、戻り（4歩）は前を向いたまま前へ歩く。アニメの1周が1往復
{
  const T = 1.5;
  const ds = 0.4;
  const L = 0.1;
  const cycle = 8 * T;
  const half = cycle / 2;
  const keys = [];
  for (let i = 0; i < 64; i++) {
    const t = i * (cycle / 64);
    const tau = t <= half ? -t : t - cycle; // 後ろへ歩くのは、前へ歩く動きを逆にたどるのと同じ
    keys.push(skf(t, walkPose(tau, T, ds, L, (u) => PITCH.flat(u, T, ds), FLAT_CENTER, (L / T) * tau, HY_SMALL), t < half ? '後ろへ歩く' : '前へ歩いて戻る'));
  }
  save.push({
    ...sideCommon('D5-side-L3', 'D5', { cycleSeconds: cycle }),
    root: { mode: 'hip', x: HX, y: HY_SMALL, pelvis: 0 },
    floor: { spacing: L, perCycle: 0 },
    props: [COUNTER],
    support: WALK_SUPPORT,
    highlight: ['foot'],
    keyframes: keys,
    posture: '始める前に、後ろに物がないか確かめます',
    captions: [
      { from: 0, to: half, text: '小さな歩幅で、後ろへ歩きます' },
      { from: half, to: cycle, text: '前を向いたまま、前へ歩いて戻ります' },
    ],
    marks: [
      UPRIGHT_LINE(cycle),
      { type: 'arrow', from: 0.3, to: half - 0.3, anchor: 'head', dx: -0.09, dy: 0.02, angle: -90, length: 0.09 },
      { type: 'arrow', from: half + 0.3, to: cycle - 0.3, anchor: 'head', dx: 0.09, dy: 0.02, angle: 90, length: 0.09 },
    ],
  });
}

// ── 正面 ────────────────────────────────────────────────────
const LEG = 0.491;
const UP = -0.98;
const STAND_Y = round(0.039 + LEG * -UP);
const HIP_HALF = 0.08;
const FOOT = 0.055;
const WEIGHT_SHIFT = -0.06; // 体重を左足に乗せる（骨盤を左へ寄せる）
const legOut = (footX, shift, sign) => round(((footX - (shift + sign * HIP_HALF)) * sign) / LEG);
const leg = (side, out, up = UP) => ({ [`${side}KneeOut`]: out, [`${side}KneeUp`]: up, [`${side}AnkleOut`]: out, [`${side}AnkleUp`]: up });
const fkf = (t, pose, label) => ({ t: round(t), pose, label });
const frontCommon = (id, exercise, viewBox, extra) => ({
  id,
  exercise,
  level: 3,
  view: 'front',
  checked: false,
  ...extra,
  root: { mode: 'stand', x: 0, y: STAND_Y },
  viewBox,
});
const chairAt = (x, extra) => ({ type: 'chair', x, width: 0.3, seatHeight: 0.242, backHeight: 0.54, ...extra });
const SIDE_CHAIR_X = -0.44;
const supportProps = [chairAt(SIDE_CHAIR_X, { showFor: ['one', 'fingertip', 'none'] }), chairAt(WEIGHT_SHIFT, { showFor: ['both'], inFront: true })];
const supportPoints = { hand: 'l', side: { x: SIDE_CHAIR_X + 0.14, y: 0.54 }, front: { x: WEIGHT_SHIFT, half: 0.1, y: 0.54 } };
// 支える足（左）は、前後の描き分けをしない（lKneeDepth を省略すると右と同じ値になるので、0 と書く）
const stanceLeft = { shift: WEIGHT_SHIFT, ...leg('l', legOut(-FOOT, WEIGHT_SHIFT, -1)), lToeOut: 0.1, lToeUp: 0, lKneeDepth: 0 };
const box = { minX: -0.62, maxX: 0.36, minY: -0.075, maxY: 1.06 };

// B4 片足で立つ：片足を床から少し浮かせて、そのまま保つ。上体は傾けない
{
  const pose = { ...stanceLeft, rKneeOut: 0.03, rKneeUp: -0.9, rAnkleOut: 0, rAnkleUp: -0.8, rToeOut: 0.1, rToeUp: -0.1 };
  save.push({
    ...frontCommon('B4-front-L3', 'B4', box, { cycleSeconds: 4 }),
    support: supportPoints,
    props: supportProps,
    highlight: ['r:shank', 'r:foot'],
    keyframes: [fkf(0, pose, '片足を浮かせて立つ'), fkf(2, pose, 'そのまま保つ')],
    captions: [{ from: 0, to: 4, text: '片足を少し浮かせて立ちます。上体は傾けません' }],
    marks: [{ type: 'line', from: 0, to: 4, anchor: 'lumbar', dx: 0, dy: 0, angle: 90, length: 0.36 }],
  });
}

// D1 足先タッチ：片足のつま先で、前・横・後ろの順に床に軽く触れ、そのたびに足を戻す。3か所で1回
{
  const rest = { ...stanceLeft, ...leg('r', legOut(FOOT, WEIGHT_SHIFT, 1)), rToeOut: 0.1, rToeUp: 0, rKneeDepth: 0 };
  // つま先が床に触れるよう、かかとの高さから、つま先の下げ具合を決める
  const tap = (out, up, toeOut, depth) => {
    const heelY = STAND_Y + LEG * up - 0.039;
    return { ...stanceLeft, ...leg('r', out, up), rToeOut: toeOut, rToeUp: round(-heelY / 0.152), rKneeDepth: depth };
  };
  const near = legOut(FOOT, WEIGHT_SHIFT, 1);
  const taps = [
    { name: '前', pose: tap(near, -0.935, 0, 1) },
    { name: '横', pose: tap(0.26, -0.955, 0.5, 0) },
    { name: '後ろ', pose: tap(near, -0.935, 0, -1) },
  ];
  const ONE = 5;
  const keys = [];
  const captions = [];
  const marks = [{ type: 'line', from: 0, to: round(ONE * 3), anchor: 'lumbar', dx: 0, dy: 0, angle: 90, length: 0.36 }];
  taps.forEach((tp, i) => {
    const b = i * ONE;
    keys.push(fkf(b, rest, `${tp.name}：足をそろえる`), fkf(b + 0.3, rest, `${tp.name}：動き始め`), fkf(b + 2.5, tp.pose, `${tp.name}：床に触れる`), fkf(b + 2.8, tp.pose, `${tp.name}：戻し始め`));
    captions.push({ from: round(b), to: round(b + ONE), text: `足先で、${tp.name}の床に軽く触れて戻します` });
  });
  save.push({
    ...frontCommon('D1-front-L3', 'D1', box, { cycleSeconds: round(ONE * 3) }),
    support: supportPoints,
    props: supportProps,
    highlight: ['r:shank', 'r:foot'],
    keyframes: keys,
    posture: 'つかまる所のそばに立ち、体重を反対の足に乗せます',
    captions,
    marks,
  });
}

for (const anim of save) {
  writeFileSync(join(outDir, `${anim.id}.json`), JSON.stringify(tidyCaptions(anim), null, 2) + '\n');
  console.log(anim.id, anim.view, anim.keyframes.length, 'keyframes', anim.cycleSeconds, 's');
}
