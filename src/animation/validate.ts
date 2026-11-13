// アニメのデータ（JSON）の検証。プレビューで書き出した JSON も、アプリに入れる前にここを通る。

import { ALL_JOINTS, NEAR_JOINTS } from './bodyModel';
import type { AnimationData } from './types';

export type AnimationValidation = { ok: true; anim: AnimationData } | { ok: false; errors: string[] };

const SEGMENTS = ['head', 'trunk', 'pelvis', 'upperArm', 'forearm', 'thigh', 'shank', 'foot'];
const ANCHORS = ['ankle', 'toe', 'knee', 'hip', 'lumbar', 'shoulder', 'neckBase', 'head', 'elbow', 'hand'];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

export function validateAnimation(input: unknown): AnimationValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ['アニメのデータの形が正しくありません'] };
  const a = input;

  if (typeof a.id !== 'string' || a.id === '') errors.push('id がありません');
  if (typeof a.exercise !== 'string') errors.push('exercise（運動ID）がありません');
  if (!isNumber(a.level)) errors.push('level がありません');
  if (a.view !== 'side') errors.push(`知らない視点です（${String(a.view)}）`);
  const cycle = a.cycleSeconds;
  if (!isNumber(cycle) || cycle <= 0) errors.push('cycleSeconds（1往復の時間）は正の数にしてください');
  if (!isObject(a.root) || !isNumber(a.root.x)) errors.push('root.x がありません');

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

  if (!Array.isArray(a.highlight) || !a.highlight.every((s) => SEGMENTS.includes(s as string))) {
    errors.push('highlight（目立たせる部位）が正しくありません');
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

  if (!Array.isArray(a.keyframes) || a.keyframes.length < 2) {
    errors.push('keyframes は2つ以上必要です');
  } else {
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
      const pose = k.pose;
      for (const j of NEAR_JOINTS) {
        if (!isNumber(pose[j.name])) errors.push(`${where}：${j.name} の角度がありません`);
      }
      for (const j of ALL_JOINTS) {
        const v = pose[j.name];
        if (v === undefined) continue;
        if (!isNumber(v)) errors.push(`${where}：${j.name} が数ではありません`);
        else if (v < j.min || v > j.max) errors.push(`${where}：${j.name} = ${v} が可動域（${j.min}〜${j.max}）を超えています`);
      }
      if (k.onSeat !== undefined && typeof k.onSeat !== 'boolean') errors.push(`${where}：onSeat が正しくありません`);
      if (k.hands !== undefined && (!isNumber(k.hands) || k.hands < 0 || k.hands > 1)) errors.push(`${where}：hands は 0〜1 にしてください`);
      if (k.label !== undefined && typeof k.label !== 'string') errors.push(`${where}：label が正しくありません`);
    });
  }

  const inCycle = (from: unknown, to: unknown) => isNumber(from) && isNumber(to) && from >= 0 && to > from && (!isNumber(cycle) || to <= cycle);

  if (!Array.isArray(a.captions)) {
    errors.push('captions がありません');
  } else {
    a.captions.forEach((c, i) => {
      if (!isObject(c) || typeof c.text !== 'string' || !inCycle(c.from, c.to)) errors.push(`字幕${i + 1}が正しくありません`);
    });
  }

  if (!Array.isArray(a.marks)) {
    errors.push('marks がありません');
  } else {
    a.marks.forEach((m, i) => {
      const ok =
        isObject(m) &&
        m.type === 'arrow' &&
        inCycle(m.from, m.to) &&
        ANCHORS.includes(m.anchor as string) &&
        [m.dx, m.dy, m.angle, m.length].every(isNumber);
      if (!ok) errors.push(`印${i + 1}が正しくありません`);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, anim: input as unknown as AnimationData };
}
