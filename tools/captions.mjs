// 字幕の整え方（全アニメ共通）。一瞬しか出ない字幕をなくす。
//  ・最初の姿勢を説明する短い字幕は、「姿勢の文」（posture）に移す。姿勢の文は、動きの字幕の上に出し続ける
//  ・途中の短い字幕（止める、など）は、前の字幕と1つの文にまとめて、長く出す
// どの字幕も MIN_SECONDS 秒以上出るようにする（テストでも確かめる）。

import { CONFIRMED } from './confirmed.mjs';

export const MIN_SECONDS = 2;

// 短い字幕を前の字幕とまとめたときの文。「前の文＋短い文」→ まとめた文
const MERGED = {
  '前かがみになって、立ち上がります＋背筋を伸ばして立ちます': '前かがみで立ち上がり、背筋を伸ばします',
  '片方の膝をゆっくり伸ばします＋伸ばしたまま止めます': '片方の膝をゆっくり伸ばし、止めます',
  '片方の脚を、ゆっくり横へ上げます＋上げたまま止めます。上体は傾けません': '上体を傾けず、脚をゆっくり横へ上げ、止めます',
  '片方の脚を、ゆっくり後ろへ上げます＋上げたまま止めます': '片方の脚をゆっくり後ろへ上げ、止めます',
};

export function tidyCaptions(anim) {
  const captions = anim.captions.map((c) => ({ ...c }));
  // 確認済みの印は、確かめた一覧（confirmed.mjs）で決める
  const out = { ...anim, checked: CONFIRMED.includes(anim.id) };
  // 最初の姿勢の字幕 → 姿勢の文
  if (captions.length > 1 && captions[0].from === 0 && captions[0].to - captions[0].from < MIN_SECONDS) {
    out.posture = captions[0].text;
    captions.shift();
    captions[0].from = 0;
  }
  // 途中の短い字幕 → 前の字幕とまとめる
  for (let i = 1; i < captions.length; i++) {
    const c = captions[i];
    if (c.to - c.from >= MIN_SECONDS) continue;
    const prev = captions[i - 1];
    const key = `${prev.text}＋${c.text}`;
    if (!MERGED[key]) throw new Error(`${anim.id}：短い字幕をまとめた文が決まっていません（${key}）`);
    prev.text = MERGED[key];
    prev.to = c.to;
    captions.splice(i, 1);
    i--;
  }
  for (const c of captions) {
    if (c.to - c.from < MIN_SECONDS) throw new Error(`${anim.id}：字幕が短すぎます（${c.text}）`);
  }
  // 項目の順をそろえる（posture は captions の直前）
  const { captions: _old, posture, ...rest } = out;
  const ordered = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === 'reverseCaptions' || k === 'marks') continue;
    ordered[k] = v;
  }
  if (posture !== undefined) ordered.posture = posture;
  ordered.captions = captions;
  if (rest.reverseCaptions) ordered.reverseCaptions = rest.reverseCaptions;
  ordered.marks = rest.marks;
  return ordered;
}
