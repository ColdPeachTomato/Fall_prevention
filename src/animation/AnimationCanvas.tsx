// アニメを Canvas に描く部品。時刻は外から受け取る（運動画面のカウントと同じ時計を使うため）。

import { useEffect, useRef, useState } from 'react';
import { wrapTime } from './interpolate';
import { drawScene, viewBoxOf } from './scene';
import type { AnimationData, Caption } from './types';

interface Props {
  anim: AnimationData;
  getTime: () => number; // アニメの中の時刻（秒）。1往復の時間を超えたら折り返す
  label: string; // 読み上げ用の説明
  showCaption?: boolean;
  showBalance?: boolean;
  showJoints?: boolean;
  mirror?: boolean; // 左右反転（左側で行うとき）
  reverse?: boolean; // 逆向きに再生する（内回し・前回しなど）。字幕は reverseCaptions を使う
  onCaption?: (caption: Caption) => void; // 字幕が切り替わったとき（読み上げに使う）
}

function captionAt(anim: AnimationData, t: number, reverse: boolean | undefined): Caption | undefined {
  const captions = reverse ? anim.reverseCaptions ?? [] : anim.captions;
  return captions.find((c) => t >= c.from && t < c.to);
}

export function AnimationCanvas({ anim, getTime, label, showCaption = true, showBalance, showJoints, mirror, reverse, onCaption }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ anim, getTime, showBalance, showJoints, mirror, reverse, onCaption });
  latest.current = { anim, getTime, showBalance, showJoints, mirror, reverse, onCaption };
  const [caption, setCaption] = useState(() => captionAt(anim, wrapTime(getTime(), anim.cycleSeconds), reverse)?.text ?? '');

  useEffect(() => {
    let raf = 0;
    let lastCaption: Caption | undefined;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { anim: a, getTime: time, showBalance: balance, showJoints: joints, mirror: flip, reverse: backward } = latest.current;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const t = wrapTime(time(), a.cycleSeconds); // 再生の時刻
      // 逆向きの再生では、同じキーフレームを終わりから始めへたどる
      const animTime = backward ? wrapTime(a.cycleSeconds - t, a.cycleSeconds) : t;
      drawScene(ctx, a, animTime, { width, height, dpr, showBalance: balance, showJoints: joints, mirror: flip, reverse: backward });
      const current = captionAt(a, t, backward);
      if (current !== lastCaption) {
        lastCaption = current;
        setCaption(current?.text ?? '');
        if (current) latest.current.onCaption?.(current);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // キャンバスの縦横の比を、アニメの表示する範囲に合わせる（腕を広げる種目は横に広くなる）
  const box = viewBoxOf(anim);
  const aspectRatio = (box.maxX - box.minX) / (box.maxY - box.minY);

  return (
    <div className="anim">
      <canvas ref={canvasRef} className="anim-canvas" role="img" aria-label={label} style={{ aspectRatio }} />
      {showCaption && <p className="anim-caption">{caption || ' '}</p>}
    </div>
  );
}
