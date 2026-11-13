// S-11 医師に相談する時期の知らせ。運動は止めない。

import { addDays, daysBetween } from '../app/dates';
import type { Menu, SessionRecord, Settings } from '../data/types';

export interface ReviewNotice {
  fallOrNearMiss: boolean; // メニューを設定した後に、転倒・ヒヤリの記録がある
  overdue: boolean; // 見直し日数が過ぎた
  reviewDate: string; // 見直しの目安の日
}

export function reviewNotice(
  menu: Menu,
  settings: Settings,
  records: SessionRecord[],
  todayStr: string,
): ReviewNotice {
  const since = settings.menuSetAt ?? '';
  const fallOrNearMiss = records.some((r) => (r.fall || r.nearMiss) && r.createdAt > since);
  const reviewDate = addDays(menu.issuedOn, menu.reviewAfterDays);
  const overdue = daysBetween(reviewDate, todayStr) >= 0;
  return { fallOrNearMiss, overdue, reviewDate };
}
