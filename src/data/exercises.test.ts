// 運動データの検査。目的の一文（purpose）が、どの種目にもあり、決まりを守っていることを確かめる。

import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';

describe('目的の一文', () => {
  it('23種目すべてにあり、一文で、17文字以内（スマホの画面で1行に収まる）', () => {
    expect(EXERCISES).toHaveLength(23);
    for (const ex of EXERCISES) {
      expect(ex.purpose.length, ex.id).toBeGreaterThanOrEqual(8);
      expect(ex.purpose.length, ex.id).toBeLessThanOrEqual(17);
      expect(ex.purpose, ex.id).not.toMatch(/[。！？]/); // 一文で、句点は付けない
      expect(ex.purpose, ex.id).toMatch(/ましょう$/); // 呼びかける言い方にそろえる
    }
  });

  it('病気の治療や予防の効果をうたう言葉を使わない（要件メモ「やらないこと」）', () => {
    const banned = ['治', '予防', '防', '改善', '効果', '効く', '病', '転倒', '転ば', 'フレイル', '骨折', '認知', '若返'];
    for (const ex of EXERCISES) {
      for (const word of banned) expect(ex.purpose.includes(word), `${ex.id}：${word}`).toBe(false);
    }
  });

  it('専門用語を使わない（やさしい言葉で書く）', () => {
    const jargon = ['筋', '関節', '可動', '体幹', '重心', '支持', 'タンデム', '股', '背屈', '底屈'];
    for (const ex of EXERCISES) {
      for (const word of jargon) expect(ex.purpose.includes(word), `${ex.id}：${word}`).toBe(false);
    }
  });

  it('バランスの種目は、どれも「バランスを保ちましょう」で終わる', () => {
    for (const ex of EXERCISES.filter((e) => e.category === 'balance')) expect(ex.purpose, ex.id).toMatch(/バランスを保ちましょう$/);
  });
});
