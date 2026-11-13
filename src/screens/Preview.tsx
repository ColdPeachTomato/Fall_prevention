// アニメのプレビュー画面（開発用）。本番の画面からは入れない。URL の末尾に #preview を付けて開く。
// アニメの一覧、コマ送り、各関節の角度のスライダー、重心と支えの範囲の表示、JSON の書き出しを備える。

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimationCanvas } from '../animation/AnimationCanvas';
import { FAR_DEFAULT, FAR_JOINTS, NEAR_JOINTS, type JointDef } from '../animation/bodyModel';
import { wrapTime } from '../animation/interpolate';
import { ANIMATIONS } from '../animation/registry';
import { computeFrame } from '../animation/sideRig';
import type { AnimationData, FarJoint, Keyframe } from '../animation/types';
import { validateAnimation } from '../animation/validate';

const FRAME_STEP = 0.1; // コマ送りの幅（秒）
const SCAN_STEP = 0.05; // 警告を探す間隔（秒）
const MIN_GAP = 0.05; // キーフレームどうしの最小の間隔（秒）

function clone(anim: AnimationData): AnimationData {
  return JSON.parse(JSON.stringify(anim)) as AnimationData;
}

// 重心が支えの範囲の外に出る時間帯を探す
function findUnstable(anim: AnimationData): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  let start: number | null = null;
  const count = Math.round(anim.cycleSeconds / SCAN_STEP);
  for (let i = 0; i <= count; i++) {
    const t = Math.min(i * SCAN_STEP, anim.cycleSeconds - 1e-6);
    const stable = computeFrame(anim, t).stable;
    if (!stable && start === null) start = t;
    if (stable && start !== null) {
      ranges.push({ from: start, to: t });
      start = null;
    }
  }
  if (start !== null) ranges.push({ from: start, to: anim.cycleSeconds });
  return ranges;
}

function Slider({ def, value, onChange }: { def: JointDef; value: number; onChange: (v: number) => void }) {
  return (
    <label className="preview-slider">
      <span>
        {def.label}：<strong>{value.toFixed(1)}°</strong>
        <span className="muted">（{def.min}〜{def.max}）</span>
      </span>
      <input type="range" min={def.min} max={def.max} step={0.5} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function Preview() {
  const [anim, setAnim] = useState<AnimationData>(() => clone(ANIMATIONS[0]!));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [kfIndex, setKfIndex] = useState(0);
  const [showBalance, setShowBalance] = useState(true);
  const [showJoints, setShowJoints] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeRef = useRef(0);

  const seek = (t: number) => {
    timeRef.current = wrapTime(t, anim.cycleSeconds);
    setTime(timeRef.current);
  };

  // 再生の時計
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      timeRef.current = wrapTime(timeRef.current + ((now - last) / 1000) * speed, anim.cycleSeconds);
      last = now;
      setTime(timeRef.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, anim.cycleSeconds]);

  const frame = useMemo(() => computeFrame(anim, time), [anim, time]);
  const unstable = useMemo(() => findUnstable(anim), [anim]);
  const validation = useMemo(() => validateAnimation(JSON.parse(JSON.stringify(anim))), [anim]);
  const json = useMemo(() => JSON.stringify(anim, null, 2) + '\n', [anim]);
  const changed = useMemo(() => {
    const original = ANIMATIONS.find((a) => a.id === anim.id);
    return JSON.stringify(original) !== JSON.stringify(anim);
  }, [anim]);

  const kf = anim.keyframes[Math.min(kfIndex, anim.keyframes.length - 1)]!;
  const index = anim.keyframes.indexOf(kf);
  const hasFar = FAR_JOINTS.some((j) => kf.pose[j.name as FarJoint] !== undefined);

  const updateKeyframe = (patch: (k: Keyframe) => Keyframe) => {
    setAnim({ ...anim, keyframes: anim.keyframes.map((k, i) => (i === index ? patch(k) : k)) });
    setCopied(false);
  };

  const selectKeyframe = (i: number) => {
    setKfIndex(i);
    setPlaying(false);
    seek(anim.keyframes[i]!.t);
  };

  const selectAnimation = (id: string) => {
    const next = ANIMATIONS.find((a) => a.id === id);
    if (!next) return;
    setAnim(clone(next));
    setKfIndex(0);
    setPlaying(false);
    timeRef.current = 0;
    setTime(0);
    setCopied(false);
  };

  // 時刻は前後のキーフレームの間に収める
  const timeLimits = {
    min: index === 0 ? 0 : anim.keyframes[index - 1]!.t + MIN_GAP,
    max: (index === anim.keyframes.length - 1 ? anim.cycleSeconds : anim.keyframes[index + 1]!.t) - MIN_GAP,
  };
  const setKeyframeTime = (v: number) => {
    if (!Number.isFinite(v)) return;
    const t = Math.round(Math.min(timeLimits.max, Math.max(timeLimits.min, v)) * 100) / 100;
    updateKeyframe((k) => ({ ...k, t }));
    seek(t);
  };

  const nextTime = index === anim.keyframes.length - 1 ? anim.cycleSeconds : anim.keyframes[index + 1]!.t;
  const canDuplicate = nextTime - kf.t >= MIN_GAP * 4;
  const duplicate = () => {
    const t = Math.round(((kf.t + nextTime) / 2) * 100) / 100;
    const copy: Keyframe = { ...clone(anim).keyframes[index]!, t, label: `${kf.label ?? 'キーフレーム'}（複製）` };
    const keyframes = [...anim.keyframes.slice(0, index + 1), copy, ...anim.keyframes.slice(index + 1)];
    setAnim({ ...anim, keyframes });
    setKfIndex(index + 1);
    seek(t);
  };
  const remove = () => {
    if (anim.keyframes.length <= 2 || index === 0) return;
    setAnim({ ...anim, keyframes: anim.keyframes.filter((_, i) => i !== index) });
    setKfIndex(index - 1);
  };

  const toggleFar = (on: boolean) => {
    updateKeyframe((k) => {
      const pose = { ...k.pose };
      for (const j of FAR_JOINTS) {
        const name = j.name as FarJoint;
        if (on) pose[name] = pose[name] ?? pose[FAR_DEFAULT[name]];
        else delete pose[name];
      }
      return { ...k, pose };
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${anim.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="screen doctor preview">
      <h1>アニメのプレビュー（開発用）</h1>
      <p>
        <a href="#">アプリに戻る</a>
      </p>

      <label>
        アニメ
        <select value={anim.id} onChange={(e) => selectAnimation(e.target.value)}>
          {ANIMATIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.id}（1往復 {a.cycleSeconds}秒）
            </option>
          ))}
        </select>
      </label>

      <div className="preview-stage">
        <AnimationCanvas anim={anim} getTime={() => timeRef.current} label="アニメのプレビュー" showBalance={showBalance} showJoints={showJoints} />
      </div>

      <div className="preview-transport">
        <button type="button" className="btn btn-secondary" onClick={() => seek(time - FRAME_STEP)}>
          ◀ コマ
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setPlaying(!playing)}>
          {playing ? '止める' : '再生'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => seek(time + FRAME_STEP)}>
          コマ ▶
        </button>
      </div>
      <label>
        時刻：{time.toFixed(2)} 秒 ／ {anim.cycleSeconds} 秒
        <input
          type="range"
          min={0}
          max={anim.cycleSeconds - 0.01}
          step={0.01}
          value={time}
          onChange={(e) => {
            setPlaying(false);
            seek(Number(e.target.value));
          }}
        />
      </label>
      <div className="preview-options">
        <label>
          速さ
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>等倍</option>
            <option value={0.5}>1/2</option>
            <option value={0.25}>1/4</option>
          </select>
        </label>
        <label className="editor-check">
          <input type="checkbox" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} />
          重心と支えの範囲
        </label>
        <label className="editor-check">
          <input type="checkbox" checked={showJoints} onChange={(e) => setShowJoints(e.target.checked)} />
          関節の点
        </label>
      </div>

      <section className={`notice${frame.stable ? '' : ' notice-warn'}`} aria-live="off">
        <h2>{frame.stable ? 'このコマ：重心は支えの範囲の中' : 'このコマ：警告　重心が支えの範囲の外'}</h2>
        <p>
          重心の真下の点 x = {frame.com.x.toFixed(3)}（高さ {frame.com.y.toFixed(3)}）／支えの範囲 {frame.support.min.toFixed(3)} 〜 {frame.support.max.toFixed(3)}
          ／余裕 {Math.min(frame.com.x - frame.support.min, frame.support.max - frame.com.x).toFixed(3)}
        </p>
        <p className="muted">
          単位は「身長 = 1」。{frame.onSeat ? '座面を支えに数えています。' : '足だけで支えています。'}
          手の接触 {frame.hands.toFixed(2)}
        </p>
      </section>

      <section className={`notice${unstable.length === 0 && validation.ok ? '' : ' notice-warn'}`}>
        <h2>1往復の検査</h2>
        {unstable.length === 0 ? (
          <p>重心が支えの範囲の外に出るコマはありません。</p>
        ) : (
          <>
            <p>重心が支えの範囲の外に出る時間帯があります。</p>
            <ul>
              {unstable.map((r) => (
                <li key={r.from}>
                  <button type="button" className="text-link" onClick={() => seek(r.from)}>
                    {r.from.toFixed(2)} 〜 {r.to.toFixed(2)} 秒
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {validation.ok ? <p>データの検証（関節の可動域など）：問題なし</p> : <ul>{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      </section>

      <section className="editor-section">
        <h2>キーフレーム</h2>
        <div className="preview-keyframes">
          {anim.keyframes.map((k, i) => (
            <button key={i} type="button" className={`preview-kf${i === index ? ' is-selected' : ''}`} onClick={() => selectKeyframe(i)}>
              {k.t.toFixed(2)}
              <br />
              {k.label ?? `#${i + 1}`}
            </button>
          ))}
        </div>

        <div className="editor-fields">
          <label>
            時刻（秒）
            <input
              type="number"
              step={0.05}
              min={timeLimits.min}
              max={timeLimits.max}
              disabled={index === 0}
              value={kf.t}
              onChange={(e) => setKeyframeTime(Number(e.target.value))}
            />
          </label>
          <label>
            名前
            <input type="text" value={kf.label ?? ''} onChange={(e) => updateKeyframe((k) => ({ ...k, label: e.target.value }))} />
          </label>
        </div>
        <label className="editor-check">
          <input type="checkbox" checked={kf.onSeat === true} onChange={(e) => updateKeyframe((k) => ({ ...k, onSeat: e.target.checked }))} />
          お尻が座面についている
        </label>
        {anim.contacts && (
          <label className="preview-slider">
            <span>
              手の接触の強さ：<strong>{(kf.hands ?? 0).toFixed(2)}</strong>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={kf.hands ?? 0} onChange={(e) => updateKeyframe((k) => ({ ...k, hands: Number(e.target.value) }))} />
          </label>
        )}

        {NEAR_JOINTS.map((j) => (
          <Slider key={j.name} def={j} value={kf.pose[j.name] ?? 0} onChange={(v) => updateKeyframe((k) => ({ ...k, pose: { ...k.pose, [j.name]: v } }))} />
        ))}
        <label className="editor-check">
          <input type="checkbox" checked={hasFar} onChange={(e) => toggleFar(e.target.checked)} />
          奥側の手足を別の角度にする
        </label>
        {hasFar &&
          FAR_JOINTS.map((j) => (
            <Slider
              key={j.name}
              def={j}
              value={kf.pose[j.name as FarJoint] ?? 0}
              onChange={(v) => updateKeyframe((k) => ({ ...k, pose: { ...k.pose, [j.name]: v } }))}
            />
          ))}

        <div className="preview-transport">
          <button type="button" className="btn btn-secondary" disabled={!canDuplicate} onClick={duplicate}>
            複製して後ろに足す
          </button>
          <button type="button" className="btn btn-secondary" disabled={anim.keyframes.length <= 2 || index === 0} onClick={remove}>
            削除
          </button>
        </div>
      </section>

      <section className="editor-section">
        <h2>JSON の書き出し</h2>
        <p className="muted">
          書き出した内容で <code>src/data/animations/{anim.id}.json</code> を置き換えてビルドすると、アプリに反映されます。
          {changed ? '（変更あり）' : '（同梱のデータと同じ）'}
        </p>
        <div className="preview-transport">
          <button type="button" className="btn btn-primary" onClick={copy}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={download}>
            ファイルに保存
          </button>
          <button type="button" className="btn btn-secondary" disabled={!changed} onClick={() => selectAnimation(anim.id)}>
            元に戻す
          </button>
        </div>
        <textarea className="preview-json" readOnly value={json} rows={12} aria-label="書き出す JSON" />
      </section>
    </main>
  );
}
