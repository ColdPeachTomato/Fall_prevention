// 運動データ 23種類。要件メモ「運動データ」の表と、付録「動きの仕様」から転記した。内容は要件メモを正とする。
// 行い方（howTo）の文は、注意点と動きの仕様をもとに作った暫定の文。医師・理学療法士の確認を受ける。

import { getAnimation } from '../animation/registry';
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  // ウォームアップ
  {
    id: 'W1',
    name: '足首回し',
    category: 'warmup',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    directions: ['外回し', '内回し'],
    cues: ['片足ずつ、両方向に回す', '立っているのが不安なら座って行う'],
    variants: [
      { level: 1, howTo: '椅子に座り、片足を少し前に出します。かかとを床につけたまま、つま先で円を描きます。', posture: 'sitting', usesSupport: false, view: 'front', animationId: 'W1-front-L1' },
      { level: 2, howTo: 'つかまって立ち、体重を反対の足に乗せます。片足を少し前に出し、かかとを床につけたまま、つま先で円を描きます。', posture: 'standing', usesSupport: true, view: 'front', animationId: null },
    ],
  },
  {
    id: 'W2',
    name: '腕回し',
    category: 'warmup',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    directions: ['後ろ回し', '前回し'],
    cues: ['肩がつらければ、円を小さくする'],
    // どのレベルでも椅子に座って行う（両手を使うため、立ってつかまることができない）。動きはレベル1と2で同じ
    variants: [
      { level: 1, howTo: '椅子に座り、指先を肩に置きます。両方の肘で、同時に大きな円を描きます。', posture: 'sitting', usesSupport: false, view: 'front', animationId: 'W2-front-L1' },
      { level: 2, howTo: '椅子に座り、指先を肩に置きます。両方の肘で、同時に大きな円を描きます。', posture: 'sitting', usesSupport: false, view: 'front', animationId: 'W2-front-L1' },
    ],
  },
  {
    id: 'W3',
    name: '腕を上げて体をひねる',
    category: 'warmup',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['無理のない範囲で、左右交互に'],
    // どのレベルでも椅子に座って行う。動きはレベル1と2で同じ
    variants: [
      { level: 1, howTo: '椅子に座り、両腕を肩の高さで前に伸ばして、手のひらを合わせます。腰と足は正面に向けたまま、胸と腕を一緒に、右、左とゆっくりひねります。', posture: 'sitting', usesSupport: false, view: 'front', animationId: 'W3-front-L1' },
      { level: 2, howTo: '椅子に座り、両腕を肩の高さで前に伸ばして、手のひらを合わせます。腰と足は正面に向けたまま、胸と腕を一緒に、右、左とゆっくりひねります。', posture: 'sitting', usesSupport: false, view: 'front', animationId: 'W3-front-L1' },
    ],
  },
  {
    id: 'W4',
    name: 'ふくらはぎ伸ばし',
    category: 'warmup',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['後ろ足のかかとを床につける', '反動をつけない'],
    variants: [
      { level: 2, howTo: 'つかまって立ち、片足を後ろに引いて、ふくらはぎをゆっくり伸ばします。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },

  // 筋力
  {
    id: 'S1',
    name: '椅子からの立ち座り',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['足を少し引き、前かがみになって立つ', 'ゆっくり座る', '膝が内側に入らないようにする'],
    variants: [
      { level: 1, howTo: '手を使ってよいので、椅子から立ち上がり、ゆっくり座ります。', posture: 'standing', usesSupport: false, view: 'side', animationId: 'S1-side-L1' },
      { level: 2, howTo: '腕を体の横に下ろし、手を使わずに立ち上がり、ゆっくり座ります。', posture: 'standing', usesSupport: false, view: 'side', animationId: 'S1-side-L2' },
      { level: 3, howTo: '椅子に軽く触れるところまで腰を下ろし、座らずに立ち上がります。', posture: 'standing', usesSupport: false, view: 'side', animationId: null },
    ],
  },
  {
    id: 'S2',
    name: 'かかと上げ',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['親指側に体重を乗せ、足首を外に倒さない'],
    variants: [
      { level: 1, howTo: '椅子に座り、かかとをゆっくり上げて、ゆっくり下ろします。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S2-side-L1' },
      { level: 2, howTo: 'つかまって立ち、かかとをゆっくり上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'S3',
    name: 'つま先上げ',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['後ろに倒れないよう、立って行うときは両手でつかまる'],
    minSupport: 'both',
    variants: [
      { level: 1, howTo: '椅子に座り、つま先をゆっくり上げて、ゆっくり下ろします。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S3-side-L1' },
      { level: 2, howTo: '両手でつかまって立ち、つま先をゆっくり上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'S4',
    name: '膝伸ばし（座って）',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['ゆっくり伸ばして止め、ゆっくり下ろす'],
    variants: [
      { level: 1, howTo: '椅子に座り、片方の膝をゆっくり伸ばして止め、ゆっくり下ろします。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S4-side-L1' },
    ],
  },
  {
    id: 'S5',
    name: '膝上げ（足踏み）',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['上体を倒さず反らさず、肩を腰の真上に保つ'],
    variants: [
      { level: 1, howTo: '椅子に座り、膝を左右交互にゆっくり上げます。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S5-side-L1' },
      { level: 2, howTo: 'つかまって立ち、膝を左右交互にゆっくり上げて足踏みします。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'S6',
    name: '脚の横上げ',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['腰を水平に保ち、上体を傾けない'],
    variants: [
      { level: 2, howTo: 'つかまって立ち、片脚をゆっくり横に上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'front', animationId: null },
    ],
  },
  {
    id: 'S7',
    name: '脚の後ろ上げ',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['上体を前に倒さず、腰を反らさない'],
    variants: [
      { level: 2, howTo: 'つかまって立ち、片脚をゆっくり後ろに上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'S8',
    name: '肩甲骨寄せ（バンド）',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['背筋を伸ばし、肩をすくめない', 'バンドがないときは、肘を曲げて脇につけ、肘を後ろに引く'],
    variants: [
      { level: 1, howTo: '椅子に座り、背筋を伸ばして、バンドを胸の前で肩幅に持ちます。肘を伸ばしたまま左右に引き広げ、肩甲骨を寄せて止め、ゆっくり戻します。', posture: 'sitting', usesSupport: false, view: 'back', animationId: 'S8-back-L1' },
      // 両手でバンドを持つため、つかまらずに行う。立位なので支持物の確認は出す
      { level: 2, howTo: 'つかまる所のすぐ横に立ち、背筋を伸ばして、肩甲骨をゆっくり寄せます。', posture: 'standing', usesSupport: false, view: 'back', animationId: null },
    ],
  },
  {
    id: 'S9',
    name: 'ランジ（浅め）',
    category: 'strength',
    highRisk: true,
    unit: 'reps',
    bilateral: true,
    cues: ['体重は前の足に乗せる', '深くしゃがまない', '痛みがあれば浅くする'],
    variants: [
      { level: 3, howTo: 'つかまって立ち、片足を前に出して、浅く腰を落とし、戻ります。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },

  // 立ってのバランス
  {
    id: 'B1',
    name: '足をそろえて立つ',
    category: 'balance',
    highRisk: false,
    unit: 'seconds',
    bilateral: false,
    cues: ['つかまる所のすぐ横で行う', 'ふらついたら、すぐつかまる'],
    variants: [
      { level: 2, howTo: 'つかまって立ち、両足をそろえて、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'front', animationId: null },
    ],
  },
  {
    id: 'B2',
    name: '足を半歩ずらして立つ',
    category: 'balance',
    highRisk: false,
    unit: 'seconds',
    bilateral: true,
    cues: ['前の足の親指を、後ろの足の土踏まずの横に置く'],
    variants: [
      { level: 2, howTo: 'つかまって立ち、片足を半歩前にずらして、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'B3',
    name: '足を一直線にして立つ',
    category: 'balance',
    highRisk: true,
    unit: 'seconds',
    bilateral: true,
    cues: ['前の足のかかとを、後ろの足のつま先につける'],
    variants: [
      { level: 3, howTo: 'つかまって立ち、両足を前後一直線にして、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'B4',
    name: '片足で立つ',
    category: 'balance',
    highRisk: true,
    unit: 'seconds',
    bilateral: true,
    cues: ['上体を傾けない', 'つかまる所のすぐ横で行う'],
    variants: [
      { level: 3, howTo: 'つかまって立ち、片足を少し上げて、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'front', animationId: null },
    ],
  },

  // 歩きながらのバランス
  {
    id: 'D1',
    name: '足先タッチ（前・横・後ろ）',
    category: 'dynamic',
    highRisk: true,
    unit: 'reps',
    bilateral: true,
    cues: ['体重を立っている足の上に保つ', '小さな動きでよい'],
    variants: [
      { level: 3, howTo: 'つかまって立ち、片足のつま先で、前・横・後ろの床に軽く触れます。', posture: 'standing', usesSupport: true, view: 'front', animationId: null },
    ],
  },
  {
    id: 'D2',
    name: 'つま先歩き・かかと歩き',
    category: 'dynamic',
    highRisk: true,
    unit: 'laps',
    bilateral: false,
    cues: ['常につかまる', '足やかかとが痛むときは中止する'],
    minSupport: 'one',
    variants: [
      { level: 3, howTo: 'カウンターにつかまりながら、つま先で歩き、戻りはかかとで歩きます。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'D3',
    name: '横歩き（カウンター沿い）',
    category: 'dynamic',
    highRisk: false,
    unit: 'laps',
    bilateral: false,
    cues: ['カウンターに向かい、小さく横へ', '足を交差させない'],
    variants: [
      { level: 2, howTo: 'カウンターに向かって立ち、つかまりながら小さく横へ歩き、戻ります。', posture: 'standing', usesSupport: true, view: 'front', animationId: null },
    ],
  },
  {
    id: 'D4',
    name: '継ぎ足歩き（カウンター沿い）',
    category: 'dynamic',
    highRisk: true,
    unit: 'laps',
    bilateral: false,
    cues: ['かかとを、もう片方の足のつま先につけて進む', '目線は前に'],
    variants: [
      { level: 3, howTo: 'カウンターにつかまりながら、かかとをつま先につけて前へ歩き、戻ります。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },
  {
    id: 'D5',
    name: '後ろ歩き（カウンター沿い）',
    category: 'dynamic',
    highRisk: true,
    unit: 'laps',
    bilateral: false,
    cues: ['歩幅は小さく', '始める前に、後ろに物がないか確かめる'],
    variants: [
      { level: 3, howTo: 'カウンターにつかまりながら、小さな歩幅で後ろへ歩き、戻ります。', posture: 'standing', usesSupport: true, view: 'side', animationId: null },
    ],
  },

  // 歩行（メニューの walking で設定する。セッションの種目には入れない）
  {
    id: 'G1',
    name: '日々の歩行',
    category: 'walking',
    highRisk: false,
    unit: 'minutes',
    bilateral: false,
    cues: ['外を歩くかどうかと時間は、医師が決める'],
    variants: [
      { level: 1, howTo: '医師と決めた時間、歩きます。', posture: 'standing', usesSupport: false, view: 'side', animationId: null },
      { level: 2, howTo: '医師と決めた時間、歩きます。', posture: 'standing', usesSupport: false, view: 'side', animationId: null },
      { level: 3, howTo: '医師と決めた時間、歩きます。', posture: 'standing', usesSupport: false, view: 'side', animationId: null },
    ],
  },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function getExercise(id: string): Exercise {
  const ex = BY_ID.get(id);
  if (!ex) throw new Error(`運動IDが見つかりません: ${id}`);
  return ex;
}

// 医師用のメニュー作成画面で選べる種目か。
// 高リスクの種目は、すべてのレベルのアニメに確認済みの印が付くまで選べない。
export function isSelectableInEditor(ex: Exercise): boolean {
  if (ex.category === 'walking') return false;
  if (!ex.highRisk) return true;
  return ex.variants.every((v) => getAnimation(v.animationId)?.checked === true);
}
