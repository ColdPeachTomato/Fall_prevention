// 横向きの人物モデル。関節角度から体の各点の位置を計算する。
// 人物は右（x の正の方向）を向く。
//
// 起点（root）は2通り：
//   foot：床についた手前側の足首を起点にする（立つ・立ち上がる種目）。足は動かない。
//   seat：座面に乗った股関節を起点にする（座って行う種目）。脚は股関節から下へ計算する。
//
// 角度の決まり（度）：方向は「真上が 0、前方向が 90、真下が 180」で表す。
//   ankle    すねを前に倒す角度（背屈が正）
//   knee     膝を曲げる角度（まっすぐが 0）
//   hip      股関節を曲げる角度（まっすぐ立つと 0、椅子に座ると約 90）
//   spine    腰から上を前に倒す角度
//   neck     首を前に倒す角度
//   shoulder 腕を前に上げる角度（下げた状態が 0）
//   elbow    肘を曲げる角度

import { BODY, MASS } from './bodyModel';
import { sampleAnimation, type Sample } from './interpolate';
import type { ContactTarget, FullPose, Plant, Prop, SideAnimation, SupportStage } from './types';

export interface Vec {
  x: number;
  y: number;
}

export type RigConfig = Pick<SideAnimation, 'root' | 'contacts' | 'plants' | 'support'>;

// 指先を添えるとき、手を置く点より少し上に手を描く（握らず、上から触れるだけ）
export const FINGERTIP_LIFT = 0.022;

const RAD = Math.PI / 180;

export function dir(deg: number): Vec {
  return { x: Math.sin(deg * RAD), y: Math.cos(deg * RAD) };
}

function along(from: Vec, deg: number, length: number): Vec {
  const d = dir(deg);
  return { x: from.x + d.x * length, y: from.y + d.y * length };
}

// 角度を -180 より大きく 180 以下に直す
function wrapAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

function lerp(a: number, b: number, w: number): number {
  return a + (b - a) * w;
}

function lerpVec(a: Vec, b: Vec, w: number): Vec {
  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w) };
}

export interface Skeleton {
  // 手前側
  ankle: Vec;
  heel: Vec; // かかとの床側の点
  ball: Vec; // 母趾球の床側の点
  toe: Vec; // つま先の床側の点
  knee: Vec;
  hip: Vec;
  elbow: Vec;
  wrist: Vec;
  hand: Vec; // 手のひらの中心
  // 体の中心
  lumbar: Vec;
  shoulder: Vec;
  neckBase: Vec;
  head: Vec;
  // 奥側
  farKnee: Vec;
  farAnkle: Vec;
  farHeel: Vec;
  farBall: Vec;
  farToe: Vec;
  farElbow: Vec;
  farWrist: Vec;
  farHand: Vec;
  // 向き（度）
  footAngle: number; // かかと→母趾球の向き。床に平らなら 90
  farFootAngle: number;
  toeBend: number; // つま先の曲がり（かかとを上げても、つま先は床に付いたまま）
  farToeBend: number;
  headAngle: number;
  // 実際に使った腕の角度（手の接触を反映した後）
  arm: { shoulder: number; elbow: number; farShoulder: number; farElbow: number };
  // 足を床に付ける指定で自動的に決まった脚の角度（あれば、キーフレームの値の代わりに使う）
  effective: Partial<FullPose>;
  // 手の接触先（あれば）
  handTarget?: Vec;
  farHandTarget?: Vec;
  // 支持物につかまっている手（支えの段階による）
  holding: { near: boolean; far: boolean };
}

// 足首と足の向きから、足の裏の3点を求める
function footPoints(ankle: Vec, footAngle: number, toeBend: number): { heel: Vec; ball: Vec; toe: Vec } {
  const u = dir(footAngle); // かかと→母趾球
  const v = { x: -u.y, y: u.x }; // 足の甲の方向
  const at = (du: number, dv: number): Vec => ({ x: ankle.x + u.x * du + v.x * dv, y: ankle.y + u.y * du + v.y * dv });
  const ball = at(BODY.ballFront, -BODY.ankleHeight);
  return { heel: at(-BODY.heelBack, -BODY.ankleHeight), ball, toe: along(ball, footAngle - toeBend, BODY.toeFront - BODY.ballFront) };
}

interface Leg {
  knee: Vec;
  ankle: Vec;
  footAngle: number;
  toeBend: number;
  hip: number; // 実際の関節角度
  kneeAngle: number;
  ankleAngle: number;
}

// 股関節から下へ、関節角度どおりに脚を計算する
function legFromHip(hip: Vec, pelvisAngle: number, hipFlex: number, kneeFlex: number, ankleFlex: number): Leg {
  const thighDown = pelvisAngle + 180 - hipFlex;
  const knee = along(hip, thighDown, BODY.thigh);
  const shankDown = thighDown + kneeFlex;
  return {
    knee,
    ankle: along(knee, shankDown, BODY.shank),
    footAngle: shankDown - 90 - ankleFlex,
    toeBend: 0,
    hip: hipFlex,
    kneeAngle: kneeFlex,
    ankleAngle: ankleFlex,
  };
}

// 床に付けた足の、足首の位置と足の向き
function plantedFoot(plant: Plant, pitch: number): { ankle: Vec; footAngle: number; toeBend: number } {
  const pivot: Vec = { x: plant.x, y: 0 };
  if (plant.pivot === 'ball') {
    // かかと上げ：母趾球を支点にして、かかとが上がる。つま先は床に付いたまま
    const p = Math.max(0, pitch);
    const footAngle = 90 + p;
    const u = dir(footAngle);
    const v = { x: -u.y, y: u.x };
    return {
      ankle: { x: pivot.x - u.x * BODY.ballFront + v.x * BODY.ankleHeight, y: pivot.y - u.y * BODY.ballFront + v.y * BODY.ankleHeight },
      footAngle,
      toeBend: p,
    };
  }
  // つま先上げ：かかとを支点にして、つま先が上がる
  const footAngle = 90 + Math.min(0, pitch);
  const u = dir(footAngle);
  const v = { x: -u.y, y: u.x };
  return {
    ankle: { x: pivot.x + u.x * BODY.heelBack + v.x * BODY.ankleHeight, y: pivot.y + u.y * BODY.heelBack + v.y * BODY.ankleHeight },
    footAngle,
    toeBend: 0,
  };
}

// 足を床の決まった位置に付けたまま、足の傾きに合わせて脚の関節を決める
function legPlanted(hip: Vec, pelvisAngle: number, plant: Plant, pitch: number): Leg {
  const { ankle, footAngle, toeBend } = plantedFoot(plant, pitch);
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const l1 = BODY.thigh;
  const l2 = BODY.shank;
  const d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, Math.hypot(dx, dy)));
  const toAnkle = Math.atan2(dx, dy) / RAD;
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) / RAD;
  const interior = Math.acos((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)) / RAD;
  const thighDown = toAnkle - alpha; // 膝は前に出る
  const kneeFlex = 180 - interior;
  const shankDown = thighDown + kneeFlex;
  return {
    knee: along(hip, thighDown, l1),
    ankle,
    footAngle,
    toeBend,
    hip: wrapAngle(pelvisAngle + 180 - thighDown),
    kneeAngle: kneeFlex,
    ankleAngle: wrapAngle(shankDown - 90 - footAngle),
  };
}

// 肩と目標の位置から、腕の2関節の角度を求める（肘は後ろに張る）
export function solveArm(shoulder: Vec, target: Vec, trunkAngle: number): { shoulder: number; elbow: number } {
  const l1 = BODY.upperArm;
  const l2 = BODY.forearm + BODY.palm;
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, Math.hypot(dx, dy)));
  const toTarget = Math.atan2(dx, dy) / RAD;
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) / RAD;
  const interior = Math.acos((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)) / RAD;
  const upper = toTarget + alpha;
  let flex = trunkAngle + 180 - upper;
  while (flex > 180) flex -= 360;
  while (flex <= -180) flex += 360;
  return { shoulder: flex, elbow: 180 - interior };
}

function contactPoint(target: ContactTarget, hip: Vec, knee: Vec): Vec {
  if (target.on === 'world') return { x: target.x, y: target.y };
  const p = lerpVec(hip, knee, target.along);
  const len = Math.hypot(knee.x - hip.x, knee.y - hip.y);
  // 太ももの前面の方向（立っているときは前、座っているときは上）
  const n = { x: -(knee.y - hip.y) / len, y: (knee.x - hip.x) / len };
  return { x: p.x + n.x * target.offset, y: p.y + n.y * target.offset };
}

function armPoints(shoulder: Vec, trunkAngle: number, flex: number, elbowFlex: number) {
  const upper = trunkAngle + 180 - flex;
  const elbow = along(shoulder, upper, BODY.upperArm);
  const fore = upper - elbowFlex;
  return { elbow, wrist: along(elbow, fore, BODY.forearm), hand: along(elbow, fore, BODY.forearm + BODY.palm) };
}

export function solveSide(pose: FullPose, rig: RigConfig, hands = 0, stage: SupportStage | null = null): Skeleton {
  const effective: Partial<FullPose> = {};
  let hip: Vec;
  let pelvisAngle: number;
  let near: Leg;
  let far: Leg;

  if (rig.root.mode === 'seat' || rig.root.mode === 'hip') {
    // 座って行う種目、立って片脚ずつ動かす種目：股関節は動かない
    hip = { x: rig.root.x, y: rig.root.y };
    pelvisAngle = rig.root.pelvis;
    if (rig.plants?.near) {
      near = legPlanted(hip, pelvisAngle, rig.plants.near, pose.footPitch);
      effective.hip = near.hip;
      effective.knee = near.kneeAngle;
      effective.ankle = near.ankleAngle;
    } else {
      near = legFromHip(hip, pelvisAngle, pose.hip, pose.knee, pose.ankle);
    }
  } else {
    // 立つ・立ち上がる種目：手前側の足首から上へ。足は床に付いたまま滑らない。
    // かかと上げ・つま先上げでは、足の傾き（footPitch）で足首の位置が決まる
    const foot = rig.plants?.near
      ? plantedFoot(rig.plants.near, pose.footPitch)
      : { ankle: { x: rig.root.x, y: BODY.ankleHeight }, footAngle: 90, toeBend: 0 };
    const shankUp = pose.ankle + (foot.footAngle - 90); // ankle は足に対するすねの角度（背屈が正）
    const knee = along(foot.ankle, shankUp, BODY.shank);
    const thighUp = shankUp - pose.knee;
    hip = along(knee, thighUp, BODY.thigh);
    pelvisAngle = thighUp + pose.hip;
    near = { knee, ankle: foot.ankle, footAngle: foot.footAngle, toeBend: foot.toeBend, hip: pose.hip, kneeAngle: pose.knee, ankleAngle: pose.ankle };
  }

  if (rig.plants?.far) {
    far = legPlanted(hip, pelvisAngle, rig.plants.far, pose.farFootPitch);
    effective.farHip = far.hip;
    effective.farKnee = far.kneeAngle;
    effective.farAnkle = far.ankleAngle;
  } else {
    far = legFromHip(hip, pelvisAngle, pose.farHip, pose.farKnee, pose.farAnkle);
  }

  // 体の中心
  const lumbar = along(hip, pelvisAngle, BODY.pelvis);
  const trunkAngle = pelvisAngle + pose.spine;
  const shoulder = along(lumbar, trunkAngle, BODY.trunk * BODY.shoulderAlong);
  const neckBase = along(lumbar, trunkAngle, BODY.trunk);
  const headAngle = trunkAngle + pose.neck;
  const head = along(neckBase, headAngle, BODY.headCenter);

  // 腕：キーフレームの角度と、手の接触先に合わせた角度を、接触の強さで混ぜる
  const arm = { shoulder: pose.shoulder, elbow: pose.elbow, farShoulder: pose.farShoulder, farElbow: pose.farElbow };
  let handTarget: Vec | undefined;
  let farHandTarget: Vec | undefined;
  if (rig.contacts?.near) {
    handTarget = contactPoint(rig.contacts.near, hip, near.knee);
    const ik = solveArm(shoulder, handTarget, trunkAngle);
    arm.shoulder = lerp(pose.shoulder, ik.shoulder, hands);
    arm.elbow = lerp(pose.elbow, ik.elbow, hands);
  }
  if (rig.contacts?.far) {
    farHandTarget = contactPoint(rig.contacts.far, hip, far.knee);
    const ik = solveArm(shoulder, farHandTarget, trunkAngle);
    arm.farShoulder = lerp(pose.farShoulder, ik.shoulder, hands);
    arm.farElbow = lerp(pose.farElbow, ik.elbow, hands);
  }
  // 支持物につかまる腕：支えの段階に合わせて、手を支持物に付ける。下半身は変えない
  const holding = { near: false, far: false };
  if (rig.support && stage !== null && stage !== 'none') {
    handTarget = { x: rig.support.x, y: rig.support.y + (stage === 'fingertip' ? FINGERTIP_LIFT : 0) };
    const ik = solveArm(shoulder, handTarget, trunkAngle);
    arm.shoulder = ik.shoulder;
    arm.elbow = ik.elbow;
    holding.near = true;
    if (stage === 'both') {
      farHandTarget = handTarget;
      arm.farShoulder = ik.shoulder;
      arm.farElbow = ik.elbow;
      holding.far = true;
    }
  }
  const nearArm = armPoints(shoulder, trunkAngle, arm.shoulder, arm.elbow);
  const farArm = armPoints(shoulder, trunkAngle, arm.farShoulder, arm.farElbow);

  const nearFoot = footPoints(near.ankle, near.footAngle, near.toeBend);
  const farFoot = footPoints(far.ankle, far.footAngle, far.toeBend);

  const sk: Skeleton = {
    ankle: near.ankle,
    heel: nearFoot.heel,
    ball: nearFoot.ball,
    toe: nearFoot.toe,
    knee: near.knee,
    hip,
    elbow: nearArm.elbow,
    wrist: nearArm.wrist,
    hand: nearArm.hand,
    lumbar,
    shoulder,
    neckBase,
    head,
    farKnee: far.knee,
    farAnkle: far.ankle,
    farHeel: farFoot.heel,
    farBall: farFoot.ball,
    farToe: farFoot.toe,
    farElbow: farArm.elbow,
    farWrist: farArm.wrist,
    farHand: farArm.hand,
    footAngle: near.footAngle,
    farFootAngle: far.footAngle,
    toeBend: near.toeBend,
    farToeBend: far.toeBend,
    headAngle,
    arm,
    effective,
    holding,
  };
  if (handTarget) sk.handTarget = handTarget;
  if (farHandTarget) sk.farHandTarget = farHandTarget;
  return sk;
}

// 体の各節の質量比から、全身の重心を計算する（質量比と出典は bodyModel.ts）
export function centerOfMass(sk: Skeleton): Vec {
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
  seg(sk.lumbar, sk.hip, MASS.pelvis);
  seg(sk.shoulder, sk.elbow, MASS.upperArm);
  seg(sk.shoulder, sk.farElbow, MASS.upperArm);
  seg(sk.elbow, sk.wrist, MASS.forearmHand);
  seg(sk.farElbow, sk.farWrist, MASS.forearmHand);
  seg(sk.hip, sk.knee, MASS.thigh);
  seg(sk.hip, sk.farKnee, MASS.thigh);
  seg(sk.knee, sk.ankle, MASS.shank);
  seg(sk.farKnee, sk.farAnkle, MASS.shank);
  // 足の重心は、足首と母趾球の中間
  seg(sk.ankle, sk.ball, MASS.foot);
  seg(sk.farAnkle, sk.farBall, MASS.foot);
  return { x: mx / total, y: my / total };
}

const FLOOR_TOLERANCE = 0.006; // 足が床についているとみなす高さの誤差
const HEEL_ROUND = 0.012; // かかとだけ、母趾球だけで立つときの、接地の幅（半分）
const BUTTOCK_BACK = 0.08; // 股関節から、お尻の後ろの接点まで
const THIGH_REST = 0.5; // 太もものうち、座面に乗る部分（股関節から膝への割合の上限）

export interface SupportRange {
  min: number;
  max: number;
}

// 足の裏のうち、床についている部分の範囲（ついていなければ null）
export function footContact(heel: Vec, ball: Vec, toe: Vec): SupportRange | null {
  const xs = [heel, ball, toe].filter((p) => Math.abs(p.y) < FLOOR_TOLERANCE).map((p) => p.x);
  if (xs.length === 0) return null;
  if (xs.length === 1) return { min: xs[0]! - HEEL_ROUND, max: xs[0]! + HEEL_ROUND };
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

// 体を支えている範囲（前後方向）。床についた足と、座っている間の座面、手でつかまっている支持物を合わせた範囲。
// 指先を添えるだけのときは、支持物を支えに数えない。どこも支えていなければ null
export function supportRange(sk: Skeleton, onSeat: boolean, props: Prop[], stage: SupportStage | null = null): SupportRange | null {
  const parts: SupportRange[] = [];
  const nearFoot = footContact(sk.heel, sk.ball, sk.toe);
  const farFoot = footContact(sk.farHeel, sk.farBall, sk.farToe);
  if (nearFoot) parts.push(nearFoot);
  if (farFoot) parts.push(farFoot);
  if (onSeat) {
    for (const prop of props) {
      if (prop.type !== 'chair') continue;
      const back = Math.max(prop.x, sk.hip.x - BUTTOCK_BACK);
      const restKnee = sk.knee.y <= sk.farKnee.y ? sk.knee : sk.farKnee; // 座面に乗っている側の太もも
      const front = Math.min(prop.x + prop.seatDepth, lerp(sk.hip.x, restKnee.x, THIGH_REST));
      if (front > back) parts.push({ min: back, max: front });
    }
  }
  if (sk.holding.near && sk.handTarget && (stage === 'both' || stage === 'one')) {
    parts.push({ min: sk.handTarget.x, max: sk.handTarget.x });
  }
  if (parts.length === 0) return null;
  return { min: Math.min(...parts.map((p) => p.min)), max: Math.max(...parts.map((p) => p.max)) };
}

export interface Frame extends Sample {
  t: number;
  sk: Skeleton;
  com: Vec;
  support: SupportRange;
  stable: boolean; // 重心の真下の点が、支えている範囲の中にあるか
}

// 時刻 t の1コマ分（姿勢、体の各点、重心、支えの範囲）を求める
export function computeFrame(anim: SideAnimation, t: number, stage: SupportStage | null = null): Frame {
  const sample = sampleAnimation(anim, t);
  const sk = solveSide(sample.pose, anim, sample.hands, stage);
  const com = centerOfMass(sk);
  const range = supportRange(sk, sample.onSeat, anim.props, stage);
  const support = range ?? { min: com.x, max: com.x };
  return {
    ...sample,
    // 足を床に付ける指定で決まった角度は、その値を実際の姿勢として扱う
    pose: { ...sample.pose, ...sk.effective },
    t,
    sk,
    com,
    support,
    stable: range !== null && com.x >= range.min && com.x <= range.max,
  };
}
