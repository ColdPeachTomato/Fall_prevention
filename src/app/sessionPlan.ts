// メニューから、1回のセッションで行う手順の列を作る。
// レベル・回数・秒数・セット数はメニューの値だけを使う（S-8）。メニューにない種目は入れない（S-9）。

import { getAnimation } from '../animation/registry';
import { getExercise } from '../data/exercises';
import type { Level, Menu, SessionKind, SupportStage, Unit } from '../data/types';
import { effectiveSupport } from '../menu/support';

// アニメがない種目の仮の時間。アニメがある種目は、アニメの1往復の時間を1回の時間にする
export const SECONDS_PER_REP = 5; // 上げ下げ 各2.5秒
export const SECONDS_PER_LAP = 20;
export const REST_SECONDS = 30;
export const COUNTDOWN_SECONDS = 5;

export type Side = 'right' | 'left';
// 回す向き（外回し・内回しなど）。2つ目の向きは、アニメを逆向きに再生する
export interface Direction {
  label: string;
  index: 0 | 1;
}

export type Step =
  | {
      kind: 'supportCheck'; // 立って行う種目の前の、つかまる所の確認（S-6）。押すまで進まない
      exId: string;
      level: Level;
      support: SupportStage | null;
    }
  | { kind: 'countdown'; exId: string; seconds: number; side: Side | null; direction: Direction | null }
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
      direction: Direction | null;
      seconds: number;
      unitSeconds: number; // 1回・1往復・1秒あたりの時間。カウントの表示に使う
      lastOfItem: boolean; // この種目の最後の手順か（終えたら「終えた運動」に入れる）
    }
  | { kind: 'rest'; exId: string; seconds: number; reason: 'set' | 'next' }; // exId は次に行う種目

// 1回（1往復、1秒）あたりの時間。回数で行う種目は、アニメの1往復の終わりを回数のカウントに合わせる
export function unitSeconds(unit: Exclude<Unit, 'minutes'>, animationId: string | null): number {
  if (unit === 'reps') {
    // 左右交互の種目は、1往復の中で2回数える
    const anim = getAnimation(animationId);
    return anim ? anim.cycleSeconds / (anim.countsPerCycle ?? 1) : SECONDS_PER_REP;
  }
  if (unit === 'laps') return SECONDS_PER_LAP;
  return 1;
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
    // 回す向きがある種目は、向きごとにメニューの回数を行う（例：外回し5回、内回し5回のあと、足を替える）
    const directions: (Direction | null)[] = ex.directions ? [{ label: ex.directions[0], index: 0 }, { label: ex.directions[1], index: 1 }] : [null];
    const perUnit = unitSeconds(unit, variant.animationId);

    if (itemIndex > 0) steps.push({ kind: 'rest', exId: ex.id, seconds: REST_SECONDS, reason: 'next' });
    if (variant.posture === 'standing') {
      steps.push({ kind: 'supportCheck', exId: ex.id, level: item.level, support });
    }
    for (let set = 1; set <= item.sets; set++) {
      if (set > 1) steps.push({ kind: 'rest', exId: ex.id, seconds: REST_SECONDS, reason: 'set' });
      sides.forEach((side, sideIndex) => {
        directions.forEach((direction, directionIndex) => {
          steps.push({ kind: 'countdown', exId: ex.id, seconds: COUNTDOWN_SECONDS, side, direction });
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
            direction,
            seconds: item.amount * perUnit,
            unitSeconds: perUnit,
            lastOfItem: set === item.sets && sideIndex === sides.length - 1 && directionIndex === directions.length - 1,
          });
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
