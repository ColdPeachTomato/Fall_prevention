// 運動の再生。種目の切り替えと休憩は自動で進む。操作は一時停止と中止だけ。
// 立って行う種目の前は、つかまる所の確認を押すまで進まない（S-6）。
// 「中止」は常に表示する（S-7）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimationCanvas } from '../animation/AnimationCanvas';
import { PlaceholderFigure } from '../animation/PlaceholderFigure';
import { getAnimation } from '../animation/registry';
import type { Caption } from '../animation/types';
import { Button } from '../app/Button';
import { buildSessionSteps, stepSeconds, type Side, type Step } from '../app/sessionPlan';
import { speaker } from '../app/speech';
import { SPEECH, shouldAnnounceName, speechForCount, speechForStep } from '../app/speechTexts';
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
const TEXT_UPDATE_MS = 100; // 数字の表示を更新する間隔

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
  // アニメと数字の表示が同じ時計を使う
  const elapsedRef = useRef(0);

  useWakeLock(true);

  const step: Step | undefined = steps[index];
  const duration = step ? stepSeconds(step) : null;

  const advance = useCallback(() => {
    const current = steps[index];
    if (current?.kind === 'exercise' && current.lastOfItem && !completedRef.current.includes(current.exId)) {
      completedRef.current = [...completedRef.current, current.exId];
    }
    if (index + 1 >= steps.length) {
      speaker.say(SPEECH.finish);
      onFinish(completedRef.current);
      return;
    }
    elapsedRef.current = 0;
    setIndex(index + 1);
    setElapsedMs(0);
  }, [index, steps, onFinish]);

  // 時間で進む手順の時計
  useEffect(() => {
    if (duration === null || paused || stopping) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      // 画面が隠れていた間に一気に進まないよう、1回に進める時間に上限を設ける
      elapsedRef.current += Math.min(now - last, 1000);
      last = now;
      const e = elapsedRef.current;
      setElapsedMs((prev) => (e >= duration * 1000 || Math.floor(e / TEXT_UPDATE_MS) !== Math.floor(prev / TEXT_UPDATE_MS) ? e : prev));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, duration, paused, stopping]);

  const remaining = duration === null ? 0 : Math.max(0, Math.ceil(duration - elapsedMs / 1000));

  // ── 読み上げ（開始、回数、切り替え、休憩、終了）。字幕と表示だけでも分かるようにしてある ──
  // 手順が変わったとき
  const spokenStep = useRef(-1);
  useEffect(() => {
    const s = steps[index];
    if (!s || spokenStep.current === index) return;
    spokenStep.current = index;
    speaker.say(speechForStep(s, getExercise(s.exId).name, shouldAnnounceName(steps, index)));
  }, [index, steps]);

  // 回数・往復を終えるたびに、数を読む（アニメの1往復の終わりと合う）
  const completedCount =
    step?.kind === 'exercise' && step.unit !== 'seconds' ? Math.min(step.amount, Math.floor(elapsedMs / 1000 / step.unitSeconds)) : 0;
  useEffect(() => {
    if (completedCount > 0) speaker.say(speechForCount(completedCount));
  }, [index, completedCount]);

  // 秒数で行う種目は、残り5秒を知らせる
  const fiveLeft = step?.kind === 'exercise' && step.unit === 'seconds' && step.amount >= 10 && remaining === 5;
  useEffect(() => {
    if (fiveLeft) speaker.say(SPEECH.lastFiveSeconds);
  }, [index, fiveLeft]);

  // 一時停止と中止では、読み上げも止める
  useEffect(() => {
    if (paused || stopping) speaker.stop();
  }, [paused, stopping]);

  useEffect(() => {
    if (duration !== null && elapsedMs >= duration * 1000) advance();
  }, [elapsedMs, duration, advance]);

  if (!step) return null;

  const { ex, variant } = variantOf(step.exId, step.kind === 'rest' || step.kind === 'countdown' ? levelOf.get(step.exId) ?? 1 : step.level);
  const anim = getAnimation(variant.animationId);
  const itemNumber = (kind === 'standard' ? menu.standard : menu.short).findIndex((i) => i.ex === step.exId) + 1;
  const mirror = (step.kind === 'countdown' || step.kind === 'exercise') && step.side === 'left';
  // 2つ目の向き（内回し・前回しなど）は、同じアニメを逆向きに再生する
  const direction = step.kind === 'countdown' || step.kind === 'exercise' ? step.direction : null;
  const reverse = direction?.index === 1 && anim?.reverseCaptions !== undefined;
  // S-10：人物は、メニューの支えの段階どおりにつかまる
  const support = step.kind === 'countdown' || step.kind === 'exercise' ? step.support : null;
  // 見ている向きが分かりにくい視点は、言葉で添える
  const viewNote = anim?.view === 'back' ? '後ろから見た図' : null;
  // 最初の1往復だけ、動きの説明（字幕）も読み上げる。短すぎる字幕は読まない
  const speakCaption = (c: Caption) => {
    if (anim && elapsedRef.current / 1000 < anim.cycleSeconds && c.to - c.from >= 1) speaker.say(c.text);
  };

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
        <p className="purpose">{ex.purpose}</p>
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
        <p className="purpose">{ex.purpose}</p>
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
        {/* 何のための運動かを、始める前に伝える。運動中は、回数が下へ押し出されないよう出さない */}
        <p className="purpose">{ex.purpose}</p>
        {(step.side || direction) && <p className="side">{[step.side && SIDE_LABEL[step.side], direction?.label].filter(Boolean).join('　')}</p>}
        {/* 始める前に、最初の姿勢を見せる */}
        {anim && <AnimationCanvas key={`${anim.id}-${index}`} anim={anim} getTime={() => 0} label={`${ex.name}の最初の姿勢`} showCaption={false} mirror={mirror} reverse={reverse} support={support} />}
        {viewNote && <p className="muted view-note">{viewNote}</p>}
        <p className="lead countdown-lead">
          まもなく始めます
          <span className="count countdown-count" aria-live="polite">
            {remaining}
          </span>
        </p>
        {paused && <p className="paused">一時停止中</p>}
        <p>{variant.howTo}</p>
        {support && <p className="muted">つかまり方：{SUPPORT_LABEL[support]}</p>}
        {controls}
        {stopOverlay}
      </main>
    );
  }

  // 運動中
  let countText: string;
  if (step.unit === 'seconds') {
    countText = `あと ${remaining} 秒`;
  } else {
    // 1往復（アニメの1往復）の終わりで、次の回に進む
    const current = Math.min(step.amount, Math.floor(elapsedMs / 1000 / step.unitSeconds) + 1);
    countText = `${current} / ${step.amount} ${step.unit === 'reps' ? '回' : '往復'}`;
  }

  return (
    <main className="screen player">
      {header}
      <h1>{ex.name}</h1>
      {(step.side || direction || step.sets > 1) && (
        <p className="muted">
          {(step.side || direction) && <span className="side">{[step.side && SIDE_LABEL[step.side], direction?.label].filter(Boolean).join('　')}　</span>}
          {step.sets > 1 && `${step.set} / ${step.sets} セット`}
        </p>
      )}
      {anim ? (
        <AnimationCanvas key={`${anim.id}-${index}`} anim={anim} getTime={() => elapsedRef.current / 1000} label={`${ex.name}の動きの見本`} mirror={mirror} reverse={reverse} support={support} onCaption={speakCaption} />
      ) : (
        <PlaceholderFigure posture={variant.posture} />
      )}
      {viewNote && <p className="muted view-note">{viewNote}</p>}
      <p className="count" aria-live="polite">
        {countText}
      </p>
      {paused && <p className="paused">一時停止中</p>}
      <p className="cue">{ex.cues[0]}</p>
      {!anim && <p>{variant.howTo}</p>}
      {step.support && <p className="muted">つかまり方：{SUPPORT_LABEL[step.support]}</p>}
      {controls}
      {stopOverlay}
    </main>
  );
}
