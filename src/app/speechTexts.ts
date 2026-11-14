// 読み上げる文。開始、回数、切り替え、休憩、終了を知らせる。
// 画面の字幕・表示と同じ内容にし、消音でも字幕だけで分かるようにする。

import type { Step } from './sessionPlan';

export const SPEECH = {
  begin: '運動を始めます。',
  supportCheck: 'つかまる所が、すぐ横にあるか、確かめてください。',
  finish: '終わりです。おつかれさまでした。',
  lastFiveSeconds: 'あと5秒。',
} as const;

// カウントダウンで種目の名前を読むか。その種目の最初のカウントダウンで、直前に名前を読んでいないときだけ読む
export function shouldAnnounceName(steps: Step[], index: number): boolean {
  const step = steps[index]!;
  if (steps[index - 1]?.kind === 'supportCheck') return false; // つかまる所の確認で読んだばかり
  for (let i = index - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === 'exercise') return s.exId !== step.exId;
  }
  return true;
}

// 手順が変わったときに読み上げる文
export function speechForStep(step: Step, exerciseName: string, announceName: boolean): string {
  switch (step.kind) {
    case 'supportCheck':
      return `${exerciseName}。${SPEECH.supportCheck}`;
    case 'rest':
      return step.reason === 'next' ? `休憩です。次は、${exerciseName}です。` : '休憩です。もう1セット行います。';
    case 'countdown': {
      const name = announceName ? `${exerciseName}。` : '';
      // 回す向きを替えるとき（同じ側の2つ目の向き）
      if (step.direction?.index === 1) return `次は、${step.direction.label}です。まもなく始めます。`;
      const direction = step.direction ? `${step.direction.label}です。` : '';
      if (step.side === 'right') return `${name}右側から行います。${direction}まもなく始めます。`;
      if (step.side === 'left') return `反対側、左側です。${direction}まもなく始めます。`;
      return `${name}${direction}まもなく始めます。`;
    }
    case 'exercise':
      // 秒数で行う種目は、保つ時間を伝える。回数で行う種目は、1回ごとに数を読む
      return step.unit === 'seconds' ? `${step.amount}秒、そのまま保ちます。` : '';
  }
}

// 回数・往復を終えるたびに読む数
export function speechForCount(completed: number): string {
  return String(completed);
}
