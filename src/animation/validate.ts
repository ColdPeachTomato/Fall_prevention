// アニメのデータ（JSON）の検証。プレビューで書き出した JSON も、アプリに入れる前にここを通る。

import { ALL_JOINTS, FRONT_CHANNELS, FRONT_VECTORS, NEAR_JOINTS } from './bodyModel';
import type { AnimationData } from './types';

export type AnimationValidation = { ok: true; anim: AnimationData } | { ok: false; errors: string[] };

const SEGMENTS = ['head', 'trunk', 'pelvis', 'upperArm', 'forearm', 'thigh', 'shank', 'foot'];
const ANCHORS = ['ankle', 'heel', 'toe', 'knee', 'hip', 'lumbar', 'shoulder', 'neckBase', 'head', 'elbow', 'hand', 'farAnkle', 'farKnee'];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

type Input = Record<string, unknown>;

// 視点によらず共通の項目
function validateCommon(a: Input, errors: string[]): void {
  if (typeof a.id !== 'string' || a.id === '') errors.push('id がありません');
  if (typeof a.exercise !== 'string') errors.push('exercise（運動ID）がありません');
  if (!isNumber(a.level)) errors.push('level がありません');
  const cycle = a.cycleSeconds;
  if (!isNumber(cycle) || cycle <= 0) errors.push('cycleSeconds（1往復の時間）は正の数にしてください');
  if (a.countsPerCycle !== undefined && !(isNumber(a.countsPerCycle) && Number.isInteger(a.countsPerCycle) && a.countsPerCycle >= 1)) {
    errors.push('countsPerCycle は 1 以上の整数にしてください');
  }
  if (a.checked !== undefined && typeof a.checked !== 'boolean') errors.push('checked が正しくありません');
  const inCycle = (from: unknown, to: unknown) => isNumber(from) && isNumber(to) && from >= 0 && to > from && (!isNumber(cycle) || to <= cycle);
  for (const key of ['captions', 'reverseCaptions'] as const) {
    const list = a[key];
    if (list === undefined && key === 'reverseCaptions') continue;
    if (!Array.isArray(list)) {
      errors.push(`${key} がありません`);
      continue;
    }
    list.forEach((c, i) => {
      if (!isObject(c) || typeof c.text !== 'string' || !inCycle(c.from, c.to)) errors.push(`字幕${i + 1}が正しくありません（${key}）`);
    });
  }
}

// キーフレームの時刻と、視点によらず共通の項目を確かめる。姿勢の中身は check で確かめる
function validateKeyframes(a: Input, errors: string[], check: (pose: Input, where: string, k: Input) => void): void {
  const cycle = a.cycleSeconds;
  if (!Array.isArray(a.keyframes) || a.keyframes.length < 2) {
    errors.push('keyframes は2つ以上必要です');
    return;
  }
  let prev = -Infinity;
  a.keyframes.forEach((k, i) => {
    const where = `キーフレーム${i + 1}`;
    if (!isObject(k) || !isNumber(k.t) || !isObject(k.pose)) {
      errors.push(`${where}の形が正しくありません`);
      return;
    }
    if (k.t < 0 || (isNumber(cycle) && k.t >= cycle)) errors.push(`${where}：時刻は 0 以上、1往復の時間より小さくしてください`);
    if (k.t <= prev) errors.push(`${where}：時刻は前のキーフレームより後にしてください`);
    prev = k.t;
    check(k.pose, where, k);
    if (k.onSeat !== undefined && typeof k.onSeat !== 'boolean') errors.push(`${where}：onSeat が正しくありません`);
    if (k.label !== undefined && typeof k.label !== 'string') errors.push(`${where}：label が正しくありません`);
  });
}

const FRONT_POINTS = ['shoulder', 'elbow', 'hand', 'hip', 'knee', 'ankle', 'heel', 'toe'];
const FRONT_ANCHORS = ['pelvis', 'lumbar', 'chest', 'neckBase', 'head', ...FRONT_POINTS.flatMap((p) => [`r.${p}`, `l.${p}`])];

// 正面・後ろ向きのアニメ
function validateFront(a: Input): AnimationValidation {
  const errors: string[] = [];
  validateCommon(a, errors);
  const cycle = a.cycleSeconds;

  if (!isObject(a.root) || (a.root.mode !== 'seat' && a.root.mode !== 'stand') || !isNumber(a.root.x) || !isNumber(a.root.y)) {
    errors.push('root が正しくありません（mode は seat か stand）');
  }
  if (a.support !== undefined) {
    const s = a.support;
    const ok =
      isObject(s) &&
      (s.hand === 'r' || s.hand === 'l') &&
      (s.side === undefined || (isObject(s.side) && isNumber(s.side.x) && isNumber(s.side.y))) &&
      isObject(s.front) &&
      [s.front.x, s.front.half, s.front.y].every(isNumber);
    if (!ok) errors.push('support（つかまる所の、手を置く点）が正しくありません');
  }
  if (a.plants !== undefined) {
    if (!isObject(a.plants)) {
      errors.push('plants の形が正しくありません');
    } else {
      for (const [side, p] of Object.entries(a.plants)) {
        if ((side !== 'r' && side !== 'l') || !isObject(p) || !isNumber(p.x)) errors.push(`plants.${side} が正しくありません`);
      }
    }
  }
  const box = a.viewBox;
  if (!isObject(box) || ![box.minX, box.maxX, box.minY, box.maxY].every(isNumber) || !(Number(box.maxX) > Number(box.minX)) || !(Number(box.maxY) > Number(box.minY))) {
    errors.push('viewBox（表示する範囲）が正しくありません');
  }
  if (!Array.isArray(a.props)) {
    errors.push('props がありません');
  } else {
    a.props.forEach((p, i) => {
      if (isObject(p) && p.type === 'band') return;
      if (!isObject(p) || (p.type !== 'chair' && p.type !== 'counter')) {
        errors.push(`props の${i + 1}番目：知らない種類です`);
        return;
      }
      const sizes = p.type === 'chair' ? [p.x, p.width, p.seatHeight, p.backHeight] : [p.x, p.width, p.height];
      if (!sizes.every(isNumber)) errors.push(`props の${i + 1}番目：寸法が正しくありません`);
      const stages = ['both', 'one', 'fingertip', 'none'];
      if (p.showFor !== undefined && !(Array.isArray(p.showFor) && p.showFor.every((s) => stages.includes(s as string)))) {
        errors.push(`props の${i + 1}番目：showFor が正しくありません`);
      }
      if (p.inFront !== undefined && typeof p.inFront !== 'boolean') errors.push(`props の${i + 1}番目：inFront が正しくありません`);
    });
  }
  if (!Array.isArray(a.highlight) || !a.highlight.every((s) => typeof s === 'string' && (s === 'scapula' || SEGMENTS.includes(s.replace(/^(r|l):/, ''))))) {
    errors.push('highlight（目立たせる部位）が正しくありません');
  }

  validateKeyframes(a, errors, (pose, where) => {
    const known = new Set<string>(FRONT_CHANNELS.map((c) => c.name));
    for (const key of Object.keys(pose)) {
      if (!known.has(key)) errors.push(`${where}：知らない項目です（${key}）`);
    }
    for (const c of FRONT_CHANNELS) {
      const v = pose[c.name];
      if (v === undefined) continue;
      if (!isNumber(v)) errors.push(`${where}：${c.name} が数ではありません`);
      else if (v < c.min || v > c.max) errors.push(`${where}：${c.name} = ${v} が範囲（${c.min}〜${c.max}）を超えています`);
    }
    // 手足の見かけの長さは、実際の長さを超えない
    for (const [out, up] of FRONT_VECTORS) {
      const o = pose[out] ?? pose[`r${out.slice(1)}`];
      const u = pose[up] ?? pose[`r${up.slice(1)}`];
      if (isNumber(o) && isNumber(u) && Math.hypot(o, u) > 1.0005) errors.push(`${where}：${out} と ${up} を合わせた長さが 1 を超えています`);
    }
  });

  const inCycle = (from: unknown, to: unknown) => isNumber(from) && isNumber(to) && from >= 0 && to > from && (!isNumber(cycle) || to <= cycle);
  if (!Array.isArray(a.marks)) {
    errors.push('marks がありません');
  } else {
    a.marks.forEach((m, i) => {
      const base = isObject(m) && inCycle(m.from, m.to) && FRONT_ANCHORS.includes(m.anchor as string) && [m.dx, m.dy].every(isNumber);
      const shape =
        isObject(m) &&
        (((m.type === 'arrow' || m.type === 'line') && [m.angle, m.length].every(isNumber)) ||
          (m.type === 'arc' && [m.radius, m.start, m.sweep].every(isNumber) && Number(m.radius) > 0 && m.sweep !== 0));
      if (!base || !shape) errors.push(`印${i + 1}が正しくありません`);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, anim: a as unknown as AnimationData };
}

export function validateAnimation(input: unknown): AnimationValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ['アニメのデータの形が正しくありません'] };
  const a = input;
  if (a.view === 'front' || a.view === 'back') return validateFront(a);
  if (a.view !== 'side') return { ok: false, errors: [`知らない視点です（${String(a.view)}）`] };

  validateCommon(a, errors);
  const cycle = a.cycleSeconds;
  if (!isObject(a.root) || !isNumber(a.root.x)) {
    errors.push('root.x がありません');
  } else if (a.root.mode === 'seat' || a.root.mode === 'hip') {
    if (!isNumber(a.root.y) || !isNumber(a.root.pelvis)) errors.push('root（股関節が起点）には y と pelvis が必要です');
  } else if (a.root.mode !== undefined && a.root.mode !== 'foot') {
    errors.push(`知らない起点です（${String(a.root.mode)}）`);
  }
  if (a.plants !== undefined) {
    if (!isObject(a.plants)) {
      errors.push('plants の形が正しくありません');
    } else {
      for (const side of ['near', 'far'] as const) {
        const p = a.plants[side];
        if (p === undefined) continue;
        if (!isObject(p) || (p.pivot !== 'ball' && p.pivot !== 'heel') || !isNumber(p.x)) errors.push(`plants.${side} が正しくありません`);
      }
    }
  }

  if (!Array.isArray(a.props)) {
    errors.push('props がありません');
  } else {
    a.props.forEach((p, i) => {
      if (!isObject(p) || p.type !== 'chair') {
        errors.push(`props の${i + 1}番目：知らない種類です`);
      } else if (![p.x, p.seatHeight, p.seatDepth, p.backHeight].every(isNumber)) {
        errors.push(`props の${i + 1}番目：椅子の寸法が正しくありません`);
      }
    });
  }

  if (!Array.isArray(a.highlight) || !a.highlight.every((s) => typeof s === 'string' && SEGMENTS.includes(s.replace(/^(near|far):/, '')))) {
    errors.push('highlight（目立たせる部位）が正しくありません');
  }

  if (a.support !== undefined && !(isObject(a.support) && isNumber(a.support.x) && isNumber(a.support.y))) {
    errors.push('support（つかまる所の、手を置く点）が正しくありません');
  }
  if (a.contacts !== undefined) {
    if (!isObject(a.contacts)) {
      errors.push('contacts の形が正しくありません');
    } else {
      for (const side of ['near', 'far'] as const) {
        const c = a.contacts[side];
        if (c === undefined) continue;
        const ok =
          isObject(c) &&
          ((c.on === 'thigh' && isNumber(c.along) && c.along >= 0 && c.along <= 1 && isNumber(c.offset)) ||
            (c.on === 'world' && isNumber(c.x) && isNumber(c.y)));
        if (!ok) errors.push(`contacts.${side} が正しくありません`);
      }
    }
  }

  validateKeyframes(a, errors, (pose, where, k) => {
    for (const j of NEAR_JOINTS) {
      if (!isNumber(pose[j.name])) errors.push(`${where}：${j.name} の角度がありません`);
    }
    for (const j of ALL_JOINTS) {
      const v = pose[j.name];
      if (v === undefined) continue;
      if (!isNumber(v)) errors.push(`${where}：${j.name} が数ではありません`);
      else if (v < j.min || v > j.max) errors.push(`${where}：${j.name} = ${v} が可動域（${j.min}〜${j.max}）を超えています`);
    }
    if (k.hands !== undefined && (!isNumber(k.hands) || k.hands < 0 || k.hands > 1)) errors.push(`${where}：hands は 0〜1 にしてください`);
  });

  const inCycle = (from: unknown, to: unknown) => isNumber(from) && isNumber(to) && from >= 0 && to > from && (!isNumber(cycle) || to <= cycle);

  if (!Array.isArray(a.marks)) {
    errors.push('marks がありません');
  } else {
    a.marks.forEach((m, i) => {
      const ok =
        isObject(m) &&
        (m.type === 'arrow' || m.type === 'line') &&
        inCycle(m.from, m.to) &&
        ANCHORS.includes(m.anchor as string) &&
        [m.dx, m.dy, m.angle, m.length].every(isNumber);
      if (!ok) errors.push(`印${i + 1}が正しくありません`);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, anim: input as unknown as AnimationData };
}
