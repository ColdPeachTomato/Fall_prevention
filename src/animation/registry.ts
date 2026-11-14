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
];

const BY_ID = new Map(ANIMATIONS.map((a) => [a.id, a]));

export function getAnimation(id: string | null | undefined): AnimationData | undefined {
  return id ? BY_ID.get(id) : undefined;
}
