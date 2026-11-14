// 運動データ 23種類。要件メモ「運動データ」の表と、付録「動きの仕様」から転記した。内容は要件メモを正とする。
// 行い方（howTo）の文は、注意点と動きの仕様をもとに作った暫定の文。医師・理学療法士の確認を受ける。
// 目的（purpose）の文は、何のための運動かを一文で伝える（2026-11-14 利用者の依頼で追加。文は確認待ち）。
// 病気の治療や予防の効果をうたう言葉は使わない（要件メモ「やらないこと」）。テストで確かめる。

import { getAnimation } from '../animation/registry';
import type { Exercise } from './types';

// 目的の一文の前に付ける見出し（太字で出す。2026-11-14 利用者の指示）
export const PURPOSE_LABEL = '＜目的＞';

export const EXERCISES: Exercise[] = [
  // ウォームアップ
  {
    id: 'W1',
    name: '足首回し',
    purpose: '足首をやわらかく動かしましょう',
    category: 'warmup',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    directions: ['外回し', '内回し'],
    cues: ['片足ずつ、両方向に回す', '立っているのが不安なら座って行う'],
    variants: [
      { level: 1, howTo: '椅子に座り、片足を少し前に出します。かかとを床につけたまま、つま先で円を描きます。', posture: 'sitting', usesSupport: false, view: 'front', animationId: 'W1-front-L1' },
      { level: 2, howTo: 'つかまる所のそばに立ち、体重を反対の足に乗せます。片足を少し前に出し、かかとを床につけたまま、つま先で円を描きます。', posture: 'standing', usesSupport: true, view: 'front', animationId: 'W1-front-L2' },
    ],
  },
  {
    id: 'W2',
    name: '腕回し',
    purpose: '肩のまわりをほぐしましょう',
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
    purpose: '背中と腰をゆっくりほぐしましょう',
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
    purpose: 'ふくらはぎをゆっくり伸ばしましょう',
    category: 'warmup',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['後ろ足のかかとを床につける', '反動をつけない'],
    variants: [
      { level: 2, howTo: 'つかまる所のそばに立ち、片足を後ろに引きます。かかとを床につけたまま、前の膝を曲げてふくらはぎを伸ばし、10秒止めて戻します。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'W4-side-L2' },
    ],
  },

  // 筋力
  {
    id: 'S1',
    name: '椅子からの立ち座り',
    purpose: '立ち上がる脚の力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['足を少し引き、前かがみになって立つ', 'ゆっくり座る', '膝が内側に入らないようにする'],
    variants: [
      { level: 1, howTo: '手を使ってよいので、椅子から立ち上がり、ゆっくり座ります。', posture: 'standing', usesSupport: false, view: 'side', animationId: 'S1-side-L1' },
      { level: 2, howTo: '腕を体の横に下ろし、手を使わずに立ち上がり、ゆっくり座ります。', posture: 'standing', usesSupport: false, view: 'side', animationId: 'S1-side-L2' },
      { level: 3, howTo: '椅子に軽く触れるところまで腰を下ろし、座らずに立ち上がります。', posture: 'standing', usesSupport: false, view: 'side', animationId: 'S1-side-L3' },
    ],
  },
  {
    id: 'S2',
    name: 'かかと上げ',
    purpose: 'ふくらはぎの力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['親指側に体重を乗せ、足首を外に倒さない'],
    variants: [
      { level: 1, howTo: '椅子に座り、かかとをゆっくり上げて、ゆっくり下ろします。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S2-side-L1' },
      { level: 2, howTo: 'つかまる所のそばに立ち、かかとをゆっくり上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'S2-side-L2' },
    ],
  },
  {
    id: 'S3',
    name: 'つま先上げ',
    purpose: 'つま先を上げる力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['後ろに倒れないよう、立って行うときは両手でつかまる'],
    minSupport: 'both',
    variants: [
      { level: 1, howTo: '椅子に座り、つま先をゆっくり上げて、ゆっくり下ろします。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S3-side-L1' },
      { level: 2, howTo: '両手でつかまって立ち、つま先をゆっくり上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'S3-side-L2' },
    ],
  },
  {
    id: 'S4',
    name: '膝伸ばし（座って）',
    purpose: '太ももの前の力をつけましょう',
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
    purpose: '脚を持ち上げる力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['上体を倒さず反らさず、肩を腰の真上に保つ'],
    variants: [
      { level: 1, howTo: '椅子に座り、膝を左右交互にゆっくり上げます。', posture: 'sitting', usesSupport: false, view: 'side', animationId: 'S5-side-L1' },
      { level: 2, howTo: 'つかまる所のそばに立ち、膝を左右交互にゆっくり上げて足踏みします。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'S5-side-L2' },
    ],
  },
  {
    id: 'S6',
    name: '脚の横上げ',
    purpose: 'お尻の横の力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['腰を水平に保ち、上体を傾けない'],
    variants: [
      { level: 2, howTo: 'つかまる所のそばに立ち、片脚をゆっくり横に上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'front', animationId: 'S6-front-L2' },
    ],
  },
  {
    id: 'S7',
    name: '脚の後ろ上げ',
    purpose: 'お尻と脚の後ろの力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: true,
    cues: ['上体を前に倒さず、腰を反らさない'],
    variants: [
      { level: 2, howTo: 'つかまる所のそばに立ち、片脚をゆっくり後ろに上げて、ゆっくり下ろします。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'S7-side-L2' },
    ],
  },
  {
    id: 'S8',
    name: '肩甲骨寄せ（バンド）',
    purpose: '姿勢を支える背中の力をつけましょう',
    category: 'strength',
    highRisk: false,
    unit: 'reps',
    bilateral: false,
    cues: ['背筋を伸ばし、肩をすくめない', 'バンドがないときは、肘を曲げて脇につけ、肘を後ろに引く'],
    variants: [
      { level: 1, howTo: '椅子に座り、背筋を伸ばして、バンドを胸の前で肩幅に持ちます。肘を伸ばしたまま左右に引き広げ、肩甲骨を寄せて止め、ゆっくり戻します。', posture: 'sitting', usesSupport: false, view: 'back', animationId: 'S8-back-L1' },
      // 両手でバンドを持つため、つかまらずに行う。立位なので支持物の確認は出す
      { level: 2, howTo: 'つかまる所のすぐ横に立ち、背筋を伸ばして、肩甲骨をゆっくり寄せます。', posture: 'standing', usesSupport: false, view: 'back', animationId: 'S8-back-L2' },
    ],
  },
  {
    id: 'S9',
    name: 'ランジ（浅め）',
    purpose: '踏み出して支える力をつけましょう',
    category: 'strength',
    highRisk: true,
    unit: 'reps',
    bilateral: true,
    cues: ['体重は前の足に乗せる', '深くしゃがまない', '痛みがあれば浅くする'],
    variants: [
      { level: 3, howTo: 'カウンターの横に立ち、片足を前に踏み出して、浅く腰を落とします。前の足で押して、足を戻します。', posture: 'standing', usesSupport: true, maxSupport: 'one', view: 'side', animationId: 'S9-side-L3' },
    ],
  },

  // 立ってのバランス
  {
    id: 'B1',
    name: '足をそろえて立つ',
    purpose: '立ったままバランスを保ちましょう',
    category: 'balance',
    highRisk: false,
    unit: 'seconds',
    bilateral: false,
    cues: ['つかまる所のすぐ横で行う', 'ふらついたら、すぐつかまる'],
    variants: [
      { level: 2, howTo: 'つかまる所のそばに立ち、両足をそろえて、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'front', animationId: 'B1-front-L2' },
    ],
  },
  {
    id: 'B2',
    name: '足を半歩ずらして立つ',
    purpose: 'せまい足幅でバランスを保ちましょう',
    category: 'balance',
    highRisk: false,
    unit: 'seconds',
    bilateral: true,
    cues: ['前の足の親指を、後ろの足の土踏まずの横に置く'],
    variants: [
      { level: 2, howTo: 'つかまる所のそばに立ち、前の足の親指を、後ろの足の土踏まずの横に置いて、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'B2-side-L2' },
    ],
  },
  {
    id: 'B3',
    name: '足を一直線にして立つ',
    purpose: 'せまい足幅でバランスを保ちましょう',
    category: 'balance',
    highRisk: true,
    unit: 'seconds',
    bilateral: true,
    cues: ['前の足のかかとを、後ろの足のつま先につける'],
    variants: [
      { level: 3, howTo: 'つかまる所のそばに立ち、両足を前後一直線にして、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'side', animationId: 'B3-side-L3' },
    ],
  },
  {
    id: 'B4',
    name: '片足で立つ',
    purpose: '片足でバランスを保ちましょう',
    category: 'balance',
    highRisk: true,
    unit: 'seconds',
    bilateral: true,
    cues: ['上体を傾けない', 'つかまる所のすぐ横で行う'],
    variants: [
      { level: 3, howTo: 'つかまる所のそばに立ち、片足を少し上げて、その姿勢を保ちます。', posture: 'standing', usesSupport: true, view: 'front', animationId: 'B4-front-L3' },
    ],
  },

  // 歩きながらのバランス
  {
    id: 'D1',
    name: '足先タッチ（前・横・後ろ）',
    purpose: '片足で支えて、足を動かしましょう',
    category: 'dynamic',
    highRisk: true,
    unit: 'reps',
    bilateral: true,
    cues: ['体重を立っている足の上に保つ', '小さな動きでよい'],
    variants: [
      { level: 3, howTo: 'つかまる所のそばに立ち、片足のつま先で、前、横、後ろの順に床に軽く触れます。そのたびに足を戻します。', posture: 'standing', usesSupport: true, view: 'front', animationId: 'D1-front-L3' },
    ],
  },
  {
    id: 'D2',
    name: 'つま先歩き・かかと歩き',
    purpose: '足首を使って歩く練習をしましょう',
    category: 'dynamic',
    highRisk: true,
    unit: 'laps',
    bilateral: false,
    cues: ['常につかまる', '足やかかとが痛むときは中止する'],
    minSupport: 'one',
    variants: [
      { level: 3, howTo: 'カウンターに片手でつかまり、往きはつま先で歩き、戻りはかかとで歩きます。', posture: 'standing', usesSupport: true, maxSupport: 'one', view: 'side', animationId: 'D2-side-L3' },
    ],
  },
  {
    id: 'D3',
    name: '横歩き（カウンター沿い）',
    purpose: '横へ足を運ぶ練習をしましょう',
    category: 'dynamic',
    highRisk: false,
    unit: 'laps',
    bilateral: false,
    cues: ['カウンターに向かい、小さく横へ', '足を交差させない'],
    variants: [
      { level: 2, howTo: 'カウンターに向かって立ち、足を交差させずに、小さく横へ歩いて戻ります。', posture: 'standing', usesSupport: true, view: 'front', animationId: 'D3-front-L2' },
    ],
  },
  {
    id: 'D4',
    name: '継ぎ足歩き（カウンター沿い）',
    purpose: 'バランスを保って歩きましょう',
    category: 'dynamic',
    highRisk: true,
    unit: 'laps',
    bilateral: false,
    cues: ['かかとを、もう片方の足のつま先につけて進む', '目線は前に'],
    variants: [
      { level: 3, howTo: 'カウンターの横に立ち、かかとを反対の足のつま先につけながら、一直線に歩いて戻ります。', posture: 'standing', usesSupport: true, maxSupport: 'one', view: 'side', animationId: 'D4-side-L3' },
    ],
  },
  {
    id: 'D5',
    name: '後ろ歩き（カウンター沿い）',
    purpose: '後ろへ歩く練習をしましょう',
    category: 'dynamic',
    highRisk: true,
    unit: 'laps',
    bilateral: false,
    cues: ['歩幅は小さく', '始める前に、後ろに物がないか確かめる'],
    variants: [
      { level: 3, howTo: 'カウンターの横に立ち、小さな歩幅で後ろへ歩き、前を向いたまま前へ歩いて戻ります。', posture: 'standing', usesSupport: true, maxSupport: 'one', view: 'side', animationId: 'D5-side-L3' },
    ],
  },

  // 歩行（メニューの walking で設定する。セッションの種目には入れない）
  {
    id: 'G1',
    name: '日々の歩行',
    purpose: '毎日の歩く習慣を続けましょう',
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
