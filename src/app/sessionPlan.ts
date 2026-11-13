// メニューから、1回のセッションで行う手順の列を作る。
// レベル・回数・秒数・セット数はメニューの値だけを使う（S-8）。メニューにない種目は入れない（S-9）。

import { getExercise } from '../data/exercises';
import type { Level, Menu, SessionKind, SupportStage, Unit } from '../data/types';
import { effectiveSupport } from '../menu/support';

// アニメができるまでの仮の時間（フェーズ2以降はアニメの1往復の時間に合わせる）
export const SECONDS_PER_REP = 5; // 上げ下げ 各2.5秒
export const SECONDS_PER_LAP = 20;
export const REST_SECONDS = 30;
export const COUNTDOWN_SECONDS = 5;

export type Side = 'right' | 'left';

export type Step =
  | {
      kind: 'supportCheck'; // 立って行う種目の前の、つかまる所の確認（S-6）。押すまで進まない
      exId: string;
      level: Level;
      support: SupportStage | null;
    }
  | { kind: 'countdown'; exId: string; seconds: number; side: Side | null }
  | {
      kind: 'exercise';
      exId: string;
      level: Level;
      support: SupportStage | null;
      unit: Exclude<Unit, 'minutes'>;
      amount: number;
      set: number;
      sets: number;
      side: Side | null;
      seconds: number;
      lastOfItem: boolean; // この種目の最後の手順か（終えたら「終えた運動」に入れる）
    }
  | { kind: 'rest'; exId: string; seconds: number; reason: 'set' | 'next' }; // exId は次に行う種目

export function exerciseSeconds(unit: Exclude<Unit, 'minutes'>, amount: number): number {
  if (unit === 'reps') return amount * SECONDS_PER_REP;
  if (unit === 'laps') return amount * SECONDS_PER_LAP;
  return amount;
}

export function buildSessionSteps(menu: Menu, kind: SessionKind): Step[] {
  const steps: Step[] = [];
  const items = kind === 'standard' ? menu.standard : menu.short;
  items.forEach((item, itemIndex) => {
    const ex = getExercise(item.ex);
    const variant = ex.variants.find((v) => v.level === item.level);
    if (!variant || ex.unit === 'minutes') return;
    const unit = ex.unit;
    const support = effectiveSupport(menu.support, ex, variant);
    const sides: (Side | null)[] = ex.bilateral ? ['right', 'left'] : [null];

    if (itemIndex > 0) steps.push({ kind: 'rest', exId: ex.id, seconds: REST_SECONDS, reason: 'next' });
    if (variant.posture === 'standing') {
      steps.push({ kind: 'supportCheck', exId: ex.id, level: item.level, support });
    }
    for (let set = 1; set <= item.sets; set++) {
      if (set > 1) steps.push({ kind: 'rest', exId: ex.id, seconds: REST_SECONDS, reason: 'set' });
      sides.forEach((side, sideIndex) => {
        steps.push({ kind: 'countdown', exId: ex.id, seconds: COUNTDOWN_SECONDS, side });
        steps.push({
          kind: 'exercise',
          exId: ex.id,
          level: item.level,
          support,
          unit,
          amount: item.amount,
          set,
          sets: item.sets,
          side,
          seconds: exerciseSeconds(unit, item.amount),
          lastOfItem: set === item.sets && sideIndex === sides.length - 1,
        });
      });
    }
  });
  return steps;
}

// 手順の長さ（秒）。確認の手順は押すまで進まないので null
export function stepSeconds(step: Step): number | null {
  return step.kind === 'supportCheck' ? null : step.seconds;
}
