import { describe, expect, it } from 'vitest';
import { ANIMATIONS } from '../animation/registry';
import { EXERCISES } from '../data/exercises';
import type { Menu } from '../data/types';
import { SAFE_KANJI, toReading } from './readings';
import { buildSessionSteps } from './sessionPlan';
import { SPEECH, shouldAnnounceName, speechForStep } from './speechTexts';

// 読み上げる可能性のある文をすべて集める（種目の名前、字幕、手順の切り替えの文）
function allSpokenTexts(): string[] {
  const texts = new Set<string>(Object.values(SPEECH));
  for (const anim of ANIMATIONS) {
    for (const c of [...anim.captions, ...(anim.reverseCaptions ?? [])]) texts.add(c.text);
  }
  for (const ex of EXERCISES) {
    if (ex.unit === 'minutes') continue;
    texts.add(ex.name);
    for (const variant of ex.variants) {
      // この種目を2セット行い、次の種目へ進むメニューで、読み上げる文をすべて出す
      const menu: Menu = {
        v: 1,
        issuedOn: '2026-11-14',
        reviewAfterDays: 90,
        support: 'both',
        intensityCap: '',
        standard: [
          { ex: ex.id, level: variant.level, amount: 10, sets: 2 },
          { ex: ex.id === 'S1' ? 'S2' : 'S1', level: 1, amount: 1, sets: 1 },
        ],
        short: [],
      };
      const steps = buildSessionSteps(menu, 'standard');
      steps.forEach((s, i) => {
        const name = EXERCISES.find((e) => e.id === s.exId)!.name;
        const text = speechForStep(s, name, shouldAnnounceName(steps, i));
        if (text !== '') texts.add(text);
      });
    }
  }
  return [...texts];
}

describe('読み上げ用の読み方', () => {
  it('読み方を取り違えやすい言葉を、ひらがなに直す', () => {
    expect(toReading('肩甲骨寄せ（バンド）')).toBe('けんこうこつよせ（バンド）');
    expect(toReading('肩甲骨を寄せて止めます。肩は上げません')).toBe('けんこうこつを寄せてとめます。肩はあげません');
    expect(toReading('次は、前回しです。まもなく始めます。')).toBe('次は、まえまわしです。まもなく始めます。');
    expect(toReading('足首回し。右側から行います。外回しです。まもなく始めます。')).toBe('あしくびまわし。右側からおこないます。そとまわしです。まもなく始めます。');
    expect(toReading('背筋を伸ばして座ります')).toBe('せすじを伸ばして座ります');
    expect(toReading('脚の横上げ')).toBe('あしのよこあげ');
    expect(toReading('休憩です。もう1セット行います。')).toBe('休憩です。もう いちセットおこないます。');
  });

  it('読み上げるすべての文で、残る漢字は「そのままで自然に読める言葉」だけ', () => {
    const texts = allSpokenTexts();
    expect(texts.length).toBeGreaterThan(60);
    const left: string[] = [];
    for (const text of texts) {
      let rest = toReading(text);
      // 長い言葉から順に取り除き、漢字が残らないことを確かめる
      for (const word of [...SAFE_KANJI].sort((x, y) => y.length - x.length)) rest = rest.split(word).join('');
      const kanji = rest.match(/[\u4e00-\u9fff々]+/g);
      if (kanji) left.push(`${kanji.join('・')}：「${text}」→「${toReading(text)}」`);
    }
    expect(left).toEqual([]);
  });

  it('画面に出す文は変えない（直すのは読み上げだけ）', () => {
    expect(EXERCISES.find((e) => e.id === 'S8')?.name).toBe('肩甲骨寄せ（バンド）');
  });
});
