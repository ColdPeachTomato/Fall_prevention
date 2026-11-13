// 運動の再生。種目の切り替えと休憩は自動で進む。操作は一時停止と中止だけ。
// 立って行う種目の前は、つかまる所の確認を押すまで進まない（S-6）。
// 「中止」は常に表示する（S-7）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlaceholderFigure } from '../animation/PlaceholderFigure';
import { Button } from '../app/Button';
import { SECONDS_PER_LAP, SECONDS_PER_REP, buildSessionSteps, stepSeconds, type Side, type Step } from '../app/sessionPlan';
import { useWakeLock } from '../app/useWakeLock';
import { getExercise } from '../data/exercises';
import type { Menu, SessionKind, StopReason } from '../data/types';
import { SUPPORT_LABEL } from '../menu/support';
import { STOP_REASONS } from '../safety/texts';

interface Props {
  menu: Menu;
  kind: SessionKind;
  onFinish: (completed: string[]) => void;
  onStop: (stopped: { ex: string; reason: StopReason }, completed: string[]) => void;
}

const SIDE_LABEL: Record<Side, string> = { right: '右側', left: '左側' };

function variantOf(exId: string, level: number) {
  const ex = getExercise(exId);
  const variant = ex.variants.find((v) => v.level === level) ?? ex.variants[0]!;
  return { ex, variant };
}

export function Player({ menu, kind, onFinish, onStop }: Props) {
  const steps = useMemo(() => buildSessionSteps(menu, kind), [menu, kind]);
  const itemCount = kind === 'standard' ? menu.standard.length : menu.short.length;
  const levelOf = useMemo(() => {
    const items = kind === 'standard' ? menu.standard : menu.short;
    return new Map(items.map((i) => [i.ex, i.level]));
  }, [menu, kind]);

  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);
  const completedRef = useRef<string[]>([]);

  useWakeLock(true);

  const step: Step | undefined = steps[index];
  const duration = step ? stepSeconds(step) : null;

  const advance = useCallback(() => {
    const current = steps[index];
    if (current?.kind === 'exercise' && current.lastOfItem && !completedRef.current.includes(current.exId)) {
      completedRef.current = [...completedRef.current, current.exId];
    }
    if (index + 1 >= steps.length) {
      onFinish(completedRef.current);
      return;
    }
    setIndex(index + 1);
    setElapsedMs(0);
  }, [index, steps, onFinish]);

  // 時間で進む手順のタイマー
  useEffect(() => {
    if (duration === null || paused || stopping) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // 画面が隠れていた間に一気に進まないよう、1回に進める時間に上限を設ける
      const dt = Math.min(now - last, 1000);
      last = now;
      setElapsedMs((e) => e + dt);
    }, 200);
    return () => window.clearInterval(id);
  }, [index, duration, paused, stopping]);

  useEffect(() => {
    if (duration !== null && elapsedMs >= duration * 1000) advance();
  }, [elapsedMs, duration, advance]);

  if (!step) return null;

  const { ex, variant } = variantOf(step.exId, step.kind === 'rest' || step.kind === 'countdown' ? levelOf.get(step.exId) ?? 1 : step.level);
  const itemNumber = (kind === 'standard' ? menu.standard : menu.short).findIndex((i) => i.ex === step.exId) + 1;
  const remaining = duration === null ? 0 : Math.max(0, Math.ceil(duration - elapsedMs / 1000));

  const stopOverlay = stopping && (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="stop-title">
      <div className="overlay-body">
        <h2 id="stop-title">中止の理由を選んでください</h2>
        <div className="choices">
          {STOP_REASONS.map((r) => (
            <Button key={r.id} variant="secondary" onClick={() => onStop({ ex: step.exId, reason: r.id }, completedRef.current)}>
              {r.label}
            </Button>
          ))}
        </div>
        <Button variant="link" onClick={() => setStopping(false)}>
          中止しないで続ける
        </Button>
      </div>
    </div>
  );

  const controls = (
    <div className="player-controls">
      {duration !== null && (
        <Button variant="secondary" onClick={() => setPaused(!paused)}>
          {paused ? '再開する' : '一時停止'}
        </Button>
      )}
      <Button variant="danger" onClick={() => setStopping(true)}>
        中止
      </Button>
    </div>
  );

  const header = (
    <p className="progress muted">
      {itemNumber} / {itemCount} 種目め
    </p>
  );

  if (step.kind === 'supportCheck') {
    return (
      <main className="screen player">
        {header}
        <h1>{ex.name}</h1>
        <section className="notice">
          <h2>つかまる所の確認</h2>
          <p className="big-text">動かない椅子の背か、カウンターが、すぐ横にありますか。</p>
          {step.support ? (
            <p>この運動は「{SUPPORT_LABEL[step.support]}」で行います。</p>
          ) : (
            <p>この運動は手を使うので、つかまらずに行います。ふらついたらすぐつかまれるよう、つかまる所のすぐ横で行ってください。</p>
          )}
        </section>
        <div className="actions">
          <Button onClick={advance}>すぐ横にある。進む</Button>
        </div>
        {controls}
        {stopOverlay}
      </main>
    );
  }

  if (step.kind === 'rest') {
    return (
      <main className="screen player">
        {header}
        <h1>休憩</h1>
        <p className="count" aria-live="polite">
          あと {remaining} 秒
        </p>
        <p className="lead">{step.reason === 'set' ? `次は ${ex.name} の次のセットです。` : `次は「${ex.name}」です。`}</p>
        {paused && <p className="paused">一時停止中</p>}
        {controls}
        {stopOverlay}
      </main>
    );
  }

  if (step.kind === 'countdown') {
    return (
      <main className="screen player">
        {header}
        <h1>{ex.name}</h1>
        {step.side && <p className="side">{SIDE_LABEL[step.side]}</p>}
        <p className="lead">まもなく始めます</p>
        <p className="count" aria-live="polite">
          {remaining}
        </p>
        {paused && <p className="paused">一時停止中</p>}
        {controls}
        {stopOverlay}
      </main>
    );
  }

  // 運動中
  const elapsedSec = elapsedMs / 1000;
  let countText: string;
  if (step.unit === 'reps') {
    countText = `${Math.min(step.amount, Math.floor(elapsedSec / SECONDS_PER_REP) + 1)} / ${step.amount} 回`;
  } else if (step.unit === 'laps') {
    countText = `${Math.min(step.amount, Math.floor(elapsedSec / SECONDS_PER_LAP) + 1)} / ${step.amount} 往復`;
  } else {
    countText = `あと ${remaining} 秒`;
  }

  return (
    <main className="screen player">
      {header}
      <h1>{ex.name}</h1>
      <p className="muted">
        {step.side && <span className="side">{SIDE_LABEL[step.side]}　</span>}
        {step.sets > 1 && `${step.set} / ${step.sets} セット`}
      </p>
      <PlaceholderFigure posture={variant.posture} />
      <p className="count" aria-live="polite">
        {countText}
      </p>
      {paused && <p className="paused">一時停止中</p>}
      <p className="cue">{ex.cues[0]}</p>
      <p>{variant.howTo}</p>
      {step.support && <p className="muted">つかまり方：{SUPPORT_LABEL[step.support]}</p>}
      {controls}
      {stopOverlay}
    </main>
  );
}
