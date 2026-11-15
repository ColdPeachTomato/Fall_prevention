// いまのメニューと、新しいメニューの違いを、文の一覧にする。
// 新しいメニューに置き換える前に、医師がこの一覧を見て確かめる。

import { addDays } from '../app/dates';
import { findExercise } from '../data/exercises';
import { UNIT_LABEL } from '../data/limits';
import type { Menu, MenuItem } from '../data/types';
import { SUPPORT_LABEL } from './support';

function itemText(i: MenuItem): string {
  const ex = findExercise(i.ex);
  const unit = ex ? UNIT_LABEL[ex.unit] : '';
  return `レベル${i.level}、${i.amount}${unit} × ${i.sets}セット`;
}

function itemName(i: MenuItem): string {
  return `${i.ex} ${findExercise(i.ex)?.name ?? ''}`.trim();
}

function walkingText(w: Menu['walking']): string {
  return w ? `1回 ${w.minutes}分、週 ${w.daysPerWeek}日` : 'なし';
}

function diffItems(label: string, before: MenuItem[], after: MenuItem[], out: string[]): void {
  for (const a of after) {
    const b = before.find((x) => x.ex === a.ex);
    if (!b) {
      out.push(`${label}：${itemName(a)} を追加（${itemText(a)}）`);
      continue;
    }
    const changes: string[] = [];
    const unit = UNIT_LABEL[findExercise(a.ex)?.unit ?? 'reps'];
    if (b.level !== a.level) changes.push(`レベル ${b.level} → ${a.level}`);
    if (b.amount !== a.amount) changes.push(`${b.amount}${unit} → ${a.amount}${unit}`);
    if (b.sets !== a.sets) changes.push(`${b.sets}セット → ${a.sets}セット`);
    if (changes.length > 0) out.push(`${label}：${itemName(a)} を変更（${changes.join('、')}）`);
  }
  for (const b of before) {
    if (!after.some((x) => x.ex === b.ex)) out.push(`${label}：${itemName(b)} をやめる（${itemText(b)}）`);
  }
  // 入っている種目は同じで、並ぶ順だけが違うとき
  const kept = (list: MenuItem[], other: MenuItem[]) => list.filter((x) => other.some((y) => y.ex === x.ex)).map((x) => x.ex);
  if (kept(before, after).join(',') !== kept(after, before).join(',')) out.push(`${label}：種目の順番が変わります`);
}

// 違いの一覧。before が null のときは、はじめてのメニュー
export function diffMenus(before: Menu | null, after: Menu): string[] {
  if (!before) return ['はじめてのメニューです（いまは、メニューが設定されていません）'];
  const out: string[] = [];
  if (before.issuedOn !== after.issuedOn) out.push(`作成日：${before.issuedOn} → ${after.issuedOn}`);
  if (before.reviewAfterDays !== after.reviewAfterDays || before.issuedOn !== after.issuedOn) {
    const [b, a] = [addDays(before.issuedOn, before.reviewAfterDays), addDays(after.issuedOn, after.reviewAfterDays)];
    if (before.reviewAfterDays !== after.reviewAfterDays) out.push(`見直し日数：${before.reviewAfterDays}日 → ${after.reviewAfterDays}日`);
    if (b !== a) out.push(`見直しの目安の日：${b} → ${a}`);
  }
  if (before.support !== after.support) out.push(`立って行う種目の支え：${SUPPORT_LABEL[before.support]} → ${SUPPORT_LABEL[after.support]}`);
  if (before.intensityCap !== after.intensityCap) out.push(`強度の上限：「${before.intensityCap}」 → 「${after.intensityCap}」`);
  diffItems('標準セッション', before.standard, after.standard, out);
  diffItems('短いセッション', before.short, after.short, out);
  if (walkingText(before.walking) !== walkingText(after.walking)) out.push(`歩行：${walkingText(before.walking)} → ${walkingText(after.walking)}`);
  return out.length > 0 ? out : ['違いはありません（いまのメニューと同じ内容です）'];
}
