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
  // 2026-11-15 に作り直したあと、確かめてもらった（向きを変える見せ方、膝、腕の振り、後ろ姿）
  'D2-side-L3',
  // 2026-11-15 に直したあと、もう一度確かめてもらった（W3：髪の裾のつなぎ方、B4：腕を開いて揺らす）
  'W3-front-L1',
  'B4-front-L3',
  'S9-side-L3',
  'D1-front-L3',
];
