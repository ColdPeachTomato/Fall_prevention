// 実際に使う支えの段階を決める。
// メニューの支えを基本に、種目の下限（minSupport）より少なければ下限まで増やす。
// 片手で動作する種目は、つかまれる手の上限（maxSupport）に合わせる。

import type { Exercise, ExerciseVariant, SupportStage } from '../data/types';

// 支えが少ない順
const ORDER: SupportStage[] = ['none', 'fingertip', 'one', 'both'];

function rank(s: SupportStage): number {
  return ORDER.indexOf(s);
}

export function effectiveSupport(
  menuSupport: SupportStage,
  exercise: Exercise,
  variant: ExerciseVariant,
): SupportStage | null {
  if (!variant.usesSupport) return null;
  let s = menuSupport;
  if (exercise.minSupport && rank(s) < rank(exercise.minSupport)) s = exercise.minSupport;
  if (variant.maxSupport && rank(s) > rank(variant.maxSupport)) s = variant.maxSupport;
  return s;
}

export const SUPPORT_LABEL: Record<SupportStage, string> = {
  both: '両手でつかまる',
  one: '片手でつかまる',
  fingertip: '指先を軽く添える',
  none: 'つかまらずに行う（すぐ横につかまる所を置く）',
};
