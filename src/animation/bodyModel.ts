// 人物モデルの寸法、質量比、関節の可動域。単位は「身長 = 1」。
//
// 注意：ここの数値は成人の平均的な値で、個人差や加齢による違いは含まない。
// 重心の表示は「見本の姿勢が力学的におかしくないか」を確かめるための目安として使う。

import type { FarJoint, JointName, NearJoint } from './types';

// ── 体の節の長さ ─────────────────────────────────────────────
// 出典：Drillis R, Contini R. Body Segment Parameters. 1966.
//       （Winter DA. Biomechanics and Motor Control of Human Movement, 4th ed., 2009, Fig. 4.1 に引用）
//   足の長さ 0.152、足首の高さ 0.039、膝の高さ 0.285、股関節（大転子）の高さ 0.530、
//   肩の高さ 0.818、上腕 0.186、前腕 0.146、手 0.108
// 骨盤（股関節〜腰）と体幹（腰〜首の付け根）の分け方は出典になく、このモデルで決めた近似。
//   腰（L4/L5）の高さ 0.62、首の付け根（C7）の高さ 0.86 とした。
export const BODY = {
  ankleHeight: 0.039,
  heelBack: 0.042, // 足首からかかとの端まで（足の長さの約 1/4）
  toeFront: 0.11, // 足首からつま先まで
  shank: 0.246, // 膝〜足首
  thigh: 0.245, // 股関節〜膝
  pelvis: 0.09, // 股関節〜腰
  trunk: 0.24, // 腰〜首の付け根
  shoulderAlong: 0.82, // 肩の位置（腰から首の付け根への割合）。肩の高さ 0.818 に合わせた
  headCenter: 0.075, // 首の付け根〜頭の中心（耳の穴の高さ 約0.935）
  upperArm: 0.186,
  forearm: 0.146, // 肘〜手首
  palm: 0.05, // 手首〜手のひらの中心
} as const;

// ── 質量比と重心の位置 ───────────────────────────────────────
// 出典：Winter DA. Biomechanics and Motor Control of Human Movement, 4th ed., 2009, Table 4.1
//       （Dempster WT. 1955 の計測に基づく）
// mass：体重に対する割合。左右にある節は片側の値。
// com ：節の重心の位置（近位端から遠位端への割合）。
//   頭・首      mass 0.081   C7 から耳の穴へ 1.000（＝耳の穴の位置）
//   胸・腹      mass 0.355   C7 から L4/L5 へ 0.63
//   骨盤        mass 0.142   L4/L5 から大転子へ 0.105
//   上腕        mass 0.028   肩から肘へ 0.436
//   前腕と手    mass 0.022   肘から手首へ 0.682
//   大腿        mass 0.100   股関節から膝へ 0.433
//   下腿        mass 0.0465  膝から足首へ 0.433
//   足          mass 0.0145  足首と母趾球の中間（0.5）
// 合計：0.081 + 0.355 + 0.142 + 2 × (0.028 + 0.022 + 0.100 + 0.0465 + 0.0145) = 1.000
export const MASS = {
  head: { mass: 0.081, com: 1.0 },
  trunk: { mass: 0.355, com: 0.63 },
  pelvis: { mass: 0.142, com: 0.105 },
  upperArm: { mass: 0.028, com: 0.436 },
  forearmHand: { mass: 0.022, com: 0.682 },
  thigh: { mass: 0.1, com: 0.433 },
  shank: { mass: 0.0465, com: 0.433 },
  foot: { mass: 0.0145, com: 0.5 },
} as const;

// ── 関節の可動域 ─────────────────────────────────────────────
// 出典：日本整形外科学会・日本リハビリテーション医学会「関節可動域表示ならびに測定法」の参考可動域
//   足関節：背屈 20、底屈 45 ／ 膝：屈曲 130、伸展 0 ／ 股：屈曲 125、伸展 15
//   胸腰部：屈曲 45、伸展 30 ／ 頸部：屈曲 60、伸展 50
//   肩：屈曲 180、伸展 50 ／ 肘：屈曲 145、伸展 5
// キーフレームがこの範囲を超えると、検証でエラーにする。
export interface JointDef {
  name: JointName;
  label: string;
  min: number;
  max: number;
}

export const NEAR_JOINTS: JointDef[] = [
  { name: 'ankle', label: '足首（すねを前に倒す）', min: -45, max: 20 },
  { name: 'knee', label: '膝（曲げる）', min: 0, max: 130 },
  { name: 'hip', label: '股関節（曲げる）', min: -15, max: 125 },
  { name: 'spine', label: '腰（前かがみ）', min: -30, max: 45 },
  { name: 'neck', label: '首（前に倒す）', min: -50, max: 60 },
  { name: 'shoulder', label: '肩（腕を前に上げる）', min: -50, max: 180 },
  { name: 'elbow', label: '肘（曲げる）', min: -5, max: 145 },
];

export const FAR_JOINTS: JointDef[] = [
  { name: 'farAnkle', label: '奥の足首', min: -45, max: 20 },
  { name: 'farKnee', label: '奥の膝', min: 0, max: 130 },
  { name: 'farHip', label: '奥の股関節', min: -15, max: 125 },
  { name: 'farShoulder', label: '奥の肩', min: -50, max: 180 },
  { name: 'farElbow', label: '奥の肘', min: -5, max: 145 },
];

export const ALL_JOINTS: JointDef[] = [...NEAR_JOINTS, ...FAR_JOINTS];

// 奥側の関節を省略したときに使う、手前側の関節
export const FAR_DEFAULT: Record<FarJoint, NearJoint> = {
  farAnkle: 'ankle',
  farKnee: 'knee',
  farHip: 'hip',
  farShoulder: 'shoulder',
  farElbow: 'elbow',
};
