// アプリに同梱するアニメの一覧。キーフレームは src/data/animations/ の JSON にある。
// プレビューで書き出した JSON を同じ名前で置き換えると、アプリに反映される。

import s1SideL1 from '../data/animations/S1-side-L1.json';
import s1SideL2 from '../data/animations/S1-side-L2.json';
import s2SideL1 from '../data/animations/S2-side-L1.json';
import s3SideL1 from '../data/animations/S3-side-L1.json';
import s4SideL1 from '../data/animations/S4-side-L1.json';
import s5SideL1 from '../data/animations/S5-side-L1.json';
import s8BackL1 from '../data/animations/S8-back-L1.json';
import w1FrontL1 from '../data/animations/W1-front-L1.json';
import w2FrontL1 from '../data/animations/W2-front-L1.json';
import w3FrontL1 from '../data/animations/W3-front-L1.json';
import w1FrontL2 from '../data/animations/W1-front-L2.json';
import w4SideL2 from '../data/animations/W4-side-L2.json';
import s2SideL2 from '../data/animations/S2-side-L2.json';
import s3SideL2 from '../data/animations/S3-side-L2.json';
import s5SideL2 from '../data/animations/S5-side-L2.json';
import s6FrontL2 from '../data/animations/S6-front-L2.json';
import s7SideL2 from '../data/animations/S7-side-L2.json';
import s8BackL2 from '../data/animations/S8-back-L2.json';
import b1FrontL2 from '../data/animations/B1-front-L2.json';
import b2SideL2 from '../data/animations/B2-side-L2.json';
import d3FrontL2 from '../data/animations/D3-front-L2.json';
import s1SideL3 from '../data/animations/S1-side-L3.json';
import s9SideL3 from '../data/animations/S9-side-L3.json';
import b3SideL3 from '../data/animations/B3-side-L3.json';
import b4FrontL3 from '../data/animations/B4-front-L3.json';
import d1FrontL3 from '../data/animations/D1-front-L3.json';
import d2SideL3 from '../data/animations/D2-side-L3.json';
import d4SideL3 from '../data/animations/D4-side-L3.json';
import d5SideL3 from '../data/animations/D5-side-L3.json';
import type { AnimationData } from './types';
import { validateAnimation } from './validate';

function load(raw: unknown, name: string): AnimationData {
  const r = validateAnimation(raw);
  if (!r.ok) throw new Error(`アニメ ${name} のデータが正しくありません：\n${r.errors.join('\n')}`);
  return r.anim;
}

export const ANIMATIONS: AnimationData[] = [
  load(s1SideL1, 'S1-side-L1'),
  load(s1SideL2, 'S1-side-L2'),
  load(s2SideL1, 'S2-side-L1'),
  load(s3SideL1, 'S3-side-L1'),
  load(s4SideL1, 'S4-side-L1'),
  load(s5SideL1, 'S5-side-L1'),
  load(s8BackL1, 'S8-back-L1'),
  load(w1FrontL1, 'W1-front-L1'),
  load(w2FrontL1, 'W2-front-L1'),
  load(w3FrontL1, 'W3-front-L1'),
  // レベル2（立って行う種目）
  load(w1FrontL2, 'W1-front-L2'),
  load(w4SideL2, 'W4-side-L2'),
  load(s2SideL2, 'S2-side-L2'),
  load(s3SideL2, 'S3-side-L2'),
  load(s5SideL2, 'S5-side-L2'),
  load(s6FrontL2, 'S6-front-L2'),
  load(s7SideL2, 'S7-side-L2'),
  load(s8BackL2, 'S8-back-L2'),
  load(b1FrontL2, 'B1-front-L2'),
  load(b2SideL2, 'B2-side-L2'),
  load(d3FrontL2, 'D3-front-L2'),
  // レベル3
  load(s1SideL3, 'S1-side-L3'),
  load(s9SideL3, 'S9-side-L3'),
  load(b3SideL3, 'B3-side-L3'),
  load(b4FrontL3, 'B4-front-L3'),
  load(d1FrontL3, 'D1-front-L3'),
  load(d2SideL3, 'D2-side-L3'),
  load(d4SideL3, 'D4-side-L3'),
  load(d5SideL3, 'D5-side-L3'),
];

const BY_ID = new Map(ANIMATIONS.map((a) => [a.id, a]));

export function getAnimation(id: string | null | undefined): AnimationData | undefined {
  return id ? BY_ID.get(id) : undefined;
}
