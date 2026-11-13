// アプリに同梱するアニメの一覧。キーフレームは src/data/animations/ の JSON にある。
// プレビューで書き出した JSON を同じ名前で置き換えると、アプリに反映される。

import s1SideL1 from '../data/animations/S1-side-L1.json';
import s1SideL2 from '../data/animations/S1-side-L2.json';
import type { AnimationData } from './types';
import { validateAnimation } from './validate';

function load(raw: unknown, name: string): AnimationData {
  const r = validateAnimation(raw);
  if (!r.ok) throw new Error(`アニメ ${name} のデータが正しくありません：\n${r.errors.join('\n')}`);
  return r.anim;
}

export const ANIMATIONS: AnimationData[] = [load(s1SideL1, 'S1-side-L1'), load(s1SideL2, 'S1-side-L2')];

const BY_ID = new Map(ANIMATIONS.map((a) => [a.id, a]));

export function getAnimation(id: string | null | undefined): AnimationData | undefined {
  return id ? BY_ID.get(id) : undefined;
}
