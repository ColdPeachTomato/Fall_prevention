// メニューの値の範囲（暫定）と、メニュー作成時の初期値（暫定）

import type { Exercise, Unit } from './types';

export interface Range {
  min: number;
  max: number;
}

export const AMOUNT_RANGE: Record<Exclude<Unit, 'minutes'>, Range> = {
  reps: { min: 1, max: 20 },
  seconds: { min: 5, max: 60 },
  laps: { min: 1, max: 10 },
};
export const SETS_RANGE: Range = { min: 1, max: 3 };
export const REVIEW_DAYS_RANGE: Range = { min: 30, max: 180 };
export const DEFAULT_REVIEW_DAYS = 90;
export const WALK_MINUTES_RANGE: Range = { min: 1, max: 60 };
export const WALK_DAYS_RANGE: Range = { min: 1, max: 7 };
export const INTENSITY_CAP_MAX_LENGTH = 100;

export const UNIT_LABEL: Record<Unit, string> = {
  reps: '回',
  seconds: '秒',
  laps: '往復',
  minutes: '分',
};

// メニュー作成時の初期値
export function defaultAmount(ex: Exercise): { amount: number; sets: number } {
  if (ex.unit === 'seconds') return { amount: 10, sets: 2 };
  if (ex.unit === 'laps') return { amount: 2, sets: 1 };
  if (ex.category === 'warmup') return { amount: 5, sets: 1 };
  return { amount: 8, sets: 1 };
}

export function inRange(n: number, r: Range): boolean {
  return Number.isInteger(n) && n >= r.min && n <= r.max;
}
