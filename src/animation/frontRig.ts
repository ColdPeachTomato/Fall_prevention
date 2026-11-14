// 正面・後ろ向きの人物モデル。2D のまま、手足の「見かけの向きと長さ」から体の各点の位置を計算する。
//
// 座標：x は画面の右方向が正、y は床からの高さ。
// 体の左右は、人物から見た右（r）と左（l）。
// 後ろ向きでは、人物の右が画面の右に来る。
// 正面は、鏡に映したように描く（MIRROR_FRONT）。「右」と言うとき、画面でも右側が動くので、
// 見ている人は鏡を見るように同じ側を動かせばよい。
//
// 手足の各節は、付け根から先への向きを (Out, Up) の2つの数で表す（節の長さを 1 とした割合）。
//   Out：体の外側へ、Up：上へ。2つを合わせた長さが 1 より短い分は、手前か奥に向いて短く見えている。
//
// 起点（root）は、左右の股関節の中央。seat：座って行う種目。stand：立って行う種目（shift で骨盤を横に動かせる）。

import { BODY, BODY_FRONT, MASS } from './bodyModel';
import { sampleFrontAnimation, type FrontSample } from './interpolate';
import { FINGERTIP_LIFT, type SupportRange, type Vec } from './sideRig';
import type { BodySide, FrontAnchorName, FrontAnimation, FrontChannel, FrontFullPose, FrontLimbPoint, FrontProp, SupportStage } from './types';

const RAD = Math.PI / 180;

export type FrontRigConfig = Pick<FrontAnimation, 'view' | 'root' | 'plants' | 'support'>;

export interface FrontLimb {
  shoulder: Vec;
  elbow: Vec;
  wrist: Vec;
  hand: Vec; // 手のひらの中心
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  heel: Vec; // かかとの床側の点
  toe: Vec; // つま先の床側の点
  sign: number; // 体の外側の向き（画面の右が +1）
  planted: boolean; // かかとを床に付ける指定があるか
  holding: boolean; // 支持物につかまっているか（支えの段階による）
  handTarget?: Vec; // つかまる点
}

export interface FrontSkeleton {
  view: 'front' | 'back';
  pelvis: Vec; // 左右の股関節の中央
  lumbar: Vec;
  chest: Vec; // 左右の肩の中央
  neckBase: Vec;
  head: Vec;
  up: Vec; // 体幹の上方向
  across: Vec; // 体幹の横方向（画面の右向き）
  r: FrontLimb;
  l: FrontLimb;
  turn: number; // 胸を回す角度（正：人物の右へ）
  scapula: number;
}

// 正面の見本を、鏡に映したように描くか。false にすると、向かい合った人のように描く（人物の右が画面の左）
export const MIRROR_FRONT = true;

// 体の外側の向き（画面の右が +1）
export function sideSign(view: 'front' | 'back', side: BodySide): number {
  const right = view === 'front' && !MIRROR_FRONT ? -1 : 1;
  return side === 'r' ? right : -right;
}

// (Out, Up) の向き。長さが 1 を超えないようにする
function limbVector(out: number, up: number): Vec {
  const n = Math.hypot(out, up);
  return n > 1 ? { x: out / n, y: up / n } : { x: out, y: up };
}

function lerpVec(a: Vec, b: Vec, w: number): Vec {
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
}

function solveLimb(side: BodySide, pose: FrontFullPose, rig: FrontRigConfig, shoulder: Vec, hip: Vec): FrontLimb {
  const sign = sideSign(rig.view, side);
  const get = (key: string) => pose[`${side}${key}` as FrontChannel];
  const step = (from: Vec, key: string, length: number): Vec => {
    const v = limbVector(get(`${key}Out`), get(`${key}Up`));
    return { x: from.x + sign * v.x * length, y: from.y + v.y * length };
  };

  // 腕
  const elbow = step(shoulder, 'Elbow', BODY.upperArm);
  const reach = BODY.forearm + BODY.palm;
  const hand = step(elbow, 'Hand', reach);
  const wrist = lerpVec(elbow, hand, BODY.forearm / reach);

  // 脚
  const knee = step(hip, 'Knee', BODY.thigh);
  const toeVec = limbVector(get('ToeOut'), get('ToeUp'));
  const plant = rig.plants?.[side];
  let ankle: Vec;
  let heel: Vec;
  if (plant) {
    // かかとを床に付けたまま、つま先を上げ下げする。足首の位置は、つま先の上げ具合で決まる
    heel = { x: plant.x, y: 0 };
    const sin = Math.max(0, Math.min(1, toeVec.y));
    const cos = Math.sqrt(1 - sin * sin);
    ankle = { x: heel.x + sign * toeVec.x * BODY.heelBack, y: BODY.ankleHeight * cos + BODY.heelBack * sin };
  } else {
    ankle = step(knee, 'Ankle', BODY.shank);
    heel = { x: ankle.x - sign * toeVec.x * BODY.heelBack, y: ankle.y - BODY.ankleHeight };
  }
  const toe = { x: heel.x + sign * toeVec.x * BODY_FRONT.footLength, y: heel.y + toeVec.y * BODY_FRONT.footLength };

  return { shoulder, elbow, wrist, hand, hip, knee, ankle, heel, toe, sign, planted: plant !== undefined, holding: false };
}

// 手を支持物の点に付ける。
// side：体の横の支持物。肘を曲げて下へ張る（絵の面の中で2関節を合わせる）。
// front：体の前の支持物。腕は手前に伸びるので、短く見える（肩から手へまっすぐ、肘は少し外）
function holdAt(limb: FrontLimb, target: Vec, place: 'side' | 'front'): void {
  const l1 = BODY.upperArm;
  const l2 = BODY.forearm + BODY.palm;
  const dx = target.x - limb.shoulder.x;
  const dy = target.y - limb.shoulder.y;
  const dist = Math.hypot(dx, dy);
  let elbow: Vec;
  if (place === 'front' || dist < Math.abs(l1 - l2) + 1e-6) {
    const w = l1 / (l1 + l2);
    elbow = { x: limb.shoulder.x + dx * w + limb.sign * 0.018, y: limb.shoulder.y + dy * w };
  } else {
    const d = Math.min(l1 + l2 - 1e-6, dist);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / dist;
    const uy = dy / dist;
    // 肘は、肩と手を結ぶ線より体の外・下の側に張る
    const nx = -uy;
    const ny = ux;
    const s = nx * limb.sign - ny * 0.5 >= 0 ? 1 : -1;
    elbow = { x: limb.shoulder.x + ux * a + nx * h * s, y: limb.shoulder.y + uy * a + ny * h * s };
  }
  limb.elbow = elbow;
  limb.hand = target;
  limb.wrist = lerpVec(elbow, target, BODY.forearm / l2);
  limb.holding = true;
  limb.handTarget = target;
}

export function solveFront(pose: FrontFullPose, rig: FrontRigConfig, stage: SupportStage | null = null): FrontSkeleton {
  const pelvis: Vec = { x: rig.root.x + pose.shift, y: rig.root.y };
  const up: Vec = { x: Math.sin(pose.lean * RAD), y: Math.cos(pose.lean * RAD) };
  const across: Vec = { x: up.y, y: -up.x };
  const along = (from: Vec, d: Vec, length: number): Vec => ({ x: from.x + d.x * length, y: from.y + d.y * length });

  // 骨盤は傾けない（座面の上で水平）。腰から上が傾く
  const lumbar = along(pelvis, { x: 0, y: 1 }, BODY.pelvis);
  const chest = along(lumbar, up, BODY.trunk * BODY.shoulderAlong);
  const neckBase = along(lumbar, up, BODY.trunk);
  const head = along(neckBase, up, BODY.headCenter);

  // 胸を回すと、肩の幅が狭く見える
  const half = BODY_FRONT.shoulderHalf * Math.cos(pose.turn * RAD);
  // 肩の位置は、肩甲骨の動きで少しずれる（腕回しなど）
  const shoulderOf = (side: BodySide): Vec => {
    const sign = sideSign(rig.view, side);
    const out = sign * (half + pose[`${side}ShoulderOut`]);
    const rise = pose[`${side}ShoulderUp`];
    return { x: chest.x + across.x * out + up.x * rise, y: chest.y + across.y * out + up.y * rise };
  };
  const hipOf = (side: BodySide): Vec => ({ x: pelvis.x + sideSign(rig.view, side) * BODY_FRONT.hipHalf, y: pelvis.y });

  const sk: FrontSkeleton = {
    view: rig.view,
    pelvis,
    lumbar,
    chest,
    neckBase,
    head,
    up,
    across,
    r: solveLimb('r', pose, rig, shoulderOf('r'), hipOf('r')),
    l: solveLimb('l', pose, rig, shoulderOf('l'), hipOf('l')),
    turn: pose.turn,
    scapula: pose.scapula,
  };

  // 支持物につかまる腕：支えの段階に合わせて、手を支持物に付ける。下半身は変えない
  const support = rig.support;
  if (support && stage !== null && stage !== 'none') {
    const lift = stage === 'fingertip' ? FINGERTIP_LIFT : 0;
    const center = support.front.follow ? pelvis.x : support.front.x;
    const frontPoint = (side: BodySide): Vec => ({ x: center + sideSign(rig.view, side) * support.front.half, y: support.front.y + lift });
    if (stage === 'both') {
      holdAt(sk.r, frontPoint('r'), 'front');
      holdAt(sk.l, frontPoint('l'), 'front');
    } else if (support.side) {
      holdAt(sk[support.hand], { x: support.side.x, y: support.side.y + lift }, 'side');
    } else {
      holdAt(sk[support.hand], frontPoint(support.hand), 'front');
    }
  }
  return sk;
}

// 印を付ける体の点
export function frontAnchor(sk: FrontSkeleton, name: FrontAnchorName): Vec {
  if (name.startsWith('r.') || name.startsWith('l.')) {
    return sk[name[0] as BodySide][name.slice(2) as FrontLimbPoint];
  }
  return sk[name as 'pelvis' | 'lumbar' | 'chest' | 'neckBase' | 'head'];
}

// 体の各節の質量比から、全身の重心を計算する（質量比と出典は bodyModel.ts）。
// 短く見えている節も、見えている両端の間に重心があるので、同じ式で計算できる。
export function frontCenterOfMass(sk: FrontSkeleton): Vec {
  let mx = 0;
  let my = 0;
  let total = 0;
  const add = (p: Vec, mass: number) => {
    mx += p.x * mass;
    my += p.y * mass;
    total += mass;
  };
  const seg = (from: Vec, to: Vec, m: { mass: number; com: number }) => add(lerpVec(from, to, m.com), m.mass);

  add(sk.head, MASS.head.mass);
  seg(sk.neckBase, sk.lumbar, MASS.trunk);
  seg(sk.lumbar, sk.pelvis, MASS.pelvis);
  for (const limb of [sk.r, sk.l]) {
    seg(limb.shoulder, limb.elbow, MASS.upperArm);
    seg(limb.elbow, limb.wrist, MASS.forearmHand);
    seg(limb.hip, limb.knee, MASS.thigh);
    seg(limb.knee, limb.ankle, MASS.shank);
    // 足の重心は、足首と母趾球の中間あたり（かかと〜つま先の中ほど）
    add(lerpVec(limb.ankle, lerpVec(limb.heel, limb.toe, 0.5), 0.5), MASS.foot.mass);
  }
  return { x: mx / total, y: my / total };
}

const FLOOR_TOLERANCE = 0.006; // 足が床についているとみなす高さの誤差
const BUTTOCK_SIDE = 0.05; // 股関節の中心から、お尻の外側の接点まで

// 足の裏のうち、床についている部分の左右の範囲（ついていなければ null）
export function frontFootContact(limb: FrontLimb): SupportRange | null {
  const xs = [limb.heel, limb.toe].filter((p) => Math.abs(p.y) < FLOOR_TOLERANCE).map((p) => p.x);
  if (xs.length === 0) return null;
  return { min: Math.min(...xs) - BODY_FRONT.footHalfWidth, max: Math.max(...xs) + BODY_FRONT.footHalfWidth };
}

// 体を支えている範囲（左右方向）。床についた足と、座っている間の座面、手でつかまっている支持物を合わせた範囲。
// 指先を添えるだけのときは、支持物を支えに数えない
export function frontSupportRange(sk: FrontSkeleton, onSeat: boolean, props: FrontProp[], stage: SupportStage | null = null): SupportRange | null {
  const parts: SupportRange[] = [];
  for (const limb of [sk.r, sk.l]) {
    const foot = frontFootContact(limb);
    if (foot) parts.push(foot);
  }
  if (onSeat) {
    for (const prop of props) {
      if (prop.type !== 'chair') continue;
      const min = Math.max(prop.x - prop.width / 2, sk.pelvis.x - BODY_FRONT.hipHalf - BUTTOCK_SIDE);
      const max = Math.min(prop.x + prop.width / 2, sk.pelvis.x + BODY_FRONT.hipHalf + BUTTOCK_SIDE);
      if (max > min) parts.push({ min, max });
    }
  }
  if (stage === 'both' || stage === 'one') {
    for (const limb of [sk.r, sk.l]) {
      if (limb.holding && limb.handTarget) parts.push({ min: limb.handTarget.x, max: limb.handTarget.x });
    }
  }
  if (parts.length === 0) return null;
  return { min: Math.min(...parts.map((p) => p.min)), max: Math.max(...parts.map((p) => p.max)) };
}

export interface FrontFrame extends FrontSample {
  t: number;
  sk: FrontSkeleton;
  com: Vec;
  support: SupportRange;
  stable: boolean; // 重心の真下の点が、支えている範囲の中にあるか
}

// 時刻 t の1コマ分（姿勢、体の各点、重心、支えの範囲）を求める
export function computeFrontFrame(anim: FrontAnimation, t: number, stage: SupportStage | null = null): FrontFrame {
  const sample = sampleFrontAnimation(anim, t);
  const sk = solveFront(sample.pose, anim, stage);
  const com = frontCenterOfMass(sk);
  const range = frontSupportRange(sk, sample.onSeat, anim.props, stage);
  const support = range ?? { min: com.x, max: com.x };
  return { ...sample, t, sk, com, support, stable: range !== null && com.x >= range.min && com.x <= range.max };
}
