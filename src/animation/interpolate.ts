// キーフレームの補間。
// 区分3次エルミート補間（Fritsch–Carlson の単調補間）を、1往復で輪になるように使う。
//  ・キーフレームの値を必ず通る
//  ・隣り合うキーフレームの値の範囲からはみ出さない（反動がつかない）
//  ・同じ姿勢が続く所（止まる所）では速さが 0 になる（ゆっくり始まり、ゆっくり止まる）
//  ・途中のキーフレームは止まらずに滑らかに通る

import { FAR_DEFAULT } from './bodyModel';
import type { AnimationData, FarJoint, FullPose, JointName, Pose } from './types';

const JOINT_NAMES: JointName[] = [
  'ankle',
  'knee',
  'hip',
  'spine',
  'neck',
  'shoulder',
  'elbow',
  'farAnkle',
  'farKnee',
  'farHip',
  'farShoulder',
  'farElbow',
];

export function fullPose(pose: Pose): FullPose {
  const full = { ...pose } as FullPose;
  for (const far of Object.keys(FAR_DEFAULT) as FarJoint[]) {
    if (pose[far] === undefined) full[far] = pose[FAR_DEFAULT[far]];
  }
  return full;
}

// 時刻 t を 0 以上 period 未満に直す
export function wrapTime(t: number, period: number): number {
  const w = t % period;
  return w < 0 ? w + period : w;
}

export interface CyclicCurve {
  times: number[];
  values: number[];
  tangents: number[];
  period: number;
}

// 輪になった単調3次補間の準備（各キーフレームでの傾きを決める）
export function buildCurve(times: number[], values: number[], period: number): CyclicCurve {
  const n = times.length;
  if (n === 0 || n !== values.length) throw new Error('キーフレームの数が正しくありません');
  const h: number[] = []; // 次のキーフレームまでの時間
  const d: number[] = []; // 区間の傾き
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const len = (next === 0 ? times[0]! + period : times[next]!) - times[i]!;
    if (!(len > 0)) throw new Error('キーフレームの時刻は昇順で、1往復の時間より小さくしてください');
    h.push(len);
    d.push((values[next]! - values[i]!) / len);
  }
  const tangents: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const d0 = d[prev]!;
    const d1 = d[i]!;
    if (n === 1 || d0 * d1 <= 0) {
      // 向きが変わる所、止まっている所では傾き 0
      tangents.push(0);
    } else {
      const h0 = h[prev]!;
      const h1 = h[i]!;
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      tangents.push((w1 + w2) / (w1 / d0 + w2 / d1));
    }
  }
  return { times, values, tangents, period };
}

// 区間の番号を返す（times[i] <= t < 次の時刻）。t は wrapTime 済み
function segmentIndex(times: number[], t: number): number {
  let i = times.length - 1;
  if (t < times[0]!) return i; // 最後のキーフレームから最初へ戻る区間
  while (i > 0 && times[i]! > t) i--;
  return i;
}

export function evalCurve(c: CyclicCurve, time: number): number {
  const n = c.times.length;
  if (n === 1) return c.values[0]!;
  const t = wrapTime(time, c.period);
  const i = segmentIndex(c.times, t);
  const next = (i + 1) % n;
  const t0 = c.times[i]!;
  const t1 = next === 0 ? c.times[0]! + c.period : c.times[next]!;
  const h = t1 - t0;
  const s = ((t < t0 ? t + c.period : t) - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * c.values[i]! +
    (s3 - 2 * s2 + s) * h * c.tangents[i]! +
    (-2 * s3 + 3 * s2) * c.values[next]! +
    (s3 - s2) * h * c.tangents[next]!
  );
}

export interface Sample {
  pose: FullPose;
  onSeat: boolean;
  hands: number;
}

interface Compiled {
  times: number[];
  joints: Record<JointName, CyclicCurve>;
  hands: CyclicCurve;
  onSeat: boolean[];
  period: number;
}

const compiledCache = new WeakMap<AnimationData, Compiled>();

function compile(anim: AnimationData): Compiled {
  const cached = compiledCache.get(anim);
  if (cached) return cached;
  const times = anim.keyframes.map((k) => k.t);
  const poses = anim.keyframes.map((k) => fullPose(k.pose));
  const joints = {} as Record<JointName, CyclicCurve>;
  for (const name of JOINT_NAMES) {
    joints[name] = buildCurve(times, poses.map((p) => p[name]), anim.cycleSeconds);
  }
  const compiled: Compiled = {
    times,
    joints,
    hands: buildCurve(times, anim.keyframes.map((k) => k.hands ?? 0), anim.cycleSeconds),
    onSeat: anim.keyframes.map((k) => k.onSeat === true),
    period: anim.cycleSeconds,
  };
  compiledCache.set(anim, compiled);
  return compiled;
}

// 時刻 t（秒）の姿勢を求める
export function sampleAnimation(anim: AnimationData, time: number): Sample {
  const c = compile(anim);
  const pose = {} as FullPose;
  for (const name of JOINT_NAMES) pose[name] = evalCurve(c.joints[name], time);
  const t = wrapTime(time, c.period);
  const i = segmentIndex(c.times, t);
  const next = (i + 1) % c.times.length;
  // キーフレームちょうどの時刻は、その姿勢の状態を使う。途中は前後が両方座面についている間だけ座面を数える
  const onSeat = t === c.times[i] ? c.onSeat[i]! : c.onSeat[i]! && c.onSeat[next]!;
  const hands = Math.min(1, Math.max(0, evalCurve(c.hands, time)));
  return { pose, onSeat, hands };
}
