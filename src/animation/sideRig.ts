// 横向きの人物モデル。関節角度から体の各点の位置を計算する。
// 人物は右（x の正の方向）を向く。床についた手前側の足首を起点にし、そこは動かさない。
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
import type { AnimationData, ContactTarget, FullPose, Prop } from './types';

export interface Vec {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;

export function dir(deg: number): Vec {
  return { x: Math.sin(deg * RAD), y: Math.cos(deg * RAD) };
}

function along(from: Vec, deg: number, length: number): Vec {
  const d = dir(deg);
  return { x: from.x + d.x * length, y: from.y + d.y * length };
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
  heel: Vec;
  toe: Vec;
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
  farToe: Vec;
  farElbow: Vec;
  farWrist: Vec;
  farHand: Vec;
  // 向き（度）
  footAngle: number; // かかと→つま先の向き。床に平らなら 90
  farFootAngle: number;
  headAngle: number;
  // 実際に使った腕の角度（手の接触を反映した後）
  arm: { shoulder: number; elbow: number; farShoulder: number; farElbow: number };
  // 手の接触先（あれば）
  handTarget?: Vec;
  farHandTarget?: Vec;
}

// 足首から見た、かかと・つま先の床の点
function footPoints(ankle: Vec, footAngle: number): { heel: Vec; toe: Vec } {
  const u = dir(footAngle); // かかと→つま先
  const v = { x: -u.y, y: u.x }; // 足の甲の方向
  const at = (du: number, dv: number): Vec => ({ x: ankle.x + u.x * du + v.x * dv, y: ankle.y + u.y * du + v.y * dv });
  return { heel: at(-BODY.heelBack, -BODY.ankleHeight), toe: at(BODY.toeFront, -BODY.ankleHeight) };
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

export function solveSide(
  pose: FullPose,
  rootX: number,
  contacts: AnimationData['contacts'] = undefined,
  hands = 0,
): Skeleton {
  // 手前側の脚：足首から上へ
  const ankle: Vec = { x: rootX, y: BODY.ankleHeight };
  const knee = along(ankle, pose.ankle, BODY.shank);
  const thighUp = pose.ankle - pose.knee;
  const hip = along(knee, thighUp, BODY.thigh);

  // 体の中心
  const pelvisAngle = thighUp + pose.hip;
  const lumbar = along(hip, pelvisAngle, BODY.pelvis);
  const trunkAngle = pelvisAngle + pose.spine;
  const shoulder = along(lumbar, trunkAngle, BODY.trunk * BODY.shoulderAlong);
  const neckBase = along(lumbar, trunkAngle, BODY.trunk);
  const headAngle = trunkAngle + pose.neck;
  const head = along(neckBase, headAngle, BODY.headCenter);

  // 奥側の脚：股関節から下へ
  const farThighDown = pelvisAngle + 180 - pose.farHip;
  const farKnee = along(hip, farThighDown, BODY.thigh);
  const farShankDown = farThighDown + pose.farKnee;
  const farAnkle = along(farKnee, farShankDown, BODY.shank);
  const farFootAngle = farShankDown - 90 - pose.farAnkle;

  // 腕：キーフレームの角度と、手の接触先に合わせた角度を、接触の強さで混ぜる
  const arm = { shoulder: pose.shoulder, elbow: pose.elbow, farShoulder: pose.farShoulder, farElbow: pose.farElbow };
  let handTarget: Vec | undefined;
  let farHandTarget: Vec | undefined;
  if (contacts?.near) {
    handTarget = contactPoint(contacts.near, hip, knee);
    const ik = solveArm(shoulder, handTarget, trunkAngle);
    arm.shoulder = lerp(pose.shoulder, ik.shoulder, hands);
    arm.elbow = lerp(pose.elbow, ik.elbow, hands);
  }
  if (contacts?.far) {
    farHandTarget = contactPoint(contacts.far, hip, farKnee);
    const ik = solveArm(shoulder, farHandTarget, trunkAngle);
    arm.farShoulder = lerp(pose.farShoulder, ik.shoulder, hands);
    arm.farElbow = lerp(pose.farElbow, ik.elbow, hands);
  }
  const near = armPoints(shoulder, trunkAngle, arm.shoulder, arm.elbow);
  const far = armPoints(shoulder, trunkAngle, arm.farShoulder, arm.farElbow);

  const nearFoot = footPoints(ankle, 90);
  const farFoot = footPoints(farAnkle, farFootAngle);

  const sk: Skeleton = {
    ankle,
    heel: nearFoot.heel,
    toe: nearFoot.toe,
    knee,
    hip,
    elbow: near.elbow,
    wrist: near.wrist,
    hand: near.hand,
    lumbar,
    shoulder,
    neckBase,
    head,
    farKnee,
    farAnkle,
    farHeel: farFoot.heel,
    farToe: farFoot.toe,
    farElbow: far.elbow,
    farWrist: far.wrist,
    farHand: far.hand,
    footAngle: 90,
    farFootAngle,
    headAngle,
    arm,
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
  const footCom = (ankle: Vec, toe: Vec, heel: Vec) => {
    // 足首と母趾球（つま先より少し手前）の中間
    const ball = lerpVec(heel, toe, 0.8);
    add(lerpVec(ankle, ball, MASS.foot.com), MASS.foot.mass);
  };

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
  footCom(sk.ankle, sk.toe, sk.heel);
  footCom(sk.farAnkle, sk.farToe, sk.farHeel);
  return { x: mx / total, y: my / total };
}

const FLOOR_TOLERANCE = 0.006; // 足が床についているとみなす高さの誤差
const BUTTOCK_BACK = 0.08; // 股関節から、お尻の後ろの接点まで
const THIGH_REST = 0.5; // 太もものうち、座面に乗る部分（股関節から膝への割合の上限）

export interface SupportRange {
  min: number;
  max: number;
}

// 体を支えている範囲（前後方向）。床についた足と、座っている間の座面を合わせた範囲。
export function supportRange(sk: Skeleton, onSeat: boolean, props: Prop[]): SupportRange {
  let min = Math.min(sk.heel.x, sk.toe.x);
  let max = Math.max(sk.heel.x, sk.toe.x);
  const farOnFloor = Math.abs(sk.farHeel.y) < FLOOR_TOLERANCE && Math.abs(sk.farToe.y) < FLOOR_TOLERANCE;
  if (farOnFloor) {
    min = Math.min(min, sk.farHeel.x, sk.farToe.x);
    max = Math.max(max, sk.farHeel.x, sk.farToe.x);
  }
  if (onSeat) {
    for (const prop of props) {
      if (prop.type !== 'chair') continue;
      const back = Math.max(prop.x, sk.hip.x - BUTTOCK_BACK);
      const front = Math.min(prop.x + prop.seatDepth, lerp(sk.hip.x, sk.knee.x, THIGH_REST));
      if (front > back) {
        min = Math.min(min, back);
        max = Math.max(max, front);
      }
    }
  }
  return { min, max };
}

export interface Frame extends Sample {
  t: number;
  sk: Skeleton;
  com: Vec;
  support: SupportRange;
  stable: boolean; // 重心の真下の点が、支えている範囲の中にあるか
}

// 時刻 t の1コマ分（姿勢、体の各点、重心、支えの範囲）を求める
export function computeFrame(anim: AnimationData, t: number): Frame {
  const sample = sampleAnimation(anim, t);
  const sk = solveSide(sample.pose, anim.root.x, anim.contacts, sample.hands);
  const com = centerOfMass(sk);
  const support = supportRange(sk, sample.onSeat, anim.props);
  return { ...sample, t, sk, com, support, stable: com.x >= support.min && com.x <= support.max };
}
