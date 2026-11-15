// Canvas 2D への描画。太さのある手足で人物を描く。背景は無地。
// 画風（体型、色、線の太さ）はこのファイルの STYLE と SHAPE を変えると調整できる。

import { dir, type Frame, type Skeleton, type Vec } from './sideRig';
import type { AnchorName, ArrowMark, ChairProp, SegmentName, SideAnimation, SideCounterProp, SupportStage } from './types';

// 色。動かしている部位は目立つ色、椅子は落ち着いた色にする
export const STYLE = {
  background: '#f6f2e9',
  floor: '#8a8170',
  floorArea: '#e6dfcf', // 床を面として描くときの色（正面で、足を前後に出す種目）
  floorSpot: '#fffdf8', // 足先で触れる所の印
  outline: 'rgba(40, 30, 20, 0.45)',
  top: '#3f6f8f', // 上半身
  topFar: '#8eaabd',
  bottom: '#34495e', // 下半身
  bottomFar: '#8593a0',
  skin: '#e9c6a0',
  skinFar: '#f0dcc4',
  hair: '#2b2623', // 頭髪。こちら向きは額まで、向こう向きは後頭部から首まで覆い、向きが分かるようにする
  shoe: '#5b4636',
  shoeFar: '#a39486',
  highlight: '#e8743b', // 動かしている部位
  highlightFar: '#f3b190',
  chair: '#b9ad97',
  chairEdge: '#8c7f68',
  counterBody: '#e3dccb', // カウンターの天板より下（体の向こう側にあるので、薄い色）
  band: '#2f7d5b', // バンド（S8）
  scapula: '#f7d9c4', // 肩甲骨（後ろ向きで目立たせる）
  arrow: '#b4380f',
  arrowEdge: '#ffffff',
  balanceOk: '#15803d',
  balanceNg: '#b91c1c',
  com: '#111111',
} as const;

// 体の太さ（半径。身長 = 1）
export const SHAPE = {
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
  mirror?: boolean; // 左右反転（左側で行うとき）
  reverse?: boolean; // 逆向きに再生している（回す向きの矢印を反対にする）
  support?: SupportStage | null; // 支えの段階（つかまる種目で、腕の形を決める）
  // 横から見る種目で、向きを変える途中に見せる後ろ姿を描く関数（scene.ts が渡す）。hip：股関節の位置
  turnFigure?: (ctx: Ctx, hip: Vec, px: number) => void;
}

// 向きを変える途中（facing が -1 と 1 の間）の、横向きの人物の濃さ。
// 向きを変え始めと終わりは横向きのまま（1）。途中で薄くして後ろ姿に入れ替え（0）、反対向きの横向きに戻す。
// 人は、つかまる所（体の向こう側）のほうを向いて向きを変えるので、見えるのは後ろ姿になる
export function sideFigureAlpha(facing: number): number {
  const x = Math.max(0, Math.min(1, (Math.abs(facing) - 0.55) / 0.3));
  return x * x * (3 - 2 * x);
}

export type Ctx = CanvasRenderingContext2D;
export type ViewBox = { minX: number; maxX: number; minY: number; maxY: number };

// 太さの変わる丸い棒（手足）
export function capsule(ctx: Ctx, a: Vec, b: Vec, ra: number, rb: number, fill: string | CanvasGradient, px: number): void {
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

export function circle(ctx: Ctx, c: Vec, r: number, fill: string, px: number): void {
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
}

// 足（靴）。つま先の部分は別に描き、かかとを上げてもつま先は床に付いたままにできる
function foot(ctx: Ctx, ankle: Vec, footAngle: number, toeBend: number, fill: string, px: number): void {
  const u = dir(footAngle);
  const v = { x: -u.y, y: u.x };
  const p = (du: number, dv: number): [number, number] => [ankle.x + u.x * du + v.x * dv, ankle.y + u.y * du + v.y * dv];
  const toeBase = p(0.08, -0.0255);
  const toeDir = dir(footAngle - toeBend);
  capsule(
    ctx,
    { x: toeBase[0], y: toeBase[1] },
    { x: toeBase[0] + toeDir.x * 0.027, y: toeBase[1] + toeDir.y * 0.027 },
    0.0135,
    0.0125,
    fill,
    px,
  );
  ctx.beginPath();
  ctx.moveTo(...p(-0.036, -0.039));
  ctx.lineTo(...p(0.082, -0.039));
  ctx.lineTo(...p(0.088, -0.014));
  ctx.quadraticCurveTo(...p(0.075, 0), ...p(0.055, 0.004));
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

// カウンター（体の向こう側に、歩く向きに沿って置いてある）
function counterAlongside(ctx: Ctx, c: SideCounterProp, px: number): void {
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = SHAPE.outlinePx * px;
    ctx.strokeStyle = STYLE.chairEdge;
    ctx.stroke();
  };
  rect(c.x, 0, c.length, c.height - 0.03, STYLE.counterBody);
  rect(c.x - 0.01, c.height - 0.03, c.length + 0.02, 0.03, STYLE.chair);
}

// 床の目印。歩いた距離（travel）だけ後ろへ流して、その場の足の運びでも進んでいることが分かるようにする
function floorMarks(ctx: Ctx, spacing: number, travel: number): void {
  const offset = ((travel % spacing) + spacing) % spacing;
  ctx.fillStyle = STYLE.floor;
  for (let x = Math.floor(VIEW.minX / spacing) * spacing - offset; x < VIEW.maxX; x += spacing) {
    if (x + 0.014 < VIEW.minX) continue;
    ctx.fillRect(x, -0.034, 0.014, 0.026);
  }
}

function anchorPoint(sk: Skeleton, name: AnchorName): Vec {
  return sk[name];
}

// 印の濃さ。表示する区間の始めと終わりで、ふわっと出て消える。
// 1往復のあいだ出し続ける印（always）は、往復の変わり目でも消さない
export function markAlpha(t: number, from: number, to: number, always = false): number {
  if (always) return 1;
  if (t < from || t > to) return 0;
  return Math.max(0, Math.min(1, Math.min(t - from, to - t) / 0.25));
}

type StraightMark = Pick<ArrowMark, 'from' | 'to' | 'dx' | 'dy' | 'angle' | 'length'>;

export function arrow(ctx: Ctx, a: Vec, m: StraightMark, t: number, px: number, always = false): void {
  const alpha = markAlpha(t, m.from, m.to, always);
  if (alpha <= 0) return;
  const base = { x: a.x + m.dx, y: a.y + m.dy };
  const d = dir(m.angle);
  const n = { x: -d.y, y: d.x };
  const head = 0.045;
  const neck = { x: base.x + d.x * (m.length - head), y: base.y + d.y * (m.length - head) };
  const tip = { x: base.x + d.x * m.length, y: base.y + d.y * m.length };
  const w = 0.011; // 軸の半分の太さ
  const hw = 0.032; // 矢じりの半分の幅
  ctx.save();
  ctx.globalAlpha *= alpha; // 人物ごと薄くしているとき（向きを変える途中）は、印も一緒に薄くなる
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

// 目安の線（体をまっすぐ保つ線など）
export function guideLine(ctx: Ctx, a: Vec, m: StraightMark, t: number, px: number, always = false): void {
  const alpha = markAlpha(t, m.from, m.to, always);
  if (alpha <= 0) return;
  const c = { x: a.x + m.dx, y: a.y + m.dy };
  const d = dir(m.angle);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.setLineDash([10 * px, 7 * px]);
  ctx.lineCap = 'round';
  for (const [width, color] of [
    [6 * px, STYLE.arrowEdge],
    [3 * px, STYLE.arrow],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(c.x - (d.x * m.length) / 2, c.y - (d.y * m.length) / 2);
    ctx.lineTo(c.x + (d.x * m.length) / 2, c.y + (d.y * m.length) / 2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.restore();
}

export function balanceOverlay(ctx: Ctx, f: Pick<Frame, 'com' | 'support' | 'stable'>, px: number): void {
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

// 背景を塗り、「身長 = 1、y が上向き」の座標で描けるようにする。画面の 1 ピクセルに当たる長さを返す
export function beginScene(ctx: Ctx, view: ViewBox, o: DrawOptions): number {
  const scale = Math.min(o.width / (view.maxX - view.minX), o.height / (view.maxY - view.minY));
  const ox = (o.width - scale * (view.maxX - view.minX)) / 2 - view.minX * scale;
  const oy = o.height - (o.height - scale * (view.maxY - view.minY)) / 2 + view.minY * scale;

  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.fillStyle = STYLE.background;
  ctx.fillRect(0, 0, o.width, o.height);
  if (o.mirror) {
    // 左右反転：左側で行うときは、同じキーフレームを鏡に映した形で描く
    ctx.setTransform(-scale * o.dpr, 0, 0, -scale * o.dpr, (ox + (view.minX + view.maxX) * scale) * o.dpr, oy * o.dpr);
  } else {
    ctx.setTransform(scale * o.dpr, 0, 0, -scale * o.dpr, ox * o.dpr, oy * o.dpr);
  }
  ctx.lineJoin = 'round';
  return 1 / scale;
}

export function drawFrame(ctx: Ctx, anim: SideAnimation, f: Frame, o: DrawOptions): void {
  const px = beginScene(ctx, VIEW, o);

  const sk = f.sk;
  const hl = new Set<string>(anim.highlight);
  const color = (seg: SegmentName, base: string, far: boolean): string => {
    if (hl.has(seg) || hl.has(`${far ? 'far' : 'near'}:${seg}`)) return far ? STYLE.highlightFar : STYLE.highlight;
    return base;
  };

  // 床
  ctx.fillStyle = STYLE.floor;
  ctx.fillRect(VIEW.minX, -0.008, VIEW.maxX - VIEW.minX, 0.008);

  // 支持物（常に描く）
  if (anim.floor) floorMarks(ctx, anim.floor.spacing, f.pose.travel);
  for (const prop of anim.props) {
    if (prop.type === 'chair') chair(ctx, prop, px);
    else counterAlongside(ctx, prop, px);
  }

  // 人物の向き（facing）：左向きのときは、股関節の真上の線を軸に、人物だけを左右に裏返して描く。
  // 床の目印と支持物は裏返さない。向きを変える途中は、横向きの人物を薄くして、後ろ姿に入れ替える
  // （後ろ姿を描く関数がないときは、横に縮めて裏返す）
  const sideAlpha = o.turnFigure ? sideFigureAlpha(f.pose.facing) : 1;
  if (sideAlpha < 1 && o.turnFigure) {
    ctx.save();
    ctx.globalAlpha *= 1 - sideAlpha;
    o.turnFigure(ctx, sk.hip, px);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= sideAlpha;
  if (f.pose.facing !== 1) {
    const squash = Math.abs(f.pose.facing) < 0.03 ? (f.pose.facing < 0 ? -0.03 : 0.03) : f.pose.facing;
    const width = o.turnFigure ? (f.pose.facing < 0 ? -1 : 1) : squash;
    ctx.translate(sk.hip.x, 0);
    ctx.scale(width, 1);
    ctx.translate(-sk.hip.x, 0);
  }

  // 奥側の腕と脚
  capsule(ctx, sk.shoulder, sk.farElbow, SHAPE.upperArm[0], SHAPE.upperArm[1], color('upperArm', STYLE.topFar, true), px);
  capsule(ctx, sk.farElbow, sk.farWrist, SHAPE.forearm[0], SHAPE.forearm[1], color('forearm', STYLE.topFar, true), px);
  circle(ctx, sk.farHand, SHAPE.hand, STYLE.skinFar, px);
  foot(ctx, sk.farAnkle, sk.farFootAngle, sk.farToeBend, color('foot', STYLE.shoeFar, true), px);
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
  const headPath = () => {
    ctx.beginPath();
    ctx.ellipse(sk.head.x, sk.head.y, SHAPE.headLong, SHAPE.headShort, ((90 - sk.headAngle) * Math.PI) / 180, 0, Math.PI * 2);
  };
  headPath();
  ctx.fillStyle = color('head', STYLE.skin, false);
  ctx.fill();
  // 頭髪：頭の上から後ろを覆う（額と顔、首は出す）
  const hp = (f: number, u: number): [number, number] => [sk.head.x + forward.x * f + up.x * u, sk.head.y + forward.y * f + up.y * u];
  ctx.save();
  headPath();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(...hp(0.1, 0.1));
  ctx.lineTo(...hp(0.1, 0.036));
  ctx.lineTo(...hp(0.03, 0.03));
  ctx.quadraticCurveTo(...hp(0.0, 0.02), ...hp(-0.006, -0.012));
  // 後ろ髪の裾：うなじの上で、少しギザギザにする（正面・後ろ向きとそろえる。首は見える）
  ctx.lineTo(...hp(-0.01, -0.034));
  ctx.lineTo(...hp(-0.016, -0.052));
  ctx.lineTo(...hp(-0.023, -0.034));
  ctx.lineTo(...hp(-0.03, -0.052));
  ctx.lineTo(...hp(-0.037, -0.034));
  ctx.lineTo(...hp(-0.044, -0.05));
  ctx.lineTo(...hp(-0.052, -0.03));
  ctx.lineTo(...hp(-0.1, -0.03));
  ctx.lineTo(...hp(-0.1, 0.1));
  ctx.closePath();
  ctx.fillStyle = STYLE.hair;
  ctx.fill();
  ctx.restore();
  headPath();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();

  // 手前側の脚と腕
  foot(ctx, sk.ankle, sk.footAngle, sk.toeBend, color('foot', STYLE.shoe, false), px);
  capsule(ctx, sk.knee, sk.ankle, SHAPE.shank[0], SHAPE.shank[1], color('shank', STYLE.bottom, false), px);
  capsule(ctx, sk.hip, sk.knee, SHAPE.thigh[0], SHAPE.thigh[1], color('thigh', STYLE.bottom, false), px);
  capsule(ctx, sk.shoulder, sk.elbow, SHAPE.upperArm[0], SHAPE.upperArm[1], color('upperArm', STYLE.top, false), px);
  capsule(ctx, sk.elbow, sk.wrist, SHAPE.forearm[0], SHAPE.forearm[1], color('forearm', STYLE.top, false), px);
  circle(ctx, sk.hand, SHAPE.hand, STYLE.skin, px);

  // 注意点の印
  for (const m of anim.marks) {
    const always = m.from <= 0 && m.to >= anim.cycleSeconds;
    if (m.type === 'arrow') arrow(ctx, anchorPoint(sk, m.anchor), m, f.t, px, always);
    else guideLine(ctx, anchorPoint(sk, m.anchor), m, f.t, px, always);
  }

  if (o.showJoints) jointsOverlay(ctx, sk, px);
  if (o.showBalance) balanceOverlay(ctx, f, px);
  ctx.restore();
}
