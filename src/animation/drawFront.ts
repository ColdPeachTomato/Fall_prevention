// 正面・後ろ向きの描画。画風（色・太さ）は draw.ts の STYLE と SHAPE を共通で使う。
// 重なりの順番は視点で変わる：
//   正面　：椅子 → 体幹 → 脚 → 腕（こちらに伸ばした腕が体の手前に来る）
//   後ろ向き：脚 → 腕 → 椅子の座面 → 体幹 → 椅子の背（体が透けて見えるよう、薄く描く）

import { arrow, balanceOverlay, beginScene, capsule, circle, guideLine, markAlpha, SHAPE, STYLE, type Ctx, type DrawOptions } from './draw';
import { frontAnchor, sideSign, type FrontFrame, type FrontLimb, type FrontSkeleton } from './frontRig';
import { dir, type Vec } from './sideRig';
import type { BodySide, CounterProp, FrontAnimation, FrontArcMark, FrontChairProp, SegmentName } from './types';

// 正面から見た体の幅（半分の値。身長 = 1）
const FRONT_SHAPE = {
  pelvisHalf: 0.104,
  waistHalf: 0.092,
  chestHalf: 0.12,
  neckHalf: 0.03,
  headWide: 0.054,
  headTall: 0.07,
  nose: 0.009,
  shoe: 0.03,
  scapulaWide: 0.027,
  scapulaTall: 0.046,
} as const;

// 前後の見せ方（正面・後ろ向きで共通。2026-11-14 利用者の指摘で決めた）：
// 見ている側に近い所は少しだけ濃く、離れている所は元の色のままにする。薄くはしない。
// いちばん手前（depth = 1）で、元の色からこの割合だけ暗くする
export const NEAR_SHADE = 0.2;

// 色を、手前（depth > 0）にあるほど少し濃くする。奥（depth <= 0）は元の色のまま。depth は -1〜1
export function shadeByDepth(hex: string, depth: number): string {
  const d = Math.max(0, Math.min(1, depth));
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${rgb.map((c) => Math.round(c * (1 - NEAR_SHADE * d))).join(', ')})`;
}

// 腕に隠れる手の割合（手の直径に対して）は、種目ごとにキーフレームの HandCover で決める。
// その上限。どの種目でも、手が消えることはない
export const HAND_HIDDEN_LIMIT = 0.8;
// 手に重なる腕のふちの丸み（半径）
const ARM_EDGE = 0.036;

// 手のうち、腕に隠れる部分（円で表す）。隠れるのは肘のある側。hidden：隠れる割合（手の直径に対して）。0 なら隠れない
export function handBite(limb: Pick<FrontLimb, 'hand' | 'elbow' | 'sign'>, hidden: number): { x: number; y: number; r: number } | null {
  if (hidden <= 0) return null;
  // 肘が手のすぐ近くに重なって見えるときは、下・外の側から隠す（向きが急に変わらないよう、少しだけ足しておく）
  const dx = limb.elbow.x - limb.hand.x + limb.sign * 0.008;
  const dy = limb.elbow.y - limb.hand.y - 0.008;
  const n = Math.hypot(dx, dy);
  const reach = SHAPE.hand + ARM_EDGE - Math.min(HAND_HIDDEN_LIMIT, hidden) * 2 * SHAPE.hand;
  return { x: limb.hand.x + (dx / n) * reach, y: limb.hand.y + (dy / n) * reach, r: ARM_EDGE };
}

// 手。腕より手前に描いたうえで、腕が重なる分だけ、手の肘の側を腕の色で覆う（袖口が手に少しかぶさるように見える）。
// 覆う所は手の円の中だけなので、下に腕が描かれていなくても、欠けた所に穴が開かない。sleeve：腕の、手首の側の色
function hand(ctx: Ctx, limb: FrontLimb, hidden: number, sleeve: string, px: number): void {
  circle(ctx, limb.hand, SHAPE.hand, STYLE.skin, px);
  const bite = handBite(limb, hidden);
  if (!bite) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(limb.hand.x, limb.hand.y, SHAPE.hand, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(bite.x, bite.y, bite.r, 0, Math.PI * 2);
  ctx.fillStyle = sleeve;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
  ctx.restore();
  // 手のふちの線を、覆った所も含めて引き直す
  ctx.beginPath();
  ctx.arc(limb.hand.x, limb.hand.y, SHAPE.hand, 0, Math.PI * 2);
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
}

// 立って体重を片足に乗せると、支える脚は内へ傾き、脚の付け根が骨盤の外へ飛び出して見える。
// 内へ傾いた分だけ、付け根を少し内側に寄せて描く（位置の計算は変えず、描き方だけ。2026-11-14 利用者の指摘）。
// kneeOut：股関節→膝の、外への成分。ほぼまっすぐな脚（-0.06 まで）は寄せない
export function thighInset(kneeOut: number): number {
  return Math.max(0, Math.min(0.018, (-kneeOut - 0.06) * 0.16));
}

// 胸を回すと、頭も少し同じ向きを向く（胸の半分の角度）。そのときの、顔の中心の横へのずれ（画面の右が正）。
// 鼻と前髪は顔と同じ側へ、後ろ髪の裾は反対の側へ動く
export function faceShift(view: 'front' | 'back', turn: number): number {
  const toward = sideSign(view, 'r') * Math.sin((turn * 0.5 * Math.PI) / 180) * FRONT_SHAPE.headWide;
  return view === 'front' ? toward : -toward; // 後ろ向きでは、見えているのは後頭部なので反対へ動く
}

function outline(ctx: Ctx, fill: string, px: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, px: number): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = STYLE.chair;
  ctx.fill();
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.chairEdge;
  ctx.stroke();
}

// 椅子の座面と脚
function chairSeat(ctx: Ctx, c: FrontChairProp, px: number): void {
  const left = c.x - c.width / 2;
  rect(ctx, left + 0.008, 0, 0.022, c.seatHeight - 0.028, px);
  rect(ctx, left + c.width - 0.03, 0, 0.022, c.seatHeight - 0.028, px);
  rect(ctx, left, c.seatHeight - 0.028, c.width, 0.028, px);
}

// 椅子の背（2本の柱と、上の横木）
function chairBack(ctx: Ctx, c: FrontChairProp, px: number): void {
  const left = c.x - c.width / 2;
  rect(ctx, left + 0.004, c.seatHeight, 0.024, c.backHeight - c.seatHeight, px);
  rect(ctx, left + c.width - 0.028, c.seatHeight, 0.024, c.backHeight - c.seatHeight, px);
  rect(ctx, left, c.backHeight - 0.09, c.width, 0.09, px);
}

// カウンター（天板と、その下）。体の手前にあるときは、下の部分をごく薄くして脚を見せる
function counter(ctx: Ctx, c: CounterProp, px: number): void {
  const left = c.x - c.width / 2;
  if (c.inFront) {
    ctx.save();
    ctx.globalAlpha *= 0.35;
    rect(ctx, left + 0.01, 0, c.width - 0.02, c.height - 0.03, px);
    ctx.restore();
  } else {
    rect(ctx, left + 0.01, 0, c.width - 0.02, c.height - 0.03, px);
  }
  rect(ctx, left, c.height - 0.03, c.width, 0.03, px);
}

// 体幹の上の点（across：横、along：腰からの高さ）
function trunkPoint(sk: FrontSkeleton, across: number, along: number): [number, number] {
  return [sk.lumbar.x + sk.across.x * across + sk.up.x * along, sk.lumbar.y + sk.across.y * across + sk.up.y * along];
}

function pelvis(ctx: Ctx, sk: FrontSkeleton, fill: string, px: number): void {
  const h = FRONT_SHAPE.pelvisHalf;
  const bottom = sk.pelvis.y - 0.05;
  const top = sk.lumbar.y + 0.012;
  ctx.beginPath();
  ctx.moveTo(sk.pelvis.x - h, top);
  ctx.lineTo(sk.pelvis.x + h, top);
  ctx.lineTo(sk.pelvis.x + h, bottom + 0.03);
  ctx.quadraticCurveTo(sk.pelvis.x + h, bottom, sk.pelvis.x + h - 0.03, bottom);
  ctx.lineTo(sk.pelvis.x - h + 0.03, bottom);
  ctx.quadraticCurveTo(sk.pelvis.x - h, bottom, sk.pelvis.x - h, bottom + 0.03);
  ctx.closePath();
  outline(ctx, fill, px);
}

function trunk(ctx: Ctx, sk: FrontSkeleton, fill: string, px: number): void {
  const shoulderY = Math.hypot(sk.chest.x - sk.lumbar.x, sk.chest.y - sk.lumbar.y);
  const neckY = Math.hypot(sk.neckBase.x - sk.lumbar.x, sk.neckBase.y - sk.lumbar.y);
  const { waistHalf: w, chestHalf: c, neckHalf: n } = FRONT_SHAPE;
  ctx.beginPath();
  ctx.moveTo(...trunkPoint(sk, -w, -0.012));
  ctx.lineTo(...trunkPoint(sk, -c, shoulderY - 0.05));
  ctx.quadraticCurveTo(...trunkPoint(sk, -c - 0.004, shoulderY + 0.036), ...trunkPoint(sk, -0.07, shoulderY + 0.04));
  ctx.lineTo(...trunkPoint(sk, -n, neckY - 0.004));
  ctx.lineTo(...trunkPoint(sk, n, neckY - 0.004));
  ctx.lineTo(...trunkPoint(sk, 0.07, shoulderY + 0.04));
  ctx.quadraticCurveTo(...trunkPoint(sk, c + 0.004, shoulderY + 0.036), ...trunkPoint(sk, c, shoulderY - 0.05));
  ctx.lineTo(...trunkPoint(sk, w, -0.012));
  ctx.closePath();
  outline(ctx, fill, px);
}

// 肩甲骨と背骨の線（後ろ向き）。寄せると、左右の肩甲骨が背骨に近づく
function scapulae(ctx: Ctx, sk: FrontSkeleton, fill: string, px: number): void {
  const shoulderY = Math.hypot(sk.chest.x - sk.lumbar.x, sk.chest.y - sk.lumbar.y);
  ctx.beginPath();
  ctx.moveTo(...trunkPoint(sk, 0, 0.02));
  ctx.lineTo(...trunkPoint(sk, 0, shoulderY + 0.02));
  ctx.lineWidth = SHAPE.outlinePx * px;
  ctx.strokeStyle = STYLE.outline;
  ctx.stroke();
  const offset = 0.066 - 0.026 * sk.scapula;
  for (const s of [-1, 1]) {
    const [x, y] = trunkPoint(sk, s * offset, shoulderY - 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, FRONT_SHAPE.scapulaWide, FRONT_SHAPE.scapulaTall, s * 0.16, 0, Math.PI * 2);
    outline(ctx, fill, px);
  }
}

// 頭と首、頭髪。頭髪で、こちら向きか向こう向きかを見分けられるようにする。
//   正面　：額のあたりまで。耳の下（首の横）に、後ろ髪の裾が少しだけのぞく
//   後ろ向き：後頭部を覆い、裾はうなじの上でギザギザにする（首が見える）
// 髪の裾のギザギザは、横向き（draw.ts）とそろえてある
function head(ctx: Ctx, sk: FrontSkeleton, fill: string, px: number): void {
  const tilt = Math.atan2(sk.up.x, sk.up.y);
  // 頭の中心からの点（a：横、u：上）
  const hp = (a: number, u: number): [number, number] => [sk.head.x + sk.across.x * a + sk.up.x * u, sk.head.y + sk.across.y * a + sk.up.y * u];
  const headPath = () => {
    ctx.beginPath();
    ctx.ellipse(sk.head.x, sk.head.y, FRONT_SHAPE.headWide, FRONT_SHAPE.headTall, tilt, 0, Math.PI * 2);
  };
  const strokeOutline = () => {
    ctx.lineWidth = SHAPE.outlinePx * px;
    ctx.strokeStyle = STYLE.outline;
    ctx.stroke();
  };
  // 頭の回転に合わせた、横へのずれ。前髪と鼻は shift だけ、後ろ髪の裾は反対へ少し動く
  const shift = faceShift(sk.view, sk.turn);
  const nape = sk.view === 'front' ? -shift * 0.7 : shift;

  if (sk.view === 'front') {
    // 後ろ髪の裾：頭と首の後ろにあるので先に描き、耳の下から少しだけのぞかせる
    for (const s of [-1, 1]) {
      ctx.beginPath();
      // 頭が回ると、向いた側の裾は頭の後ろに隠れ、反対の側の裾が多くのぞく
      ctx.moveTo(...hp(s * 0.03 + nape, -0.02));
      ctx.lineTo(...hp(s * 0.053 + nape, -0.02));
      ctx.lineTo(...hp(s * 0.05 + nape, -0.058));
      ctx.lineTo(...hp(s * 0.044 + nape, -0.047));
      ctx.lineTo(...hp(s * 0.038 + nape, -0.062));
      ctx.lineTo(...hp(s * 0.032 + nape, -0.05));
      ctx.lineTo(...hp(s * 0.026 + nape, -0.062));
      ctx.closePath();
      ctx.fillStyle = STYLE.hair;
      ctx.fill();
      ctx.lineJoin = 'miter';
      strokeOutline();
      ctx.lineJoin = 'round';
    }
  }

  capsule(ctx, sk.neckBase, sk.head, SHAPE.neck[0], SHAPE.neck[1], STYLE.skin, px);
  headPath();
  outline(ctx, fill, px);

  // 頭髪（頭の形の中だけに塗る）
  const hairPath = () => {
    ctx.beginPath();
    if (sk.view === 'back') {
      // 後頭部：上から、うなじの上のギザギザの裾まで
      const teeth = 6;
      const side = 0.06;
      ctx.moveTo(...hp(-0.08, 0.1));
      ctx.lineTo(...hp(0.08, 0.1));
      ctx.lineTo(...hp(0.08, -0.03));
      for (let k = 0; k <= teeth * 2; k++) {
        const across = side - (side * 2 * k) / (teeth * 2) + nape;
        ctx.lineTo(...hp(across, k % 2 === 1 ? -0.052 : -0.034)); // 奇数番目が毛先
      }
      ctx.lineTo(...hp(-0.08, -0.03));
    } else {
      ctx.moveTo(...hp(-0.08, 0.1));
      ctx.lineTo(...hp(0.08, 0.1));
      // 前髪の生え際は、顔と同じ側へ動く
      ctx.lineTo(...hp(0.08 + shift, 0.004));
      ctx.quadraticCurveTo(...hp(shift, 0.058), ...hp(-0.08 + shift, 0.004));
    }
    ctx.closePath();
  };
  ctx.save();
  headPath();
  ctx.clip();
  hairPath();
  ctx.fillStyle = STYLE.hair;
  ctx.fill();
  if (sk.view === 'back') {
    // 裾のギザギザに線を入れて、形をはっきりさせる
    ctx.lineJoin = 'miter';
    strokeOutline();
  }
  ctx.restore();
  ctx.lineJoin = 'round';
  headPath();
  strokeOutline();

  if (sk.view === 'front') {
    // 顔の細部は描かない。向きが分かるよう鼻だけ付ける（胸を回すと、顔も少し同じ向きを向く）
    circle(ctx, { x: sk.head.x + shift - sk.up.x * 0.01, y: sk.head.y - sk.up.y * 0.01 }, FRONT_SHAPE.nose, STYLE.skin, px);
  }
}

// 足。depth：脚の前後（手前が正）。手前の足は少し大きく・下に、奥の足は小さく・上に描く（床の奥行きの見え方）。
// 正面では、つま先の部分を別に描いて区切りの線を入れる（横向きの足と同じ考え方）。
// つま先はかかとより手前にあるので、少し濃くする。つま先を回す動きが見やすくなる（2026-11-14 利用者の指摘）。
// 後ろ向きでは、つま先はかかとの向こう側なので、区切りは描かない
function foot(ctx: Ctx, limb: FrontLimb, base: string, px: number, depth: number, view: 'front' | 'back'): void {
  const r = FRONT_SHAPE.shoe * (1 + 0.18 * depth);
  const dy = DEPTH_DROP * depth;
  const heel = { x: limb.heel.x, y: limb.heel.y + r - dy };
  const toe = { x: limb.toe.x, y: limb.toe.y + r * 0.9 - dy };
  capsule(ctx, heel, toe, r, r * 0.9, shadeByDepth(base, depth * 0.8), px);
  if (view === 'front') circle(ctx, toe, r * 0.9, shadeByDepth(base, depth * 0.8 + TOE_NEAR), px);
}

// つま先が、かかとよりどれだけ手前にあるか（濃さに使う値）
const TOE_NEAR = 0.6;

// 手前・奥にある足を、絵の上で上下にずらす量（身長 = 1。depth が 1 のとき）。少し上から見た図にするため
export const DEPTH_DROP = 0.036;
// 床を面として描くときの、奥の端（壁との境）の高さ
const FLOOR_BACK = 0.085;

// 床を面として描く（少し上から見た図）。手前の床は下、奥の床は上。足先で触れる所には、床に置いた丸い印を描く。
// 床を1本の線で描くと、前へ出した足は床にめり込み、後ろへ出した足は浮いて見えるため（2026-11-14 利用者の指摘）
function floorArea(ctx: Ctx, anim: FrontAnimation, spots: { x: number; depth: number }[], px: number): void {
  const { minX, maxX, minY } = anim.viewBox;
  ctx.fillStyle = STYLE.floorArea;
  ctx.fillRect(minX, minY, maxX - minX, FLOOR_BACK - minY);
  ctx.fillStyle = STYLE.floor;
  ctx.fillRect(minX, FLOOR_BACK, maxX - minX, 0.005);
  for (const s of spots) {
    const scale = 1 + 0.18 * s.depth;
    ctx.beginPath();
    ctx.ellipse(s.x, -DEPTH_DROP * s.depth, 0.042 * scale, 0.013 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = STYLE.floorSpot;
    ctx.fill();
    ctx.lineWidth = SHAPE.outlinePx * px;
    ctx.strokeStyle = STYLE.floor;
    ctx.stroke();
  }
}

// 回す向きを示す弧の矢印
function arcArrow(ctx: Ctx, a: Vec, m: FrontArcMark, t: number, reverse: boolean, px: number, always: boolean): void {
  const alpha = markAlpha(t, m.from, m.to, always);
  if (alpha <= 0) return;
  const c = { x: a.x + m.dx, y: a.y + m.dy };
  const start = reverse ? m.start + m.sweep : m.start;
  const sweep = reverse ? -m.sweep : m.sweep;
  const head = 0.04;
  const headAngle = (head / m.radius) * (180 / Math.PI) * Math.sign(sweep);
  const steps = 24;
  const at = (deg: number): Vec => ({ x: c.x + dir(deg).x * m.radius, y: c.y + dir(deg).y * m.radius });
  const end = start + sweep;
  const neck = at(end - headAngle);
  const tip = at(end);
  const out = dir(end - headAngle); // 弧の外向き
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [
    [0.022 + 3 * px, STYLE.arrowEdge],
    [0.022, STYLE.arrow],
  ] as const) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const p = at(start + ((sweep - headAngle) * i) / steps);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  const hw = 0.03;
  ctx.beginPath();
  ctx.moveTo(neck.x + out.x * hw, neck.y + out.y * hw);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(neck.x - out.x * hw, neck.y - out.y * hw);
  ctx.closePath();
  ctx.lineWidth = 3 * px;
  ctx.strokeStyle = STYLE.arrowEdge;
  ctx.stroke();
  ctx.fillStyle = STYLE.arrow;
  ctx.fill();
  ctx.restore();
}

function jointsOverlay(ctx: Ctx, sk: FrontSkeleton, px: number): void {
  const points: Vec[] = [sk.pelvis, sk.lumbar, sk.chest, sk.neckBase];
  for (const limb of [sk.r, sk.l]) points.push(limb.shoulder, limb.elbow, limb.wrist, limb.hip, limb.knee, limb.ankle, limb.heel, limb.toe);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5 * px;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawFrontFrame(ctx: Ctx, anim: FrontAnimation, f: FrontFrame, o: DrawOptions): void {
  const px = beginScene(ctx, anim.viewBox, o);
  const sk = f.sk;
  const back = anim.view === 'back';
  const hl = new Set<string>(anim.highlight);
  const color = (seg: SegmentName, base: string, side?: BodySide): string => (hl.has(seg) || (side !== undefined && hl.has(`${side}:${seg}`)) ? STYLE.highlight : base);

  // 床：ふつうは1本の線。足を前や後ろへ出す種目では、面として描く
  if (anim.floorSpots) {
    floorArea(ctx, anim, anim.floorSpots, px);
  } else {
    ctx.fillStyle = STYLE.floor;
    ctx.fillRect(anim.viewBox.minX, -0.008, anim.viewBox.maxX - anim.viewBox.minX, 0.008);
  }

  // 支持物は、支えの段階に合うものだけを描く（つかまらない種目は none として扱う）
  const stage = o.support ?? 'none';
  const shown = anim.props.filter((p) => p.type === 'band' || p.showFor === undefined || p.showFor.includes(stage));
  const chairs = shown.filter((p): p is FrontChairProp => p.type === 'chair' && !p.inFront);
  const counters = shown.filter((p): p is CounterProp => p.type === 'counter' && !p.inFront);
  const standing = anim.root.mode === 'stand';
  // 体の手前にある支持物：体が見えるよう薄く描く
  const propsInFront = () => {
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (const p of shown) {
      if (p.type === 'chair' && p.inFront) {
        chairSeat(ctx, p, px);
        chairBack(ctx, p, px);
      } else if (p.type === 'counter' && p.inFront) {
        counter(ctx, p, px);
      }
    }
    ctx.restore();
  };
  const hasBand = anim.props.some((p) => p.type === 'band');

  const legs = () => {
    for (const side of ['r', 'l'] as const) {
      const limb = sk[side];
      // 脚の前後（KneeDepth）：足先を前に出すと手前（少し濃く・大きく・下）、後ろに出すと奥（元の色・小さく・上）
      const depth = f.pose[`${side}KneeDepth`];
      const tint = (base: string, d: number) => (d <= 0 ? base : shadeByDepth(base, d));
      const ankle = { x: limb.ankle.x, y: limb.ankle.y - DEPTH_DROP * depth };
      const knee = { x: limb.knee.x, y: limb.knee.y - DEPTH_DROP * depth * 0.5 };
      // 立位で内へ傾いた脚は、付け根を少し内側に寄せて描く
      const inset = standing ? thighInset(f.pose[`${side}KneeOut`]) : 0;
      const hip = { x: limb.hip.x - limb.sign * inset, y: limb.hip.y };
      capsule(ctx, knee, ankle, SHAPE.shank[0], SHAPE.shank[1] * (1 + 0.18 * depth), tint(color('shank', STYLE.bottom, side), depth * 0.8), px);
      foot(ctx, limb, color('foot', STYLE.shoe, side), px, depth, anim.view);
      capsule(ctx, hip, knee, SHAPE.thigh[0], SHAPE.thigh[1], tint(color('thigh', STYLE.bottom, side), depth * 0.4), px);
    }
  };
  const band = () => {
    if (!hasBand) return;
    for (const [width, stroke] of [
      [0.016 + 2 * SHAPE.outlinePx * px, STYLE.outline],
      [0.016, STYLE.band],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(sk.r.hand.x, sk.r.hand.y);
      ctx.lineTo(sk.l.hand.x, sk.l.hand.y);
      ctx.lineCap = 'round';
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };
  const arms = () => {
    // 胸を回したとき、前に出ている側の肩の腕を後に描く（手前に来る）
    const order: BodySide[] = sk.turn > 0 ? ['r', 'l'] : ['l', 'r'];
    // 肘と手の前後（ElbowDepth・HandDepth）で、腕の濃さを変える：手前にある所ほど少し濃くする（肩は元の色。奥は元の色のまま）。
    // 腕が手に重なる割合は HandCover で決める
    const shaded = (from: Vec, to: Vec, base: string, depthFrom: number, depthTo: number): string | CanvasGradient => {
      if (depthFrom <= 0 && depthTo <= 0) return base;
      if (Math.hypot(to.x - from.x, to.y - from.y) < 0.004) return shadeByDepth(base, depthTo);
      const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      g.addColorStop(0, shadeByDepth(base, depthFrom));
      g.addColorStop(1, shadeByDepth(base, depthTo));
      return g;
    };
    for (const side of order) {
      const limb = sk[side];
      const elbowDepth = f.pose[`${side}ElbowDepth`];
      const handDepth = f.pose[`${side}HandDepth`];
      const upper = color('upperArm', STYLE.top, side);
      const fore = color('forearm', STYLE.top, side);
      capsule(ctx, limb.shoulder, limb.elbow, SHAPE.upperArm[0], SHAPE.upperArm[1], shaded(limb.shoulder, limb.elbow, upper, 0, elbowDepth), px);
      capsule(ctx, limb.elbow, limb.wrist, SHAPE.forearm[0], SHAPE.forearm[1], shaded(limb.elbow, limb.wrist, fore, elbowDepth, handDepth), px);
      // 手は消さない。腕が重なる分だけ、肘の側が欠けて見える
      hand(ctx, limb, f.pose[`${side}HandCover`], shadeByDepth(fore, handDepth), px);
    }
  };
  const body = () => {
    pelvis(ctx, sk, color('pelvis', STYLE.bottom), px);
    trunk(ctx, sk, color('trunk', STYLE.top), px);
    if (back) scapulae(ctx, sk, hl.has('scapula') ? STYLE.highlight : STYLE.scapula, px);
    head(ctx, sk, color('head', STYLE.skin), px);
  };

  for (const c of counters) counter(ctx, c, px);
  if (back && !standing) {
    // 後ろ向き・座位：脚と、前に出した腕は体の向こう側
    legs();
    band();
    arms();
    for (const c of chairs) chairSeat(ctx, c, px);
    body();
    ctx.save();
    ctx.globalAlpha = 0.4; // 椅子の背は常に描くが、背中の動きが見えるよう薄くする
    for (const c of chairs) chairBack(ctx, c, px);
    ctx.restore();
  } else if (back) {
    // 後ろ向き・立位：横に置いた椅子、脚、前に出した腕、体の順
    for (const c of chairs) {
      chairSeat(ctx, c, px);
      chairBack(ctx, c, px);
    }
    legs();
    band();
    arms();
    body();
  } else {
    for (const c of chairs) {
      chairBack(ctx, c, px);
      chairSeat(ctx, c, px);
    }
    if (standing) {
      // 立位：脚の付け根は骨盤の下に隠れる
      legs();
      body();
    } else {
      // 座位：太ももは手前に伸びて、骨盤の前に来る
      body();
      legs();
    }
    band();
    arms();
  }
  propsInFront();

  // 注意点の印
  for (const m of anim.marks) {
    const a = frontAnchor(sk, m.anchor);
    const always = m.from <= 0 && m.to >= anim.cycleSeconds;
    if (m.type === 'arrow') arrow(ctx, a, m, f.t, px, always);
    else if (m.type === 'line') guideLine(ctx, a, m, f.t, px, always);
    else arcArrow(ctx, a, m, f.t, o.reverse === true, px, always);
  }

  if (o.showJoints) jointsOverlay(ctx, sk, px);
  if (o.showBalance) balanceOverlay(ctx, f, px);
}
