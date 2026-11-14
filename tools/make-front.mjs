// 正面・後ろ向きの4種目（W1・W2・W3・S8 のレベル1）のキーフレームを作る。
// 動きの形は、要件メモの付録「動きの仕様」による。
// ここでは体を立体で考えて各節の向きを決め、正面から見た向き（Out, Up）に直して書き出す。
// 書き出す JSON は 2D の値だけを持つ。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tidyCaptions } from './captions.mjs';

const outDir = process.argv[2];
const RAD = Math.PI / 180;
const round = (v) => Math.round(v * 10000) / 10000;

// 寸法（bodyModel.ts と同じ値）
const L1 = 0.186; // 上腕
const L2 = 0.146 + 0.05; // 前腕＋手のひら
const SHOULDER_HALF = 0.118;
const HIP = { x: 0, y: 0.298 };
const SHOULDER_Y = HIP.y + 0.09 + 0.24 * 0.82;
const SEAT = 0.242;
const CHAIR = { type: 'chair', x: 0, width: 0.3, seatHeight: SEAT, backHeight: 0.52 };

// 座った脚：太ももはほぼ手前向き（膝は股関節より少し外）、すねは垂直、足は少し外向き
const LEGS = { rKneeOut: 0.08, rKneeUp: -0.052, rAnkleOut: 0, rAnkleUp: -1, rToeOut: 0.1, rToeUp: 0 };

// 立体の向き [外, 上, 前] から、節の長さを 1 とした (Out, Up) を作る
const norm = (v) => {
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
};

// 手で座面の横を持つ腕（肘は後ろに張る）
function armToSeat() {
  const S = [SHOULDER_HALF, SHOULDER_Y, 0];
  const H = [0.165, 0.257, 0.03];
  const d = H.map((c, i) => c - S[i]);
  const dist = Math.hypot(...d);
  const u = d.map((c) => c / dist);
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(L1 * L1 - a * a);
  // 肘の張る向き：後ろ、少し外
  let n = [0.25, 0, -1];
  const dot = n[0] * u[0] + n[1] * u[1] + n[2] * u[2];
  n = norm(n.map((c, i) => c - dot * u[i]));
  const E = S.map((c, i) => c + a * u[i] + h * n[i]);
  return {
    rElbowOut: round((E[0] - S[0]) / L1),
    rElbowUp: round((E[1] - S[1]) / L1),
    rHandOut: round((H[0] - E[0]) / L2),
    rHandUp: round((H[1] - E[1]) / L2),
  };
}
const ARMS_ON_SEAT = armToSeat();

const common = (id, exercise, view, viewBox, extra) => ({
  id,
  exercise,
  level: 1,
  view,
  checked: false,
  ...extra,
  root: { mode: 'seat', x: HIP.x, y: HIP.y },
  viewBox,
});
const kf = (t, pose, label) => ({ t: round(t), pose, onSeat: true, label });
const box = (half) => ({ minX: -half, maxX: half, minY: -0.075, maxY: 0.86 });

// ── W1 足首回し（座って）────────────────────────────────────
// 片足を少し前に出し、かかとを床につけたまま、つま先で円を描く。
// 正の向きの再生：上→外→下→内（外回し）。逆向きの再生が内回し。
const W1_CYCLE = 3;
const W1_NAMES = ['つま先を下げる', '内へ', '内から上へ', '上へ', '上から外へ', '外へ', '外から下へ', '下へ'];
const w1Keys = [];
for (let i = 0; i < 8; i++) {
  const theta = 180 + 45 * i; // 0：上、90：外、180：下、270：内
  const pose = {
    ...ARMS_ON_SEAT,
    ...LEGS,
    rToeOut: round(0.3 * Math.sin(theta * RAD)),
    rToeUp: round(0.2 + 0.18 * Math.cos(theta * RAD)),
    lToeOut: LEGS.rToeOut,
    lToeUp: 0,
  };
  w1Keys.push(kf((W1_CYCLE * i) / 8, pose, W1_NAMES[i]));
}
const w1 = {
  ...common('W1-front-L1', 'W1', 'front', box(0.36), { cycleSeconds: W1_CYCLE }),
  plants: { r: { x: 0.1 } },
  props: [CHAIR],
  highlight: ['r:foot'],
  keyframes: w1Keys,
  posture: '椅子に座り、片足を少し前に出します',
  captions: [{ from: 0, to: W1_CYCLE, text: 'かかとを床につけたまま、つま先で外へ円を描きます' }],
  reverseCaptions: [{ from: 0, to: W1_CYCLE, text: 'かかとを床につけたまま、つま先で内へ円を描きます' }],
  marks: [{ type: 'arc', from: 0, to: W1_CYCLE, anchor: 'r.heel', dx: 0, dy: 0.045, radius: 0.085, start: -75, sweep: 150 }],
};

// ── W2 腕回し（座って）──────────────────────────────────────
// 指先を肩に置き、両肘で同時に大きな円を描く。
// 正の向きの再生：前→上→後ろ→下（後ろ回し）。逆向きの再生が前回し。
const W2_CYCLE = 4;
const W2_NAMES = ['肘を下げる', '下から前へ', '前へ', '前から上へ', '上へ', '上から後ろへ', '後ろへ', '後ろから下へ'];
function elbowDirection(theta) {
  const c = Math.cos(theta * RAD);
  const s = Math.sin(theta * RAD);
  // 後ろへはあまり引けないので、後ろ側では肘が外へ開く。下では体の横に付く
  const out = 0.2 + (0.65 * (1 - c)) / 2 - 0.35 * Math.max(0, -s);
  const forward = c > 0 ? c : 0.55 * c;
  // キーフレームの間の補間で見かけの長さが 1 を超えないよう、わずかに余裕を持たせる
  return norm([out, s, forward]).map((v) => v * 0.99);
}
const SHOULDER_TOP = [-0.005, 0.025]; // 指先を置く所（肩の関節の中心から）
// 肘を回すと、肩（肩甲骨）も一緒に動く：肘が上なら肩が上がり、下なら下がる。後ろで外へ開くと、肩も少し外へ
const SHOULDER_MOVE = { out: 0.014, up: 0.024 };
// 肩に置いた手は、指先を支点にして、肘のある側へ寄る（肘と同じ向きに、小さく回る）
const HAND_SWING = 0.045;
const w2Keys = [];
for (let i = 0; i < 8; i++) {
  const theta = 270 + 45 * i; // 0：前、90：上、180：後ろ、270：下
  const e = elbowDirection(theta);
  const elbow = [e[0] * L1, e[1] * L1];
  const palm = [SHOULDER_TOP[0] + HAND_SWING * e[0], SHOULDER_TOP[1] + HAND_SWING * e[1]];
  let hand = [(palm[0] - elbow[0]) / L2, (palm[1] - elbow[1]) / L2];
  const n = Math.hypot(...hand);
  if (n > 0.99) hand = hand.map((c) => (c / n) * 0.99);
  const pose = {
    ...LEGS,
    rShoulderOut: round(SHOULDER_MOVE.out * (e[0] - 0.45)),
    rShoulderUp: round(SHOULDER_MOVE.up * e[1]),
    rElbowOut: round(e[0]),
    rElbowUp: round(e[1]),
    // 肘の前後：前に来たとき 1、後ろへ行ったとき -1 に近づく（腕の濃さと、手との重なりに使う。濃くするのは手前だけ）
    rElbowDepth: round(Math.max(-1, Math.min(1, e[2] > 0 ? e[2] : e[2] * 1.8))),
    rHandOut: round(hand[0]),
    rHandUp: round(hand[1]),
  };
  w2Keys.push(kf((W2_CYCLE * i) / 8, pose, W2_NAMES[i]));
}
const w2 = {
  ...common('W2-front-L1', 'W2', 'front', box(0.4), { cycleSeconds: W2_CYCLE }),
  props: [CHAIR],
  highlight: ['upperArm', 'forearm'],
  keyframes: w2Keys,
  posture: '椅子に座り、指先を肩に置きます',
  captions: [{ from: 0, to: W2_CYCLE, text: '肘を、前から上、後ろへ回します' }],
  reverseCaptions: [{ from: 0, to: W2_CYCLE, text: '肘を、後ろから上、前へ回します' }],
  marks: [
    { type: 'arc', from: 0, to: W2_CYCLE, anchor: 'r.shoulder', dx: 0, dy: 0, radius: 0.225, start: 5, sweep: 150 },
    { type: 'arc', from: 0, to: W2_CYCLE, anchor: 'l.shoulder', dx: 0, dy: 0, radius: 0.225, start: -5, sweep: -150 },
  ],
};

// ── W3 腕を上げて体をひねる（座って）────────────────────────
// 両腕を肩の高さで前に伸ばし、手のひらを合わせる。骨盤と足は正面のまま、胸と腕を一緒にひねる。
// ひねる角度は 40 度（胸腰部の回旋の参考可動域の上限。仕様の「45度程度」に近い値）。
const W3_TURN = 40;
const STRAIGHT = 0.97; // 肘はごくわずかに曲がる
function twistPose(phi) {
  // 体の座標：x は人物の左、z は前。胸を右へ phi 回す
  const reach = (L1 + L2) * STRAIGHT;
  const forwardLength = Math.sqrt(reach * reach - SHOULDER_HALF * SHOULDER_HALF);
  const c = Math.cos(phi * RAD);
  const s = Math.sin(phi * RAD);
  const handX = -forwardLength * s;
  const pose = { ...LEGS, turn: round(phi) };
  for (const [side, sign] of [['r', -1], ['l', 1]]) {
    const shoulderX = sign * SHOULDER_HALF * c;
    const out = ((handX - shoulderX) * sign) / (L1 + L2); // 体の外向きの成分
    pose[`${side}ElbowOut`] = round(out);
    pose[`${side}ElbowUp`] = 0;
    pose[`${side}HandOut`] = round(out);
    pose[`${side}HandUp`] = 0;
    // 腕はこちらへ伸びている：手がいちばん手前、肘はその半分（色の濃さに使う。手前ほど少し濃い）
    const forward = (forwardLength * c - sign * SHOULDER_HALF * s) / (L1 + L2);
    pose[`${side}ElbowDepth`] = round(forward / 2);
    pose[`${side}HandDepth`] = round(forward);
  }
  return pose;
}
const w3 = {
  ...common('W3-front-L1', 'W3', 'front', box(0.36), { cycleSeconds: 9.6, countsPerCycle: 2 }),
  props: [CHAIR],
  highlight: ['trunk', 'upperArm', 'forearm'],
  keyframes: [
    kf(0, twistPose(0), '正面を向く'),
    kf(0.2, twistPose(0), '右へひねり始める'),
    kf(1.2, twistPose(W3_TURN / 2), '右へ（途中）'),
    kf(2.2, twistPose(W3_TURN), '右へひねる'),
    kf(2.5, twistPose(W3_TURN), '戻し始める'),
    kf(3.5, twistPose(W3_TURN / 2), '戻す（途中）'),
    kf(4.5, twistPose(0), '正面に戻る'),
    kf(5, twistPose(0), '左へひねり始める'),
    kf(6, twistPose(-W3_TURN / 2), '左へ（途中）'),
    kf(7, twistPose(-W3_TURN), '左へひねる'),
    kf(7.3, twistPose(-W3_TURN), '戻し始める'),
    kf(8.3, twistPose(-W3_TURN / 2), '戻す（途中）'),
    kf(9.3, twistPose(0), '正面に戻る'),
  ],
  captions: [
    { from: 0, to: 0.2, text: '両腕を前に伸ばし、手のひらを合わせます' },
    { from: 0.2, to: 2.5, text: '胸と腕を一緒に、右へひねります' },
    { from: 2.5, to: 4.8, text: 'ゆっくり正面に戻します' },
    { from: 4.8, to: 7.3, text: '胸と腕を一緒に、左へひねります' },
    { from: 7.3, to: 9.6, text: 'ゆっくり正面に戻します' },
  ],
  marks: [
    { type: 'arrow', from: 0.2, to: 2.2, anchor: 'r.hand', dx: 0.045, dy: 0.075, angle: 90, length: 0.1 },
    { type: 'arrow', from: 5, to: 7, anchor: 'l.hand', dx: -0.045, dy: 0.075, angle: -90, length: 0.1 },
  ],
};

// ── S8 肩甲骨寄せ（バンド。座って、後ろから見る）────────────
// バンドを胸の前で肩幅に持ち、肘を伸ばしたまま左右に引き広げ、肩甲骨を寄せて止め、ゆっくり戻す。
const DOWN = 12; // 腕は肩より少し低い、胸の高さ
const SPREAD = 55; // 引き広げたときの、前からの開き
function bandPose(alpha, scapula) {
  const out = round(Math.sin(alpha * RAD) * Math.cos(DOWN * RAD));
  const up = round(-Math.sin(DOWN * RAD));
  // 後ろから見るので、前に伸ばした腕は奥（負）：手がいちばん奥、肘はその4割。肘が手より手前なので、腕が拳に少し重なる。
  // バンドを緩めて腕が前を向くほど、重なりが増える（拳が消えることはない。色の濃さは変わらない）
  const forward = Math.cos(alpha * RAD) * Math.cos(DOWN * RAD);
  return { ...LEGS, scapula, rElbowOut: out, rElbowUp: up, rElbowDepth: round(-forward * 0.4), rHandOut: out, rHandUp: up, rHandDepth: round(-forward) };
}
const s8 = {
  ...common('S8-back-L1', 'S8', 'back', box(0.47), { cycleSeconds: 8 }),
  props: [CHAIR, { type: 'band' }],
  highlight: ['upperArm', 'forearm', 'scapula'],
  keyframes: [
    kf(0, bandPose(0, 0), 'バンドを肩幅に持つ'),
    kf(0.3, bandPose(0, 0), '引き始め'),
    kf(2.7, bandPose(SPREAD, 1), '引き広げる'),
    kf(5.2, bandPose(SPREAD, 1), '止める（戻し始め）'),
    kf(7.6, bandPose(0, 0), '戻す'),
  ],
  captions: [
    { from: 0, to: 0.3, text: '背筋を伸ばし、バンドを胸の前で持ちます' },
    { from: 0.3, to: 2.7, text: '肘を伸ばしたまま、左右に引き広げます' },
    { from: 2.7, to: 5.2, text: '肩甲骨を寄せて止めます。肩は上げません' },
    { from: 5.2, to: 8, text: 'ゆっくり戻します' },
  ],
  marks: [
    { type: 'line', from: 0, to: 8, anchor: 'chest', dx: 0, dy: 0.055, angle: 90, length: 0.62 },
    { type: 'arrow', from: 0.3, to: 2.6, anchor: 'r.hand', dx: 0.03, dy: -0.07, angle: 90, length: 0.09 },
    { type: 'arrow', from: 0.3, to: 2.6, anchor: 'l.hand', dx: -0.03, dy: -0.07, angle: -90, length: 0.09 },
  ],
};

for (const anim of [w1, w2, w3, s8]) {
  writeFileSync(join(outDir, `${anim.id}.json`), JSON.stringify(tidyCaptions(anim), null, 2) + '\n');
  console.log(anim.id, anim.keyframes.length, 'keyframes');
}
console.log('arms on seat', ARMS_ON_SEAT);
