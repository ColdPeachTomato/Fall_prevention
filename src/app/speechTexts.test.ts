import { describe, expect, it } from 'vitest';
import type { Menu } from '../data/types';
import { buildSessionSteps } from './sessionPlan';
import { shouldAnnounceName, speechForCount, speechForStep } from './speechTexts';

const menu: Menu = {
  v: 1,
  issuedOn: '2026-11-14',
  reviewAfterDays: 90,
  support: 'both',
  intensityCap: 'ややきつい',
  standard: [
    { ex: 'S4', level: 1, amount: 3, sets: 2 }, // 座位・左右あり
    { ex: 'B1', level: 2, amount: 10, sets: 1 }, // 立位・秒
  ],
  short: [],
};

describe('読み上げる文', () => {
  const steps = buildSessionSteps(menu, 'standard');
  const names: Record<string, string> = { S4: '膝伸ばし', B1: '足をそろえて立つ' };
  const texts = steps.map((s, i) => speechForStep(s, names[s.exId]!, shouldAnnounceName(steps, i)));

  it('開始：種目の名前と、どちら側から行うかを伝える', () => {
    expect(texts[0]).toBe('膝伸ばし。右側から行います。まもなく始めます。');
  });

  it('切り替え：反対側に替わることを伝える', () => {
    expect(texts).toContain('反対側、左側です。まもなく始めます。');
  });

  it('休憩：次のセット、次の種目を伝える', () => {
    expect(texts).toContain('休憩です。もう1セット行います。');
    expect(texts).toContain('休憩です。次は、足をそろえて立つです。');
  });

  it('立って行う種目の前に、つかまる所の確認を伝える', () => {
    expect(texts).toContain('足をそろえて立つ。つかまる所が、すぐ横にあるか、確かめてください。');
  });

  it('秒数で行う種目は、保つ時間を伝える。回数で行う種目は、数を1回ずつ読む', () => {
    expect(texts).toContain('10秒、そのまま保ちます。');
    expect(texts).toContain('まもなく始めます。'); // つかまる所の確認で名前を読んだ後は、名前をくり返さない
    const repStep = steps.find((s) => s.kind === 'exercise' && s.unit === 'reps')!;
    expect(speechForStep(repStep, '膝伸ばし', false)).toBe('');
    expect(speechForCount(3)).toBe('3');
  });

  it('回す向きがある種目は、向きと、向きを替えることを伝える', () => {
    const m: Menu = { ...menu, standard: [{ ex: 'W1', level: 1, amount: 5, sets: 1 }, { ex: 'W2', level: 1, amount: 5, sets: 1 }] };
    const s = buildSessionSteps(m, 'standard');
    const name: Record<string, string> = { W1: '足首回し', W2: '腕回し' };
    const spoken = s.map((x, i) => speechForStep(x, name[x.exId]!, shouldAnnounceName(s, i))).filter((x) => x !== '');
    expect(spoken).toEqual([
      '足首回し。右側から行います。外回しです。まもなく始めます。',
      '次は、内回しです。まもなく始めます。',
      '反対側、左側です。外回しです。まもなく始めます。',
      '次は、内回しです。まもなく始めます。',
      '休憩です。次は、腕回しです。',
      '腕回し。後ろ回しです。まもなく始めます。',
      '次は、前回しです。まもなく始めます。',
    ]);
  });

  it('回数や秒数は、メニューの値をそのまま読む（S-8）', () => {
    for (const s of steps) {
      if (s.kind === 'exercise' && s.exId === 'B1') expect(s.amount).toBe(10);
      if (s.kind === 'exercise' && s.exId === 'S4') expect(s.amount).toBe(3);
    }
  });
});
