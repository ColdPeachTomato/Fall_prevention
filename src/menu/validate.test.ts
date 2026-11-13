import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { validateMenu } from './validate';

function baseMenu(): Record<string, unknown> {
  return {
    v: 1,
    issuedOn: '2026-11-13',
    reviewAfterDays: 90,
    support: 'both',
    intensityCap: 'ややきついと感じるところまで',
    standard: [
      { ex: 'W1', level: 1, amount: 5, sets: 1 },
      { ex: 'S1', level: 2, amount: 8, sets: 1 },
      { ex: 'B1', level: 2, amount: 10, sets: 2 },
      { ex: 'D3', level: 2, amount: 2, sets: 1 },
    ],
    short: [{ ex: 'S1', level: 1, amount: 5, sets: 1 }],
    walking: { minutes: 20, daysPerWeek: 3 },
  };
}

function errorsOf(input: unknown): string[] {
  const r = validateMenu(input);
  return r.ok ? [] : r.errors;
}

describe('運動データ', () => {
  it('23種類あり、IDが重複しない', () => {
    expect(EXERCISES).toHaveLength(23);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(23);
  });
});

describe('validateMenu', () => {
  it('正しいメニューを受け入れる', () => {
    const r = validateMenu(baseMenu());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.menu.standard).toHaveLength(4);
      expect(r.menu.walking).toEqual({ minutes: 20, daysPerWeek: 3 });
    }
  });

  it('知らない項目は取り除き、強度の上限の前後の空白を削る', () => {
    const m = { ...baseMenu(), extra: 'x', intensityCap: '  ややきつい  ' };
    const r = validateMenu(m);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect('extra' in r.menu).toBe(false);
      expect(r.menu.intensityCap).toBe('ややきつい');
    }
  });

  it('歩行の設定と短いセッションの種目はなくてもよい', () => {
    const m = baseMenu();
    delete m.walking;
    m.short = [];
    expect(validateMenu(m).ok).toBe(true);
  });

  it.each([null, 'text', 1, []])('オブジェクトでないものを拒否する（%s）', (input) => {
    expect(validateMenu(input).ok).toBe(false);
  });

  it('知らない版を拒否する', () => {
    expect(errorsOf({ ...baseMenu(), v: 2 })[0]).toContain('知らない版');
    const m = baseMenu();
    delete m.v;
    expect(validateMenu(m).ok).toBe(false);
  });

  it('知らない運動IDを拒否する', () => {
    const m = baseMenu();
    m.standard = [{ ex: 'X9', level: 1, amount: 5, sets: 1 }];
    expect(errorsOf(m).join()).toContain('知らない運動ID');
  });

  it('その運動にないレベルを拒否する', () => {
    const m = baseMenu();
    m.standard = [{ ex: 'W4', level: 1, amount: 5, sets: 1 }]; // W4 はレベル2だけ
    expect(errorsOf(m).join()).toContain('レベル 1 はありません');
  });

  it('歩行（G1）をセッションの種目に入れると拒否する', () => {
    const m = baseMenu();
    m.standard = [{ ex: 'G1', level: 1, amount: 10, sets: 1 }];
    expect(validateMenu(m).ok).toBe(false);
  });

  it('同じ種目の重複を拒否する', () => {
    const m = baseMenu();
    m.standard = [
      { ex: 'S1', level: 1, amount: 5, sets: 1 },
      { ex: 'S1', level: 2, amount: 5, sets: 1 },
    ];
    expect(validateMenu(m).ok).toBe(false);
  });

  it('標準セッションが空なら拒否する', () => {
    const m = baseMenu();
    m.standard = [];
    expect(validateMenu(m).ok).toBe(false);
  });

  it.each([
    ['回数 0', 'S1', 2, 0, 1],
    ['回数 21', 'S1', 2, 21, 1],
    ['秒数 4', 'B1', 2, 4, 1],
    ['秒数 61', 'B1', 2, 61, 1],
    ['往復 0', 'D3', 2, 0, 1],
    ['往復 11', 'D3', 2, 11, 1],
    ['小数', 'S1', 2, 5.5, 1],
    ['セット 0', 'S1', 2, 8, 0],
    ['セット 4', 'S1', 2, 8, 4],
  ])('範囲外の値を拒否する（%s）', (_label, ex, level, amount, sets) => {
    const m = baseMenu();
    m.standard = [{ ex, level, amount, sets }];
    expect(validateMenu(m).ok).toBe(false);
  });

  it.each([
    ['回数 1', 'S1', 1],
    ['回数 20', 'S1', 20],
    ['秒数 5', 'B1', 5],
    ['秒数 60', 'B1', 60],
    ['往復 1', 'D3', 1],
    ['往復 10', 'D3', 10],
  ])('範囲の端の値は受け入れる（%s）', (_label, ex, amount) => {
    const m = baseMenu();
    m.standard = [{ ex, level: 2, amount, sets: 3 }];
    expect(validateMenu(m).ok).toBe(true);
  });

  it.each([29, 181, 90.5, '90'])('範囲外の見直し日数を拒否する（%s）', (days) => {
    expect(validateMenu({ ...baseMenu(), reviewAfterDays: days }).ok).toBe(false);
  });

  it.each([30, 180])('見直し日数の端は受け入れる（%s）', (days) => {
    expect(validateMenu({ ...baseMenu(), reviewAfterDays: days }).ok).toBe(true);
  });

  it.each(['2026-02-30', '2026/11/13', '', 20261113])('正しくない作成日を拒否する（%s）', (d) => {
    expect(validateMenu({ ...baseMenu(), issuedOn: d }).ok).toBe(false);
  });

  it('知らない支えの段階を拒否する', () => {
    expect(validateMenu({ ...baseMenu(), support: 'half' }).ok).toBe(false);
  });

  it('空の強度の上限を拒否する', () => {
    expect(validateMenu({ ...baseMenu(), intensityCap: '   ' }).ok).toBe(false);
  });

  it.each([
    [{ minutes: 0, daysPerWeek: 3 }],
    [{ minutes: 61, daysPerWeek: 3 }],
    [{ minutes: 20, daysPerWeek: 0 }],
    [{ minutes: 20, daysPerWeek: 8 }],
    ['20分'],
  ])('範囲外の歩行の設定を拒否する（%j）', (walking) => {
    expect(validateMenu({ ...baseMenu(), walking }).ok).toBe(false);
  });

  it('誤りが1つでもあれば全体を拒否する', () => {
    const m = baseMenu();
    (m.standard as unknown[]).push({ ex: 'S1', level: 9, amount: 5, sets: 1 });
    const r = validateMenu(m);
    expect(r.ok).toBe(false);
  });
});
