// 座って行う横向きの4種目（S2・S3・S4・S5 のレベル1）のキーフレームを作る
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tidyCaptions } from './captions.mjs';

const outDir = process.argv[2];
const HIP = { x: -0.2, y: 0.298 };
const SEAT = 0.242;
const base = { ankle: 0, knee: 87, hip: 87, spine: 0, neck: 0, shoulder: 0, elbow: 10 };
const farBase = { farAnkle: 0, farKnee: 87, farHip: 87 };
// 座った姿勢での足の位置（股関節 87度、膝 87度、すねは垂直）
const ankleX = HIP.x + 0.245 * Math.sin((93 * Math.PI) / 180);
const BALL_X = Math.round((ankleX + 0.08) * 10000) / 10000;
const HEEL_X = Math.round((ankleX - 0.042) * 10000) / 10000;

const common = (id, exercise, extra) => ({
  id,
  exercise,
  level: 1,
  view: 'side',
  checked: false,
  ...extra,
  root: { mode: 'seat', x: HIP.x, y: HIP.y, pelvis: 0 },
  props: [{ type: 'chair', x: -0.33, seatHeight: SEAT, seatDepth: 0.26, backHeight: 0.52 }],
  // 手は座面の横を軽く持つ
  contacts: { near: { on: 'world', x: -0.17, y: 0.257 }, far: { on: 'world', x: -0.17, y: 0.257 } },
});
const kf = (t, pose, label) => ({ t, pose, onSeat: true, hands: 1, label });

// S2 かかと上げ（座って）
const s2 = {
  ...common('S2-side-L1', 'S2', { cycleSeconds: 5 }),
  plants: { near: { pivot: 'ball', x: BALL_X }, far: { pivot: 'ball', x: BALL_X } },
  highlight: ['shank', 'foot'],
  keyframes: [
    kf(0, { ...base, footPitch: 0 }, '足を床につける'),
    kf(0.3, { ...base, footPitch: 0 }, '動き始め'),
    kf(2.3, { ...base, footPitch: 32 }, 'かかとを上げる'),
    kf(2.8, { ...base, footPitch: 32 }, '下ろし始め'),
    kf(4.8, { ...base, footPitch: 0 }, '下ろす'),
  ],
  captions: [
    { from: 0, to: 0.3, text: '足の裏を床につけて座ります' },
    { from: 0.3, to: 2.8, text: 'かかとをゆっくり上げます' },
    { from: 2.8, to: 5, text: 'ゆっくり下ろします' },
  ],
  marks: [
    { type: 'arrow', from: 0.3, to: 2.3, anchor: 'heel', dx: -0.05, dy: 0.01, angle: 0, length: 0.09 },
    { type: 'arrow', from: 2.9, to: 4.8, anchor: 'heel', dx: -0.05, dy: 0.1, angle: 180, length: 0.09 },
  ],
};

// S3 つま先上げ（座って）
const s3 = {
  ...common('S3-side-L1', 'S3', { cycleSeconds: 5 }),
  plants: { near: { pivot: 'heel', x: HEEL_X }, far: { pivot: 'heel', x: HEEL_X } },
  highlight: ['foot'],
  keyframes: [
    kf(0, { ...base, footPitch: 0 }, '足を床につける'),
    kf(0.3, { ...base, footPitch: 0 }, '動き始め'),
    kf(2.3, { ...base, footPitch: -16 }, 'つま先を上げる'),
    kf(2.8, { ...base, footPitch: -16 }, '下ろし始め'),
    kf(4.8, { ...base, footPitch: 0 }, '下ろす'),
  ],
  captions: [
    { from: 0, to: 0.3, text: '足の裏を床につけて座ります' },
    { from: 0.3, to: 2.8, text: 'つま先をゆっくり上げます' },
    { from: 2.8, to: 5, text: 'ゆっくり下ろします' },
  ],
  marks: [
    { type: 'arrow', from: 0.3, to: 2.3, anchor: 'toe', dx: 0.04, dy: 0.01, angle: 0, length: 0.09 },
    { type: 'arrow', from: 2.9, to: 4.8, anchor: 'toe', dx: 0.04, dy: 0.1, angle: 180, length: 0.09 },
  ],
};

// S4 膝伸ばし（座って）。手前の脚で行い、左側は左右反転して使う
const rest = { ...base, ...farBase };
const extended = { ...base, knee: 12, ankle: 8, ...farBase };
const s4 = {
  ...common('S4-side-L1', 'S4', { cycleSeconds: 6 }),
  highlight: ['near:shank', 'near:foot'],
  keyframes: [
    kf(0, rest, '足を床につける'),
    kf(0.3, rest, '動き始め'),
    kf(2.5, extended, '膝を伸ばす'),
    kf(3.5, extended, '止める（下ろし始め）'),
    kf(5.7, rest, '下ろす'),
  ],
  captions: [
    { from: 0, to: 0.3, text: '背筋を伸ばして座ります' },
    { from: 0.3, to: 2.5, text: '片方の膝をゆっくり伸ばします' },
    { from: 2.5, to: 3.5, text: '伸ばしたまま止めます' },
    { from: 3.5, to: 6, text: 'ゆっくり下ろします' },
  ],
  marks: [
    { type: 'arrow', from: 0.3, to: 2.4, anchor: 'ankle', dx: 0.07, dy: 0.02, angle: 40, length: 0.1 },
    { type: 'arrow', from: 3.6, to: 5.7, anchor: 'ankle', dx: 0.08, dy: 0.04, angle: 200, length: 0.1 },
  ],
};

// S5 膝上げ（座って足踏み）。左右交互。1往復で2回と数える
const nearUp = { ...base, hip: 110, knee: 110, ...farBase };
const farUp = { ...base, farAnkle: 0, farHip: 110, farKnee: 110 };
const s5 = {
  ...common('S5-side-L1', 'S5', { cycleSeconds: 9.6, countsPerCycle: 2 }),
  highlight: ['thigh'],
  keyframes: [
    kf(0, rest, '両足を床につける'),
    kf(0.2, rest, '手前の膝を上げ始める'),
    kf(2.2, nearUp, '手前の膝を上げる'),
    kf(2.5, nearUp, '手前を下ろし始める'),
    kf(4.5, rest, '手前を下ろす'),
    kf(5.0, rest, '奥の膝を上げ始める'),
    kf(7.0, farUp, '奥の膝を上げる'),
    kf(7.3, farUp, '奥を下ろし始める'),
    kf(9.3, rest, '奥を下ろす'),
  ],
  captions: [
    { from: 0, to: 0.2, text: '背筋を伸ばして座ります' },
    { from: 0.2, to: 2.5, text: '片方の膝をゆっくり上げます' },
    { from: 2.5, to: 4.8, text: 'ゆっくり下ろします' },
    { from: 4.8, to: 7.3, text: '反対の膝をゆっくり上げます' },
    { from: 7.3, to: 9.6, text: 'ゆっくり下ろします' },
  ],
  marks: [
    // 上体を倒さず反らさず、肩を腰の真上に保つ
    { type: 'line', from: 0, to: 9.6, anchor: 'hip', dx: 0, dy: 0.33, angle: 0, length: 0.78 },
    { type: 'arrow', from: 0.2, to: 2.2, anchor: 'knee', dx: 0.01, dy: 0.07, angle: 0, length: 0.08 },
    { type: 'arrow', from: 5.0, to: 7.0, anchor: 'farKnee', dx: 0.01, dy: 0.07, angle: 0, length: 0.08 },
  ],
};

for (const a of [s2, s3, s4, s5]) {
  writeFileSync(join(outDir, `${a.id}.json`), JSON.stringify(tidyCaptions(a), null, 2) + '\n');
  console.log(a.id);
}
