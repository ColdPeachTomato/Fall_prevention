// メニューコード。`FPM1:` に続けて、メニューの JSON を base64url にした文字列。
// QR にはこの文字列をそのまま入れる（URL にはしない）。氏名など個人を特定する情報は入らない。
// 読み込むときは必ず検証し、少しでもおかしければ全体を拒否する（元のメニューはそのまま残る）。

import type { Menu } from '../data/types';
import { validateMenu, type ValidationResult } from './validate';

export const CODE_PREFIX = 'FPM1:';
// これより長い文字列は、メニューコードとして扱わない（QR に入る上限よりずっと大きい値）
const MAX_CODE_LENGTH = 8000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// メニューをコードにする。項目の順番を決めておき、同じメニューからはいつも同じコードができるようにする
export function encodeMenu(menu: Menu): string {
  const plain: Record<string, unknown> = {
    v: menu.v,
    issuedOn: menu.issuedOn,
    reviewAfterDays: menu.reviewAfterDays,
    support: menu.support,
    intensityCap: menu.intensityCap,
    standard: menu.standard.map((i) => ({ ex: i.ex, level: i.level, amount: i.amount, sets: i.sets })),
    short: menu.short.map((i) => ({ ex: i.ex, level: i.level, amount: i.amount, sets: i.sets })),
  };
  if (menu.walking) plain.walking = { minutes: menu.walking.minutes, daysPerWeek: menu.walking.daysPerWeek };
  return CODE_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(plain)));
}

// コードを読んで、メニューにする。貼り付けたときに混じる空白や改行は取り除く
export function decodeMenuCode(input: string): ValidationResult {
  const text = input.replace(/\s+/g, '');
  if (text === '') return { ok: false, errors: ['コードが入っていません'] };
  if (text.length > MAX_CODE_LENGTH) return { ok: false, errors: ['コードが長すぎます。メニューのコードではありません'] };
  if (!text.startsWith(CODE_PREFIX)) {
    if (/^FPM\d+:/.test(text)) return { ok: false, errors: ['このアプリでは読めない版のコードです'] };
    return { ok: false, errors: ['メニューのコードではありません（FPM1: で始まる文字列が必要です）'] };
  }
  const bytes = fromBase64Url(text.slice(CODE_PREFIX.length));
  if (!bytes || bytes.length === 0) return { ok: false, errors: ['コードが壊れています（文字が欠けているか、違う文字が混じっています）'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, errors: ['コードが壊れています（中身を読めません）'] };
  }
  return validateMenu(parsed);
}
