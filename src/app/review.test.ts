// 振り返りの集計の検査。フェーズ4の完了条件：振り返りの集計が記録と一致する。

import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../data/types';
import { addDays, weekDates } from './dates';
import { REVIEW_WEEKS, summarize } from './review';

const TODAY = '2026-11-15'; // 日曜
let seq = 0;
function rec(date: string, fields: Partial<SessionRecord>): SessionRecord {
  seq++;
  return { id: `r${seq}`, date, createdAt: `${date}T10:00:${String(seq % 60).padStart(2, '0')}.000Z`, kind: 'standard', completed: ['S1'], fall: false, nearMiss: false, ...fields };
}

describe('振り返りの集計', () => {
  it('直近12週（月曜〜日曜）。今日を含む週が最後', () => {
    const s = summarize([], TODAY);
    expect(s.weeks).toHaveLength(REVIEW_WEEKS);
    expect(s.weeks[11]!.start).toBe('2026-11-09');
    expect(s.weeks[11]!.end).toBe('2026-11-15');
    expect(s.weeks[0]!.start).toBe('2026-08-24');
    expect(s.from).toBe('2026-08-24');
    expect(s.to).toBe('2026-11-15');
    for (const w of s.weeks) {
      expect(weekDates(w.start)[0]).toBe(w.start); // 月曜
      expect(addDays(w.start, 6)).toBe(w.end);
    }
    expect(s.totals).toEqual({ exerciseDays: 0, standard: 0, short: 0, walkDays: 0, restDays: 0, falls: 0, nearMisses: 0 });
  });

  it('記録と一致する：運動した日、セッションの回数、歩行、休み、きつさ、転倒・ヒヤリ、中止', () => {
    const records = [
      // 今週
      rec('2026-11-09', { kind: 'standard', exertion: 3 }),
      rec('2026-11-09', { kind: 'walk', completed: [], walkMinutes: 15 }),
      rec('2026-11-11', { kind: 'short', exertion: 2 }),
      rec('2026-11-11', { kind: 'standard', exertion: 4 }), // 同じ日に2回：運動した日は1日、回数は2回
      rec('2026-11-12', { kind: 'rest', completed: [] }),
      rec('2026-11-13', { kind: 'rest', completed: [] }),
      rec('2026-11-13', { kind: 'walk', completed: [], walkMinutes: 15 }), // 休んだが歩いた日：休みの日には数えない
      rec('2026-11-14', { kind: 'standard', completed: [], stopped: { ex: 'S1', reason: 'pain' }, exertion: 5, nearMiss: true }), // 1種目も終えずに中止：運動した日に数えない
      rec('2026-11-15', { kind: 'standard', completed: ['W2'], stopped: { ex: 'S1', reason: 'tired' }, exertion: 4, fall: true }),
      // 先週
      rec('2026-11-02', { kind: 'standard', exertion: 3 }),
      rec('2026-11-08', { kind: 'short' }), // きつさの記録なし
      // 12週の最初の日と、範囲の外
      rec('2026-08-24', { kind: 'standard', exertion: 1 }),
      rec('2026-08-23', { kind: 'standard', exertion: 5, fall: true }), // 範囲の外：数えない
      rec('2026-11-16', { kind: 'standard', exertion: 5 }), // 来週（端末の日付が違っていた場合）：数えない
    ];
    const s = summarize(records, TODAY);
    const thisWeek = s.weeks[11]!;
    expect(thisWeek).toMatchObject({ exerciseDays: 3, standard: 3, short: 1, walkDays: 2, restDays: 1 });
    expect(thisWeek.exertion).toEqual([3, 2, 4, 5, 4]);
    expect(thisWeek.exertionAverage).toBe(3.6);
    const lastWeek = s.weeks[10]!;
    expect(lastWeek).toMatchObject({ exerciseDays: 2, standard: 1, short: 1, walkDays: 0, restDays: 0, exertionAverage: 3 });
    expect(s.weeks[0]).toMatchObject({ exerciseDays: 1, standard: 1, exertionAverage: 1 });
    expect(s.weeks[5]).toMatchObject({ exerciseDays: 0, standard: 0, short: 0, walkDays: 0, restDays: 0, exertionAverage: null });

    expect(s.exerciseDates).toEqual(['2026-08-24', '2026-11-02', '2026-11-08', '2026-11-09', '2026-11-11', '2026-11-15']);
    expect(s.exertion.map((e) => e.value)).toEqual([1, 3, 3, 2, 4, 5, 4]);
    expect(s.incidents).toEqual([
      { date: '2026-11-14', fall: false, nearMiss: true },
      { date: '2026-11-15', fall: true, nearMiss: false },
    ]);
    expect(s.stops).toEqual([
      { date: '2026-11-14', ex: 'S1', reason: 'pain' },
      { date: '2026-11-15', ex: 'S1', reason: 'tired' },
    ]);
    expect(s.totals).toEqual({ exerciseDays: 6, standard: 5, short: 2, walkDays: 2, restDays: 1, falls: 1, nearMisses: 1 });
  });

  it('週ごとの数を足すと、全体の数になる。記録を1つずつ数え直した結果とも合う', () => {
    // 決まった並びの記録を、84日分作る
    const records: SessionRecord[] = [];
    for (let d = 0; d < 84; d++) {
      const date = addDays('2026-08-24', d);
      if (d % 3 === 0) records.push(rec(date, { kind: 'standard', exertion: ((d % 5) + 1) as 1 | 2 | 3 | 4 | 5 }));
      if (d % 4 === 1) records.push(rec(date, { kind: 'short' }));
      if (d % 5 === 2) records.push(rec(date, { kind: 'walk', completed: [], walkMinutes: 10 }));
      if (d % 7 === 5) records.push(rec(date, { kind: 'rest', completed: [] }));
      if (d % 29 === 3) records.push(rec(date, { kind: 'standard', fall: d % 2 === 0, nearMiss: d % 2 === 1 }));
    }
    const s = summarize(records, TODAY);
    const days = [...new Set(records.map((r) => r.date))];
    const did = (date: string) => records.some((r) => r.date === date && (r.kind === 'standard' || r.kind === 'short') && r.completed.length > 0);
    const walked = (date: string) => records.some((r) => r.date === date && r.kind === 'walk');
    expect(s.totals.exerciseDays).toBe(days.filter(did).length);
    expect(s.totals.walkDays).toBe(days.filter(walked).length);
    expect(s.totals.restDays).toBe(days.filter((d) => !did(d) && !walked(d)).length);
    expect(s.totals.standard).toBe(records.filter((r) => r.kind === 'standard').length);
    expect(s.totals.short).toBe(records.filter((r) => r.kind === 'short').length);
    expect(s.totals.falls).toBe(records.filter((r) => r.fall).length);
    expect(s.totals.nearMisses).toBe(records.filter((r) => r.nearMiss).length);
    expect(s.exertion).toHaveLength(records.filter((r) => r.exertion !== undefined).length);
    expect(s.weeks.reduce((a, w) => a + w.exertion.length, 0)).toBe(s.exertion.length);
    // 1日ずつの印も、記録と合う
    for (const w of s.weeks) {
      expect(w.days).toHaveLength(7);
      for (const d of w.days) {
        expect(d.exercised, d.date).toBe(did(d.date));
        expect(d.walked, d.date).toBe(walked(d.date));
        expect(d.rested, d.date).toBe(!did(d.date) && !walked(d.date) && records.some((r) => r.date === d.date && r.kind === 'rest'));
      }
    }
    expect(s.exerciseDates).toEqual(days.filter(did).sort());
  });
});
