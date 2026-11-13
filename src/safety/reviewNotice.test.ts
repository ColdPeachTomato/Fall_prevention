import { describe, expect, it } from 'vitest';
import type { Menu, SessionRecord } from '../data/types';
import { reviewNotice } from './reviewNotice';

const menu: Menu = {
  v: 1,
  issuedOn: '2026-11-01',
  reviewAfterDays: 90,
  support: 'both',
  intensityCap: 'ややきつい',
  standard: [{ ex: 'S1', level: 1, amount: 5, sets: 1 }],
  short: [],
};

function rec(createdAt: string, fall: boolean, nearMiss = false): SessionRecord {
  return { id: createdAt, date: createdAt.slice(0, 10), createdAt, kind: 'standard', completed: [], fall, nearMiss };
}

describe('reviewNotice', () => {
  const settings = { menuSetAt: '2026-11-01T10:00:00.000Z' };

  it('見直し日の前日までは知らせない', () => {
    expect(reviewNotice(menu, settings, [], '2026-11-13').overdue).toBe(false);
    expect(reviewNotice(menu, settings, [], '2027-01-29').overdue).toBe(false);
  });

  it('見直し日を過ぎたら知らせる', () => {
    const n = reviewNotice(menu, settings, [], '2027-01-30');
    expect(n.reviewDate).toBe('2027-01-30');
    expect(n.overdue).toBe(true);
  });

  it('メニュー設定の後の転倒・ヒヤリだけを数える', () => {
    expect(reviewNotice(menu, settings, [rec('2026-10-30T10:00:00.000Z', true)], '2026-11-13').fallOrNearMiss).toBe(false);
    expect(reviewNotice(menu, settings, [rec('2026-11-05T10:00:00.000Z', false, true)], '2026-11-13').fallOrNearMiss).toBe(true);
    expect(reviewNotice(menu, settings, [rec('2026-11-05T10:00:00.000Z', false)], '2026-11-13').fallOrNearMiss).toBe(false);
  });
});
