// 振り返りの集計。直近12週（月曜〜日曜）の記録を、週ごとにまとめる。
// 評価や判定はしない。記録にある事実を数えるだけ。

import type { SessionRecord, StopReason } from '../data/types';
import { addDays, weekDates } from './dates';

export const REVIEW_WEEKS = 12;

export interface WeekSummary {
  start: string; // 週の月曜
  end: string; // 週の日曜
  exerciseDays: number; // 運動した日（標準か短いセッションで、1種目以上終えた日）
  standard: number; // 標準セッションの回数（1種目以上終えたもの）
  short: number; // 短いセッションの回数（同じ）
  walkDays: number; // 歩行を記録した日
  restDays: number; // 「今日は休む」だけの日（運動も歩行もない日）
  days: { date: string; exercised: boolean; walked: boolean; rested: boolean }[]; // 月曜〜日曜の7日
  exertion: number[]; // その週に記録したきつさ（記録した順）
  exertionAverage: number | null; // きつさの平均（記録がなければ null）
}

export interface ReviewSummary {
  from: string;
  to: string;
  weeks: WeekSummary[]; // 古い週から順に12週
  exerciseDates: string[]; // 運動した日（古い順）
  exertion: { date: string; value: number }[]; // きつさの記録（古い順）
  incidents: { date: string; fall: boolean; nearMiss: boolean }[]; // 転倒・ヒヤリの記録（古い順）
  stops: { date: string; ex: string; reason: StopReason }[]; // 途中で中止した記録（古い順）
  totals: { exerciseDays: number; standard: number; short: number; walkDays: number; restDays: number; falls: number; nearMisses: number };
}

const didExercise = (r: SessionRecord) => (r.kind === 'standard' || r.kind === 'short') && r.completed.length > 0;

export function summarize(records: SessionRecord[], todayStr: string): ReviewSummary {
  const thisMonday = weekDates(todayStr)[0]!;
  const from = addDays(thisMonday, -7 * (REVIEW_WEEKS - 1));
  const to = addDays(thisMonday, 6);
  const inRange = records.filter((r) => r.date >= from && r.date <= to).sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));

  const weeks: WeekSummary[] = [];
  for (let w = 0; w < REVIEW_WEEKS; w++) {
    const start = addDays(from, 7 * w);
    const end = addDays(start, 6);
    const inWeek = inRange.filter((r) => r.date >= start && r.date <= end);
    // 1日ずつ：運動した、歩いた、休んだ（「今日は休む」だけで、運動も歩行もない日）
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const onDay = inWeek.filter((r) => r.date === date);
      const exercised = onDay.some(didExercise);
      const walked = onDay.some((r) => r.kind === 'walk');
      return { date, exercised, walked, rested: !exercised && !walked && onDay.some((r) => r.kind === 'rest') };
    });
    const exerciseDays = days.filter((d) => d.exercised).length;
    const walkDays = days.filter((d) => d.walked).length;
    const restDays = days.filter((d) => d.rested).length;
    const exertion = inWeek.filter((r) => r.exertion !== undefined).map((r) => r.exertion as number);
    weeks.push({
      start,
      end,
      exerciseDays,
      standard: inWeek.filter((r) => r.kind === 'standard' && didExercise(r)).length,
      short: inWeek.filter((r) => r.kind === 'short' && didExercise(r)).length,
      walkDays,
      restDays,
      days,
      exertion,
      exertionAverage: exertion.length > 0 ? Math.round((exertion.reduce((a, b) => a + b, 0) / exertion.length) * 10) / 10 : null,
    });
  }

  const sum = (pick: (w: WeekSummary) => number) => weeks.reduce((a, w) => a + pick(w), 0);
  return {
    from,
    to,
    weeks,
    exerciseDates: [...new Set(inRange.filter(didExercise).map((r) => r.date))],
    exertion: inRange.filter((r) => r.exertion !== undefined).map((r) => ({ date: r.date, value: r.exertion as number })),
    incidents: inRange.filter((r) => r.fall || r.nearMiss).map((r) => ({ date: r.date, fall: r.fall, nearMiss: r.nearMiss })),
    stops: inRange.filter((r) => r.stopped !== undefined).map((r) => ({ date: r.date, ex: r.stopped!.ex, reason: r.stopped!.reason })),
    totals: {
      exerciseDays: sum((w) => w.exerciseDays),
      standard: sum((w) => w.standard),
      short: sum((w) => w.short),
      walkDays: sum((w) => w.walkDays),
      restDays: sum((w) => w.restDays),
      falls: inRange.filter((r) => r.fall).length,
      nearMisses: inRange.filter((r) => r.nearMiss).length,
    },
  };
}
