// メニューコードと QR、違いの一覧の検査。
// フェーズ4の完了条件：壊れたコードや範囲外の値を拒否する。

import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../data/exercises';
import { defaultAmount } from '../data/limits';
import type { Menu } from '../data/types';
import { CODE_PREFIX, decodeMenuCode, encodeMenu } from './code';
import { diffMenus } from './diff';
import { makeQr } from './qr';

const MENU: Menu = {
  v: 1,
  issuedOn: '2026-11-15',
  reviewAfterDays: 90,
  support: 'one',
  intensityCap: 'ややきつい と感じるところまで',
  standard: [
    { ex: 'W2', level: 1, amount: 5, sets: 1 },
    { ex: 'S1', level: 2, amount: 8, sets: 2 },
    { ex: 'B1', level: 2, amount: 10, sets: 2 },
  ],
  short: [{ ex: 'S1', level: 1, amount: 5, sets: 1 }],
  walking: { minutes: 15, daysPerWeek: 3 },
};

// いちばん大きなメニュー：選べる種目をすべて、標準にも短いセッションにも入れる。cap：強度の上限の文の長さ
function biggestMenu(cap = 100): Menu {
  const items = EXERCISES.filter((e) => e.category !== 'walking').map((e) => {
    const v = e.variants[e.variants.length - 1]!;
    return { ex: e.id, level: v.level, ...defaultAmount(e) };
  });
  return { ...MENU, intensityCap: 'あ'.repeat(cap), standard: items, short: items };
}

// コードの中身（JSON）を書き換えて、コードを作り直す
function tamper(change: (raw: Record<string, unknown>) => void): string {
  const raw = JSON.parse(JSON.stringify(MENU)) as Record<string, unknown>;
  change(raw);
  const bytes = new TextEncoder().encode(JSON.stringify(raw));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return CODE_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('メニューコード', () => {
  it('FPM1: で始まり、base64url の文字だけでできている。URL ではない', () => {
    const code = encodeMenu(MENU);
    expect(code).toMatch(/^FPM1:[A-Za-z0-9_-]+$/);
    expect(code).not.toMatch(/https?:/);
  });

  it('コードにして読み直すと、同じメニューに戻る（日本語の文も壊れない）', () => {
    const r = decodeMenuCode(encodeMenu(MENU));
    expect(r).toEqual({ ok: true, menu: MENU });
    const big = biggestMenu();
    expect(decodeMenuCode(encodeMenu(big))).toEqual({ ok: true, menu: big });
  });

  it('同じメニューからは、いつも同じコードができる（項目を書いた順番によらない）', () => {
    const shuffled = { walking: MENU.walking, short: MENU.short, standard: MENU.standard, intensityCap: MENU.intensityCap, support: MENU.support, reviewAfterDays: 90, issuedOn: MENU.issuedOn, v: 1 } as Menu;
    expect(encodeMenu(shuffled)).toBe(encodeMenu(MENU));
  });

  it('貼り付けたときに混じる空白や改行は、取り除いて読む', () => {
    const code = encodeMenu(MENU);
    const pasted = `  ${code.slice(0, 20)}\n${code.slice(20, 60)} \r\n${code.slice(60)}\n`;
    expect(decodeMenuCode(pasted)).toEqual({ ok: true, menu: MENU });
  });

  it('氏名など、メニューにない項目は読み込まない（コードに入っていても捨てる）', () => {
    const r = decodeMenuCode(tamper((raw) => (raw.name = '山田太郎')));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.menu)).not.toContain('name');
  });

  it.each([
    ['空', ''],
    ['空白だけ', '   \n'],
    ['ふつうの文', 'こんにちは'],
    ['URL', 'https://example.com/?m=FPM1:abc'],
    ['前置きが違う', `XYZ1:${encodeMenu(MENU).slice(5)}`],
    ['知らない版の前置き', `FPM2:${encodeMenu(MENU).slice(5)}`],
    ['前置きだけ', 'FPM1:'],
    ['base64 でない文字', 'FPM1:あいうえお'],
    ['記号が混じる', `${encodeMenu(MENU)}!`],
    ['JSON でない中身', `FPM1:${btoa('これはJSONではない'.replace(/[^\x00-\x7f]/g, 'x'))}`],
    ['長すぎる', `FPM1:${'A'.repeat(9000)}`],
  ])('壊れたコードを拒否する：%s', (_name, code) => {
    const r = decodeMenuCode(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it('途中で切れたコード、1文字違うコードを拒否するか、検証を通った正しい形のメニューだけを返す', () => {
    const code = encodeMenu(MENU);
    for (let cut = 6; cut < code.length; cut += 7) {
      const r = decodeMenuCode(code.slice(0, cut));
      expect(r.ok, `切れた位置 ${cut}`).toBe(false);
    }
    // 1文字を別の文字に替える。たまたま読めた場合でも、検証を通った値（範囲内）だけになる
    for (let i = 5; i < code.length; i += 3) {
      const swapped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
      const r = decodeMenuCode(swapped);
      if (r.ok) expect(decodeMenuCode(encodeMenu(r.menu))).toEqual(r);
    }
  });

  it.each([
    ['知らない版', (raw: Record<string, unknown>) => (raw.v = 2)],
    ['知らない運動ID', (raw: Record<string, unknown>) => ((raw.standard as { ex: string }[])[0]!.ex = 'Z9')],
    ['その運動にないレベル', (raw: Record<string, unknown>) => ((raw.standard as { level: number }[])[0]!.level = 3)],
    ['回数が範囲外（多い）', (raw: Record<string, unknown>) => ((raw.standard as { amount: number }[])[1]!.amount = 21)],
    ['回数が範囲外（0）', (raw: Record<string, unknown>) => ((raw.standard as { amount: number }[])[1]!.amount = 0)],
    ['秒数が範囲外', (raw: Record<string, unknown>) => ((raw.standard as { amount: number }[])[2]!.amount = 61)],
    ['セット数が範囲外', (raw: Record<string, unknown>) => ((raw.short as { sets: number }[])[0]!.sets = 4)],
    ['見直し日数が範囲外', (raw: Record<string, unknown>) => (raw.reviewAfterDays = 181)],
    ['小数の回数', (raw: Record<string, unknown>) => ((raw.standard as { amount: number }[])[1]!.amount = 8.5)],
    ['文字の回数', (raw: Record<string, unknown>) => ((raw.standard as { amount: unknown }[])[1]!.amount = '8')],
    ['知らない支えの段階', (raw: Record<string, unknown>) => (raw.support = 'three')],
    ['ありえない日付', (raw: Record<string, unknown>) => (raw.issuedOn = '2026-02-30')],
    ['歩行の時間が範囲外', (raw: Record<string, unknown>) => (raw.walking = { minutes: 61, daysPerWeek: 3 })],
    ['標準セッションが空', (raw: Record<string, unknown>) => (raw.standard = [])],
    ['配列の中身', (raw: Record<string, unknown>) => (raw.standard = 'S1')],
  ])('範囲外・知らない値を、全体ごと拒否する：%s', (_name, change) => {
    const r = decodeMenuCode(tamper(change));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });
});

// QR を画像（白黒の点の並び）にして、読み取りのライブラリで読み直す
function scan(text: string): string | null {
  const qr = makeQr(text);
  if (!qr) return null;
  const cell = 4;
  const margin = 4 * cell;
  const side = qr.size * cell + margin * 2;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.dark[r]![c]) continue;
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const p = ((margin + r * cell + y) * side + margin + c * cell + x) * 4;
          data[p] = data[p + 1] = data[p + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, side, side)?.data ?? null;
}

describe('QR', () => {
  it('作った QR を読み取ると、同じコードになり、同じメニューに戻る', () => {
    const code = encodeMenu(MENU);
    const read = scan(code);
    expect(read).toBe(code);
    expect(decodeMenuCode(read!)).toEqual({ ok: true, menu: MENU });
  });

  it('全種目を標準にも短いセッションにも入れたメニューでも、QR に入り、読み取れる（マスが細かいので L で作る）', () => {
    const code = encodeMenu(biggestMenu(20));
    const qr = makeQr(code);
    expect(qr).not.toBeNull();
    expect(qr!.level).toBe('L');
    expect(scan(code)).toBe(code);
  });

  it('それに 100 文字の強度の上限まで入れると、QR には入らない（コードの貼り付けで渡す）。コードとしては読める', () => {
    const big = biggestMenu(100);
    const code = encodeMenu(big);
    expect(makeQr(code)).toBeNull();
    expect(decodeMenuCode(code)).toEqual({ ok: true, menu: big });
  });

  it('ふつうの大きさのメニュー（標準10種目、短い4種目）は、1辺 113 マス以下に収まる', () => {
    const all = biggestMenu(20);
    const menu: Menu = { ...all, standard: all.standard.slice(0, 10), short: all.short.slice(0, 4) };
    expect(makeQr(encodeMenu(menu))!.size).toBeLessThanOrEqual(113);
  });

  it('ふつうのメニューは、誤り訂正が強いほう（M）で作る', () => {
    expect(makeQr(encodeMenu(MENU))?.level).toBe('M');
  });

  it('入りきらない長さのときは、QR を作らない（null を返す）', () => {
    expect(makeQr('A'.repeat(5000))).toBeNull();
  });
});

describe('違いの一覧', () => {
  it('はじめてのメニューは、そう伝える', () => {
    expect(diffMenus(null, MENU)).toEqual(['はじめてのメニューです（いまは、メニューが設定されていません）']);
  });

  it('同じ内容なら、違いはないと伝える', () => {
    expect(diffMenus(MENU, JSON.parse(JSON.stringify(MENU)) as Menu)).toEqual(['違いはありません（いまのメニューと同じ内容です）']);
  });

  it('追加・変更・やめる種目、支え、強度の上限、歩行、見直しの違いを、もれなく挙げる', () => {
    const next: Menu = {
      ...MENU,
      issuedOn: '2026-12-01',
      reviewAfterDays: 60,
      support: 'fingertip',
      intensityCap: '楽である と感じるところまで',
      standard: [
        { ex: 'S1', level: 3, amount: 10, sets: 2 },
        { ex: 'W2', level: 1, amount: 5, sets: 1 },
        { ex: 'S6', level: 2, amount: 8, sets: 1 },
      ],
      short: [],
      walking: undefined,
    };
    delete next.walking;
    const lines = diffMenus(MENU, next);
    expect(lines).toContain('作成日：2026-11-15 → 2026-12-01');
    expect(lines).toContain('見直し日数：90日 → 60日');
    expect(lines).toContain('見直しの目安の日：2027-02-13 → 2027-01-30');
    expect(lines).toContain('立って行う種目の支え：片手でつかまる → 指先を軽く添える');
    expect(lines).toContain('強度の上限：「ややきつい と感じるところまで」 → 「楽である と感じるところまで」');
    expect(lines).toContain('標準セッション：S1 椅子からの立ち座り を変更（レベル 2 → 3、8回 → 10回）');
    expect(lines).toContain('標準セッション：S6 脚の横上げ を追加（レベル2、8回 × 1セット）');
    expect(lines).toContain('標準セッション：B1 足をそろえて立つ をやめる（レベル2、10秒 × 2セット）');
    expect(lines).toContain('標準セッション：種目の順番が変わります');
    expect(lines).toContain('短いセッション：S1 椅子からの立ち座り をやめる（レベル1、5回 × 1セット）');
    expect(lines).toContain('歩行：1回 15分、週 3日 → なし');
    expect(lines).toHaveLength(11);
  });

  it('1か所だけ変えたら、違いは1つだけ', () => {
    const next: Menu = { ...MENU, standard: MENU.standard.map((i) => (i.ex === 'B1' ? { ...i, sets: 1 } : i)) };
    expect(diffMenus(MENU, next)).toEqual(['標準セッション：B1 足をそろえて立つ を変更（2セット → 1セット）']);
  });
});
