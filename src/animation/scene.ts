// 視点によらず、1コマ分の計算と描画を行う入口。

import { drawFrame, VIEW, type Ctx, type DrawOptions, type ViewBox } from './draw';
import { drawFrontFrame } from './drawFront';
import { computeFrontFrame, type FrontFrame } from './frontRig';
import { computeFrame, type Frame } from './sideRig';
import type { AnimationData } from './types';

export type AnyFrame = Frame | FrontFrame;

// 時刻 t の1コマ分（姿勢、体の各点、重心、支えの範囲）を求める
export function frameOf(anim: AnimationData, t: number): AnyFrame {
  return anim.view === 'side' ? computeFrame(anim, t) : computeFrontFrame(anim, t);
}

// 時刻 t の1コマを描く
export function drawScene(ctx: Ctx, anim: AnimationData, t: number, o: DrawOptions): void {
  if (anim.view === 'side') drawFrame(ctx, anim, computeFrame(anim, t), o);
  else drawFrontFrame(ctx, anim, computeFrontFrame(anim, t), o);
}

// 表示する範囲
export function viewBoxOf(anim: AnimationData): ViewBox {
  return anim.view === 'side' ? VIEW : anim.viewBox;
}
