import { describe, expect, it } from 'vitest';
import type { Menu } from '../data/types';
import { buildSessionSteps } from './sessionPlan';

const menu: Menu = {
  v: 1,
  issuedOn: '2026-11-13',
  reviewAfterDays: 90,
  support: 'both',
  intensityCap: 'ややきつい',
  standard: [
    { ex: 'S4', level: 1, amount: 8, sets: 1 }, // 座位・左右あり
    { ex: 'B1', level: 2, amount: 10, sets: 2 }, // 立位・秒
  ],
  short: [{ ex: 'S1', level: 1, amount: 5, sets: 1 }],
};

describe('buildSessionSteps', () => {
  it('メニューの種目だけを、メニューの値どおりに並べる', () => {
    const steps = buildSessionSteps(menu, 'standard');
    const exercises = steps.filter((s) => s.kind === 'exercise');
    expect(new Set(exercises.map((s) => s.exId))).toEqual(new Set(['S4', 'B1']));
    for (const s of exercises) {
      if (s.exId === 'S4') expect(s.amount).toBe(8);
      if (s.exId === 'B1') expect(s.amount).toBe(10);
    }
  });

  it('左右がある種目は右・左の順に行う', () => {
    const steps = buildSessionSteps(menu, 'standard').filter((s) => s.kind === 'exercise' && s.exId === 'S4');
    expect(steps.map((s) => (s.kind === 'exercise' ? s.side : null))).toEqual(['right', 'left']);
  });

  it('立って行う種目の前にだけ、つかまる所の確認を入れる', () => {
    const checks = buildSessionSteps(menu, 'standard').filter((s) => s.kind === 'supportCheck');
    expect(checks.map((s) => s.exId)).toEqual(['B1']);
  });

  it('セットの間と種目の間に休憩を入れる', () => {
    const rests = buildSessionSteps(menu, 'standard').filter((s) => s.kind === 'rest');
    expect(rests.map((s) => (s.kind === 'rest' ? s.reason : ''))).toEqual(['next', 'set']);
  });

  it('種目の最後の手順に印を付ける', () => {
    const last = buildSessionSteps(menu, 'standard').filter((s) => s.kind === 'exercise' && s.lastOfItem);
    expect(last.map((s) => s.exId)).toEqual(['S4', 'B1']);
  });

  it('種目の支えの下限を守る（S3 立位は両手）', () => {
    const m: Menu = { ...menu, support: 'none', standard: [{ ex: 'S3', level: 2, amount: 8, sets: 1 }] };
    const ex = buildSessionSteps(m, 'standard').find((s) => s.kind === 'exercise');
    expect(ex && ex.kind === 'exercise' ? ex.support : undefined).toBe('both');
  });

  it('片手で動作する種目は、両手の指定でも片手にする（W2 立位）', () => {
    const m: Menu = { ...menu, support: 'both', standard: [{ ex: 'W2', level: 2, amount: 5, sets: 1 }] };
    const ex = buildSessionSteps(m, 'standard').find((s) => s.kind === 'exercise');
    expect(ex && ex.kind === 'exercise' ? ex.support : undefined).toBe('one');
  });
});
