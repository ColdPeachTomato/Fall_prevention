// 確認済みの印を付けるアニメ。利用者（医師）が見本を確かめて「よい」と言ったものだけを入れる。
// 生成スクリプトは、ここにある id の checked を true にして書き出す。
// テスト（src/animation/animations.test.ts の confirmed）にも同じ id を入れること。
// 確認済みのアニメの動きを後から変えたときは、ここから外して、もう一度確かめてもらう。
export const CONFIRMED = [
  // 2026-11-14 確認
  'S1-side-L1',
  'S1-side-L2',
  'S1-side-L3',
  'S2-side-L1',
  'S2-side-L2',
  'S4-side-L1',
  'S5-side-L1',
  'S5-side-L2',
  'S7-side-L2',
  'S8-back-L1',
  'S8-back-L2',
];
