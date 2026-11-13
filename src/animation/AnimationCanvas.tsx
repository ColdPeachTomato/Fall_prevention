// アニメを Canvas に描く部品。時刻は外から受け取る（運動画面のカウントと同じ時計を使うため）。

import { useEffect, useRef, useState } from 'react';
import { drawFrame } from './draw';
import { wrapTime } from './interpolate';
import { computeFrame } from './sideRig';
import type { AnimationData } from './types';

interface Props {
  anim: AnimationData;
  getTime: () => number; // アニメの中の時刻（秒）。1往復の時間を超えたら折り返す
  label: string; // 読み上げ用の説明
  showCaption?: boolean;
  showBalance?: boolean;
  showJoints?: boolean;
}

function captionAt(anim: AnimationData, t: number): string {
  return anim.captions.find((c) => t >= c.from && t < c.to)?.text ?? '';
}

export function AnimationCanvas({ anim, getTime, label, showCaption = true, showBalance, showJoints }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ anim, getTime, showBalance, showJoints });
  latest.current = { anim, getTime, showBalance, showJoints };
  const [caption, setCaption] = useState(() => captionAt(anim, wrapTime(getTime(), anim.cycleSeconds)));

  useEffect(() => {
    let raf = 0;
    let lastCaption = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { anim: a, getTime: time, showBalance: balance, showJoints: joints } = latest.current;
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
      const t = wrapTime(time(), a.cycleSeconds);
      drawFrame(ctx, a, computeFrame(a, t), { width, height, dpr, showBalance: balance, showJoints: joints });
      const text = captionAt(a, t);
      if (text !== lastCaption) {
        lastCaption = text;
        setCaption(text);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="anim">
      <canvas ref={canvasRef} className="anim-canvas" role="img" aria-label={label} />
      {showCaption && <p className="anim-caption">{caption || ' '}</p>}
    </div>
  );
}
