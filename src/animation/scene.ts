// 視点によらず、1コマ分の計算と描画を行う入口。

import { BODY } from './bodyModel';
import { drawFrame, VIEW, type Ctx, type DrawOptions, type ViewBox } from './draw';
import { drawBackFigure, drawFrontFrame } from './drawFront';
import { computeFrontFrame, solveFront, type FrontFrame } from './frontRig';
import { fullFrontPose } from './interpolate';
import { computeFrame, type Frame, type Vec } from './sideRig';
import type { AnimationData, SideAnimation, SupportStage } from './types';

export type AnyFrame = Frame | FrontFrame;

// 時刻 t の1コマ分（姿勢、体の各点、重心、支えの範囲）を求める
export function frameOf(anim: AnimationData, t: number, stage: SupportStage | null = null): AnyFrame {
  return anim.view === 'side' ? computeFrame(anim, t, stage) : computeFrontFrame(anim, t, stage);
}

// 向きを変える途中の後ろ姿：足をそろえてまっすぐ立ち、両手を体の前（向こう側）のつかまる所に置く。
// 手の中心は、カウンターの上の面（0.54）より少し上。手の下のほうは、カウンターに隠れる
export const TURN_POSE = fullFrontPose({
  rKneeOut: -0.05,
  rKneeUp: -0.98,
  rAnkleOut: -0.05,
  rAnkleUp: -0.98,
  rToeOut: 0.1,
  rToeUp: 0,
  rElbowOut: 0.12,
  rElbowUp: -0.9,
  rHandOut: 0.05,
  rHandUp: -0.46,
  // 腕は、見ている側から奥のカウンターへ伸びている（手がいちばん奥、肘はその半分）。奥ほど少し薄く描かれる
  rElbowDepth: -0.5,
  rHandDepth: -1,
});
// まっすぐ立ったときの、股関節の高さ
const STAND_HIP = BODY.ankleHeight + (BODY.thigh + BODY.shank) * 0.98;

// 横から見る種目で、向きを変える途中に見せる後ろ姿を描く。hip：横向きの人物の股関節の位置
function drawTurnFigure(ctx: Ctx, anim: SideAnimation, hip: Vec, px: number): void {
  const sk = solveFront(TURN_POSE, { view: 'back', root: { mode: 'stand', x: hip.x, y: Math.min(hip.y, STAND_HIP) } });
  // 目立たせる部位は、手前・奥の区別を外して、左右とも同じにする
  // 握った手のうち、カウンターの上の面より下は、カウンターに隠れる
  const counter = anim.props.find((p) => p.type === 'counter');
  drawBackFigure(ctx, sk, TURN_POSE, anim.highlight.map((h) => h.replace(/^(near|far):/, '')), px, counter?.height);
}

// 時刻 t の1コマを描く
export function drawScene(ctx: Ctx, anim: AnimationData, t: number, o: DrawOptions): void {
  const stage = o.support ?? null;
  if (anim.view === 'side') drawFrame(ctx, anim, computeFrame(anim, t, stage), { ...o, turnFigure: (c, hip, px) => drawTurnFigure(c, anim, hip, px) });
  else drawFrontFrame(ctx, anim, computeFrontFrame(anim, t, stage), o);
}

// 表示する範囲
export function viewBoxOf(anim: AnimationData): ViewBox {
  return anim.view === 'side' ? VIEW : anim.viewBox;
}
