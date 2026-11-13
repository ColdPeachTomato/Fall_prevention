// Canvas 2D への描画。太さのある手足で人物を描く。背景は無地。
// 画風（体型、色、線の太さ）はこのファイルの STYLE と SHAPE を変えると調整できる。

import { dir, type Frame, type Skeleton, type Vec } from './sideRig';
import type { AnchorName, AnimationData, ArrowMark, ChairProp, SegmentName } from './types';

// 色。動かしている部位は目立つ色、椅子は落ち着いた色にする
export const STYLE = {
  background: '#f6f2e9',
  floor: '#8a8170',
  outline: 'rgba(40, 30, 20, 0.45)',
  top: '#3f6f8f', // 上半身
  topFar: '#8eaabd',
  bottom: '#34495e', // 下半身
  bottomFar: '#8593a0',
  skin: '#e9c6a0',
  skinFar: '#f0dcc4',
  shoe: '#5b4636',
  shoeFar: '#a39486',
  highlight: '#e8743b', // 動かしている部位
  highlightFar: '#f3b190',
  chair: '#b9ad97',
  chairEdge: '#8c7f68',
  arrow: '#b4380f',
  arrowEdge: '#ffffff',
  balanceOk: '#15803d',
  balanceNg: '#b91c1c',
  com: '#111111',
} as const;

// 体の太さ（半径。身長 = 1）
const SHAPE = {
  thigh: [0.056, 0.043],
  shank: [0.04, 0.028],
  pelvis: [0.068, 0.066],
  trunk: [0.066, 0.054],
  neck: [0.026, 0.026],
  upperArm: [0.033, 0.028],
  forearm: [0.027, 0.021],
  hand: 0.025,
  headLong: 0.07,
  headShort: 0.058,
  nose: 0.012,
  outlinePx: 1.5,
} as const;

// 表示する範囲（身長 = 1）。人物の全身と足元、椅子が入る
export const VIEW = { minX: -0.42, maxX: 0.38, minY: -0.075, maxY: 1.06 };
export const VIEW_ASPECT = (VIEW.maxX - VIEW.minX) / (VIEW.maxY - VIEW.minY);

export interface DrawOptions {
  width: number; // CSS ピクセル
  height: number;
  dpr: number;
  showBalance?: boolean; // 重心と支えの範囲を重ねる（プレビュー用）
  showJoints?: boolean; // 関節の点を重ねる（プレビュー用）
}

type Ctx = CanvasRenderingContext2D;

// 太さの変わる丸い棒（手足）
function capsule(ctx: Ctx, a: Vec, b: Vec, ra: number, rb: number, fill: string, px: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  ctx.beginPath();
  if (len < 1e-6) {
    ctx.arc(a.x, a.y, Math.max(ra, rb), 0, Math.PI * 2);
  } else {
    const theta = Math.atan2(dy, dx);
    const nx = -dy / len;
    const ny = dx / len;
    ctx.moveTo(a.x + nx * ra, a.y + ny * ra);
    ctx.lineTo(b.x + nx * rb, b.y + ny * rb);
    ctx.arc(b.x, b.y, rb, theta + Math.PI / 2, theta - Math.PI / 2, true);
    ctx.lineTo(a.x - nx * ra, a.y - ny * ra);
    ctx.arc(a.x, a.y, ra, theta - Math.PI / 2, theta - (3 * Math.PI) / 2, true);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
}

function circle(ctx: Ctx, c: Vec, r: number, fill: string, px: number): void {
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
}

function foot(ctx: Ctx, ankle: Vec, footAngle: number, fill: string, px: number): void {
  const u = dir(footAngle);
  const v = { x: -u.y, y: u.x };
  const p = (du: number, dv: number): [number, number] => [ankle.x + u.x * du + v.x * dv, ankle.y + u.y * du + v.y * dv];
  ctx.beginPath();
  ctx.moveTo(...p(-0.036, -0.039));
  ctx.lineTo(...p(0.095, -0.039));
  ctx.quadraticCurveTo(...p(0.118, -0.039), ...p(0.112, -0.02));
  ctx.quadraticCurveTo(...p(0.105, -0.004), ...p(0.055, 0.004));
  ctx.lineTo(...p(0.03, 0.022));
  ctx.lineTo(...p(-0.03, 0.022));
  ctx.quadraticCurveTo(...p(-0.05, 0), ...p(-0.046, -0.025));
  ctx.quadraticCurveTo(...p(-0.046, -0.039), ...p(-0.036, -0.039));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
}

function chair(ctx: Ctx, c: ChairProp, px: number): void {
  const front = c.x + c.seatDepth;
  const rect = (x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fillStyle = STYLE.chair;
    ctx.fill();
    ctx.lineWidth = SHAPE.outlinePx * px;
    ctx.strokeStyle = STYLE.chairEdge;
    ctx.stroke();
  };
  rect(c.x - 0.012, 0, 0.024, c.backHeight); // 後ろ脚と背もたれの柱
  rect(front - 0.04, 0, 0.022, c.seatHeight - 0.028); // 前脚
  rect(c.x - 0.02, c.backHeight - 0.09, 0.04, 0.09); // 背もたれの上
  rect(c.x - 0.012, c.seatHeight - 0.028, c.seatDepth + 0.012, 0.028); // 座面
}

function anchorPoint(sk: Skeleton, name: AnchorName): Vec {
  return sk[name];
}

function arrow(ctx: Ctx, sk: Skeleton, m: ArrowMark, t: number, px: number): void {
  if (t < m.from || t > m.to) return;
  const alpha = Math.max(0, Math.min(1, Math.min(t - m.from, m.to - t) / 0.25));
  if (alpha <= 0) return;
  const a = anchorPoint(sk, m.anchor);
  const base = { x: a.x + m.dx, y: a.y + m.dy };
  const d = dir(m.angle);
  const n = { x: -d.y, y: d.x };
  const head = 0.045;
  const neck = { x: base.x + d.x * (m.length - head), y: base.y + d.y * (m.length - head) };
  const tip = { x: base.x + d.x * m.length, y: base.y + d.y * m.length };
  const w = 0.011; // 軸の半分の太さ
  const hw = 0.032; // 矢じりの半分の幅
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(base.x + n.x * w, base.y + n.y * w);
  ctx.lineTo(neck.x + n.x * w, neck.y + n.y * w);
  ctx.lineTo(neck.x + n.x * hw, neck.y + n.y * hw);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(neck.x - n.x * hw, neck.y - n.y * hw);
  ctx.lineTo(neck.x - n.x * w, neck.y - n.y * w);
  ctx.lineTo(base.x - n.x * w, base.y - n.y * w);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3 * px;
  ctx.strokeStyle = STYLE.arrowEdge;
  ctx.stroke();
  ctx.fillStyle = STYLE.arrow;
  ctx.fill();
  ctx.restore();
}

function balanceOverlay(ctx: Ctx, f: Frame, px: number): void {
  const color = f.stable ? STYLE.balanceOk : STYLE.balanceNg;
  // 支えている範囲（床の下に帯で示す）
  ctx.fillStyle = color;
  ctx.fillRect(f.support.min, -0.05, f.support.max - f.support.min, 0.022);
  // 重心から真下への線
  ctx.save();
  ctx.setLineDash([6 * px, 4 * px]);
  ctx.lineWidth = 2 * px;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(f.com.x, f.com.y);
  ctx.lineTo(f.com.x, -0.028);
  ctx.stroke();
  ctx.restore();
  // 重心の真下の点
  ctx.beginPath();
  ctx.moveTo(f.com.x, -0.028);
  ctx.lineTo(f.com.x - 0.018, -0.066);
  ctx.lineTo(f.com.x + 0.018, -0.066);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // 重心
  ctx.beginPath();
  ctx.arc(f.com.x, f.com.y, 0.02, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5 * px;
  ctx.strokeStyle = STYLE.com;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.com.x - 0.02, f.com.y);
  ctx.lineTo(f.com.x + 0.02, f.com.y);
  ctx.moveTo(f.com.x, f.com.y - 0.02);
  ctx.lineTo(f.com.x, f.com.y + 0.02);
  ctx.stroke();
}

function jointsOverlay(ctx: Ctx, sk: Skeleton, px: number): void {
  const points: Vec[] = [sk.ankle, sk.knee, sk.hip, sk.lumbar, sk.shoulder, sk.neckBase, sk.elbow, sk.wrist, sk.farKnee, sk.farAnkle, sk.farElbow];
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5 * px;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const target of [sk.handTarget, sk.farHandTarget]) {
    if (!target) continue;
    ctx.beginPath();
    ctx.moveTo(target.x - 6 * px, target.y - 6 * px);
    ctx.lineTo(target.x + 6 * px, target.y + 6 * px);
    ctx.moveTo(target.x - 6 * px, target.y + 6 * px);
    ctx.lineTo(target.x + 6 * px, target.y - 6 * px);
    ctx.stroke();
  }
}

export function drawFrame(ctx: Ctx, anim: AnimationData, f: Frame, o: DrawOptions): void {
  const scale = Math.min(o.width / (VIEW.maxX - VIEW.minX), o.height / (VIEW.maxY - VIEW.minY));
  const ox = (o.width - scale * (VIEW.maxX - VIEW.minX)) / 2 - VIEW.minX * scale;
  const oy = o.height - (o.height - scale * (VIEW.maxY - VIEW.minY)) / 2 + VIEW.minY * scale;
  const px = 1 / scale; // 画面の 1 ピクセルに当たる長さ

  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.fillStyle = STYLE.background;
  ctx.fillRect(0, 0, o.width, o.height);
  // ここから先は「身長 = 1、y が上向き」の座標で描く
  ctx.setTransform(scale * o.dpr, 0, 0, -scale * o.dpr, ox * o.dpr, oy * o.dpr);
  ctx.lineJoin = 'round';

  const sk = f.sk;
  const hl = new Set<SegmentName>(anim.highlight);
  const color = (seg: SegmentName, base: string, far: boolean): string => {
    if (hl.has(seg)) return far ? STYLE.highlightFar : STYLE.highlight;
    return base;
  };

  // 床
  ctx.fillStyle = STYLE.floor;
  ctx.fillRect(VIEW.minX, -0.008, VIEW.maxX - VIEW.minX, 0.008);

  // 支持物（常に描く）
  for (const prop of anim.props) {
    if (prop.type === 'chair') chair(ctx, prop, px);
  }

  // 奥側の腕と脚
  capsule(ctx, sk.shoulder, sk.farElbow, SHAPE.upperArm[0], SHAPE.upperArm[1], color('upperArm', STYLE.topFar, true), px);
  capsule(ctx, sk.farElbow, sk.farWrist, SHAPE.forearm[0], SHAPE.forearm[1], color('forearm', STYLE.topFar, true), px);
  circle(ctx, sk.farHand, SHAPE.hand, STYLE.skinFar, px);
  foot(ctx, sk.farAnkle, sk.farFootAngle, color('foot', STYLE.shoeFar, true), px);
  capsule(ctx, sk.farKnee, sk.farAnkle, SHAPE.shank[0], SHAPE.shank[1], color('shank', STYLE.bottomFar, true), px);
  capsule(ctx, sk.hip, sk.farKnee, SHAPE.thigh[0], SHAPE.thigh[1], color('thigh', STYLE.bottomFar, true), px);

  // 体の中心
  capsule(ctx, sk.neckBase, sk.head, SHAPE.neck[0], SHAPE.neck[1], STYLE.skin, px);
  const trunkTop = { x: sk.lumbar.x + (sk.neckBase.x - sk.lumbar.x) * 0.93, y: sk.lumbar.y + (sk.neckBase.y - sk.lumbar.y) * 0.93 };
  capsule(ctx, sk.lumbar, trunkTop, SHAPE.trunk[0], SHAPE.trunk[1], color('trunk', STYLE.top, false), px);
  capsule(ctx, sk.hip, sk.lumbar, SHAPE.pelvis[0], SHAPE.pelvis[1], color('pelvis', STYLE.bottom, false), px);

  // 頭（顔の細部は描かない。向きが分かるよう鼻だけ付ける）
  const up = dir(sk.headAngle);
  const forward = dir(sk.headAngle + 90);
  circle(
    ctx,
    { x: sk.head.x + forward.x * SHAPE.headShort - up.x * 0.008, y: sk.head.y + forward.y * SHAPE.headShort - up.y * 0.008 },
    SHAPE.nose,
    STYLE.skin,
    px,
  );
  ctx.beginPath();
  ctx.ellipse(sk.head.x, sk.head.y, SHAPE.headLong, SHAPE.headShort, ((90 - sk.headAngle) * Math.PI) / 180, 0, Math.PI * 2);
  ctx.fillStyle = color('head', STYLE.skin, false);
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();

  // 手前側の脚と腕
  foot(ctx, sk.ankle, sk.footAngle, color('foot', STYLE.shoe, false), px);
  capsule(ctx, sk.knee, sk.ankle, SHAPE.shank[0], SHAPE.shank[1], color('shank', STYLE.bottom, false), px);
  capsule(ctx, sk.hip, sk.knee, SHAPE.thigh[0], SHAPE.thigh[1], color('thigh', STYLE.bottom, false), px);
  capsule(ctx, sk.shoulder, sk.elbow, SHAPE.upperArm[0], SHAPE.upperArm[1], color('upperArm', STYLE.top, false), px);
  capsule(ctx, sk.elbow, sk.wrist, SHAPE.forearm[0], SHAPE.forearm[1], color('forearm', STYLE.top, false), px);
  circle(ctx, sk.hand, SHAPE.hand, STYLE.skin, px);

  // 注意点の印
  for (const m of anim.marks) {
    if (m.type === 'arrow') arrow(ctx, sk, m, f.t, px);
  }

  if (o.showJoints) jointsOverlay(ctx, sk, px);
  if (o.showBalance) balanceOverlay(ctx, f, px);
}
