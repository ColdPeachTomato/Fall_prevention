// メニューの検証。読み込み時に必ず通す。
// 知らない版、知らない運動ID、その運動にないレベル、範囲外の値があれば、全体を拒否する。

import { findExercise } from '../data/exercises';
import {
  AMOUNT_RANGE,
  INTENSITY_CAP_MAX_LENGTH,
  REVIEW_DAYS_RANGE,
  SETS_RANGE,
  WALK_DAYS_RANGE,
  WALK_MINUTES_RANGE,
  inRange,
} from '../data/limits';
import type { Level, Menu, MenuItem, SupportStage } from '../data/types';

export type ValidationResult = { ok: true; menu: Menu } | { ok: false; errors: string[] };

const SUPPORT_STAGES: SupportStage[] = ['both', 'one', 'fingertip', 'none'];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function isValidDateString(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function validateItems(raw: unknown, label: string, errors: string[], requireOne: boolean): MenuItem[] {
  if (!Array.isArray(raw)) {
    errors.push(`${label}の種目の一覧がありません`);
    return [];
  }
  if (requireOne && raw.length === 0) {
    errors.push(`${label}に種目が1つもありません`);
  }
  const items: MenuItem[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const where = `${label}の${i + 1}番目`;
    if (!isObject(item)) {
      errors.push(`${where}の形が正しくありません`);
      return;
    }
    const ex = typeof item.ex === 'string' ? findExercise(item.ex) : undefined;
    if (!ex) {
      errors.push(`${where}：知らない運動IDです（${String(item.ex)}）`);
      return;
    }
    if (ex.category === 'walking' || ex.unit === 'minutes') {
      errors.push(`${where}：歩行はセッションの種目に入れられません`);
      return;
    }
    if (seen.has(ex.id)) {
      errors.push(`${where}：${ex.id} が重複しています`);
      return;
    }
    seen.add(ex.id);
    const level = item.level;
    if (!ex.variants.some((v) => v.level === level)) {
      errors.push(`${where}：${ex.id} にレベル ${String(level)} はありません`);
      return;
    }
    const range = AMOUNT_RANGE[ex.unit];
    if (typeof item.amount !== 'number' || !inRange(item.amount, range)) {
      errors.push(`${where}：${ex.id} の量は ${range.min}〜${range.max} の整数にしてください`);
      return;
    }
    if (typeof item.sets !== 'number' || !inRange(item.sets, SETS_RANGE)) {
      errors.push(`${where}：${ex.id} のセット数は ${SETS_RANGE.min}〜${SETS_RANGE.max} の整数にしてください`);
      return;
    }
    items.push({ ex: ex.id, level: level as Level, amount: item.amount, sets: item.sets });
  });
  return items;
}

export function validateMenu(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { ok: false, errors: ['メニューの形が正しくありません'] };
  }
  if (input.v !== 1) {
    return { ok: false, errors: [`知らない版のメニューです（${String(input.v)}）`] };
  }
  if (!isValidDateString(input.issuedOn)) {
    errors.push('作成日が正しくありません');
  }
  if (typeof input.reviewAfterDays !== 'number' || !inRange(input.reviewAfterDays, REVIEW_DAYS_RANGE)) {
    errors.push(`見直し日数は ${REVIEW_DAYS_RANGE.min}〜${REVIEW_DAYS_RANGE.max} の整数にしてください`);
  }
  if (!SUPPORT_STAGES.includes(input.support as SupportStage)) {
    errors.push('支えの段階が正しくありません');
  }
  const cap = typeof input.intensityCap === 'string' ? input.intensityCap.trim() : '';
  if (cap.length === 0 || cap.length > INTENSITY_CAP_MAX_LENGTH) {
    errors.push(`強度の上限は 1〜${INTENSITY_CAP_MAX_LENGTH} 文字で入力してください`);
  }
  const standard = validateItems(input.standard, '標準セッション', errors, true);
  const short = validateItems(input.short, '短いセッション', errors, false);

  let walking: Menu['walking'];
  if (input.walking !== undefined) {
    const w = input.walking;
    if (!isObject(w)) {
      errors.push('歩行の設定の形が正しくありません');
    } else if (typeof w.minutes !== 'number' || !inRange(w.minutes, WALK_MINUTES_RANGE)) {
      errors.push(`歩行の時間は ${WALK_MINUTES_RANGE.min}〜${WALK_MINUTES_RANGE.max} 分の整数にしてください`);
    } else if (typeof w.daysPerWeek !== 'number' || !inRange(w.daysPerWeek, WALK_DAYS_RANGE)) {
      errors.push(`歩行の日数は週 ${WALK_DAYS_RANGE.min}〜${WALK_DAYS_RANGE.max} 日の整数にしてください`);
    } else {
      walking = { minutes: w.minutes, daysPerWeek: w.daysPerWeek };
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const menu: Menu = {
    v: 1,
    issuedOn: input.issuedOn as string,
    reviewAfterDays: input.reviewAfterDays as number,
    support: input.support as SupportStage,
    intensityCap: cap,
    standard,
    short,
  };
  if (walking) menu.walking = walking;
  return { ok: true, menu };
}
