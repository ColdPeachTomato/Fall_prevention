// アニメのプレビュー画面（開発用）。本番の画面からは入れない。URL の末尾に #preview を付けて開く。
// アニメの一覧、コマ送り、各関節の角度のスライダー、重心と支えの範囲の表示、JSON の書き出しを備える。

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimationCanvas } from '../animation/AnimationCanvas';
import { FAR_DEFAULT, FAR_JOINTS, FOOT_PITCH, FRONT_BODY_CHANNELS, FRONT_LEFT_CHANNELS, FRONT_RIGHT_CHANNELS, NEAR_JOINTS } from '../animation/bodyModel';
import { wrapTime } from '../animation/interpolate';
import { ANIMATIONS } from '../animation/registry';
import { frameOf } from '../animation/scene';
import type { AnimationData, SupportStage } from '../animation/types';
import { getExercise } from '../data/exercises';
import { validateAnimation } from '../animation/validate';

const FRAME_STEP = 0.1; // コマ送りの幅（秒）
const SCAN_STEP = 0.05; // 警告を探す間隔（秒）
const MIN_GAP = 0.05; // キーフレームどうしの最小の間隔（秒）

// 視点によらず同じ画面で編集できるよう、キーフレームと値の定義をゆるい形で扱う
interface EditKeyframe {
  t: number;
  pose: Record<string, number | undefined>;
  onSeat?: boolean;
  hands?: number;
  label?: string;
}
interface SliderDef {
  name: string;
  label: string;
  min: number;
  max: number;
  unit?: string;
}

const VIEW_LABEL = { side: '横向き', front: '正面', back: '後ろ向き' } as const;

function clone(anim: AnimationData): AnimationData {
  return JSON.parse(JSON.stringify(anim)) as AnimationData;
}

// 重心が支えの範囲の外に出る時間帯を探す
function findUnstable(anim: AnimationData, stage: SupportStage | null): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  let start: number | null = null;
  const count = Math.round(anim.cycleSeconds / SCAN_STEP);
  for (let i = 0; i <= count; i++) {
    const t = Math.min(i * SCAN_STEP, anim.cycleSeconds - 1e-6);
    const stable = frameOf(anim, t, stage).stable;
    if (!stable && start === null) start = t;
    if (stable && start !== null) {
      ranges.push({ from: start, to: t });
      start = null;
    }
  }
  if (start !== null) ranges.push({ from: start, to: anim.cycleSeconds });
  return ranges;
}

function Slider({ def, value, onChange }: { def: SliderDef; value: number; onChange: (v: number) => void }) {
  const degrees = def.unit !== '';
  return (
    <label className="preview-slider">
      <span>
        {def.label}：<strong>{degrees ? `${value.toFixed(1)}°` : value.toFixed(2)}</strong>
        <span className="muted">（{def.min}〜{def.max}）</span>
      </span>
      <input type="range" min={def.min} max={def.max} step={degrees ? 0.5 : 0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
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
  const [mirror, setMirror] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [chosenStage, setStage] = useState<SupportStage>('both');
  // その種目で使える支えの段階（多い順）。種目の下限（S3 立位は両手）と上限（カウンターの横は片手まで）の間だけ。
  // アプリでは、この範囲の段階でしか見本を出さない
  const allowedStages = useMemo(() => {
    const all: SupportStage[] = ['both', 'one', 'fingertip', 'none'];
    const ex = getExercise(anim.exercise);
    const max = ex.variants.find((v) => v.animationId === anim.id)?.maxSupport ?? 'both';
    return all.slice(all.indexOf(max), all.indexOf(ex.minSupport ?? 'none') + 1);
  }, [anim.exercise, anim.id]);
  const stage = allowedStages.includes(chosenStage) ? chosenStage : allowedStages[0]!;
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

  const frame = useMemo(() => frameOf(anim, time, anim.support ? stage : null), [anim, time, stage]);
  const unstable = useMemo(() => findUnstable(anim, anim.support ? stage : null), [anim, stage]);
  const validation = useMemo(() => validateAnimation(JSON.parse(JSON.stringify(anim))), [anim]);
  const json = useMemo(() => JSON.stringify(anim, null, 2) + '\n', [anim]);
  const changed = useMemo(() => {
    const original = ANIMATIONS.find((a) => a.id === anim.id);
    return JSON.stringify(original) !== JSON.stringify(anim);
  }, [anim]);

  const side = anim.view === 'side';
  const keyframes = anim.keyframes as EditKeyframe[];
  const setKeyframes = (next: EditKeyframe[]) => setAnim({ ...anim, keyframes: next } as AnimationData);
  const index = Math.min(kfIndex, keyframes.length - 1);
  const kf = keyframes[index]!;
  // 必ず出す値と、切り替えて出す値（横向き：奥側、正面・後ろ向き：左側）
  const mainDefs: SliderDef[] = side ? NEAR_JOINTS : [...FRONT_BODY_CHANNELS, ...FRONT_RIGHT_CHANNELS];
  const otherDefs: SliderDef[] = side ? FAR_JOINTS : FRONT_LEFT_CHANNELS;
  const hasOther = otherDefs.some((j) => kf.pose[j.name] !== undefined);
  // 省略した値の扱い（横向き：奥側は手前側と同じ。正面・後ろ向き：左側は右側と同じ、ほかは決まった値）
  const mirrorOf = (name: string): string => (side ? FAR_DEFAULT[name as keyof typeof FAR_DEFAULT] : `r${name.slice(1)}`);
  const fallbackOf = (name: string): number => {
    if (side) return 0;
    return [...FRONT_BODY_CHANNELS, ...FRONT_RIGHT_CHANNELS, ...FRONT_LEFT_CHANNELS].find((c) => c.name === name)?.fallback ?? 0;
  };
  const valueOf = (name: string): number => kf.pose[name] ?? fallbackOf(name);

  const updateKeyframe = (patch: (k: EditKeyframe) => EditKeyframe) => {
    setKeyframes(keyframes.map((k, i) => (i === index ? patch(k) : k)));
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
    setReverse(false);
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
    const copy: EditKeyframe = { ...(clone(anim).keyframes as EditKeyframe[])[index]!, t, label: `${kf.label ?? 'キーフレーム'}（複製）` };
    setKeyframes([...keyframes.slice(0, index + 1), copy, ...keyframes.slice(index + 1)]);
    setKfIndex(index + 1);
    seek(t);
  };
  const remove = () => {
    if (anim.keyframes.length <= 2 || index === 0) return;
    setKeyframes(keyframes.filter((_, i) => i !== index));
    setKfIndex(index - 1);
  };

  const toggleOther = (on: boolean) => {
    updateKeyframe((k) => {
      const pose = { ...k.pose };
      for (const j of otherDefs) {
        if (on) pose[j.name] = pose[j.name] ?? pose[mirrorOf(j.name)] ?? fallbackOf(j.name);
        else delete pose[j.name];
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
              {a.id}（{VIEW_LABEL[a.view]}、1往復 {a.cycleSeconds}秒、{a.checked ? '確認済み' : '未確認'}）
            </option>
          ))}
        </select>
      </label>

      <div className="preview-stage">
        <AnimationCanvas anim={anim} getTime={() => timeRef.current} label="アニメのプレビュー" showBalance={showBalance} showJoints={showJoints} mirror={mirror} reverse={reverse} support={anim.support ? stage : null} />
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
        <label className="editor-check">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
          左右反転（左側）
        </label>
        {anim.support && (
          <label>
            支えの段階
            <select value={stage} onChange={(e) => setStage(e.target.value as SupportStage)}>
              {allowedStages.map((s) => (
                <option key={s} value={s}>
                  {{ both: '両手', one: '片手', fingertip: '指先', none: 'なし' }[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        {anim.reverseCaptions && (
          <label className="editor-check">
            <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
            逆向きに再生（2つ目の向き）
          </label>
        )}
      </div>

      <section className={`notice${frame.stable ? '' : ' notice-warn'}`} aria-live="off">
        <h2>{frame.stable ? 'このコマ：重心は支えの範囲の中' : 'このコマ：警告　重心が支えの範囲の外'}</h2>
        <p>
          重心の真下の点 x = {frame.com.x.toFixed(3)}（高さ {frame.com.y.toFixed(3)}）／支えの範囲 {frame.support.min.toFixed(3)} 〜 {frame.support.max.toFixed(3)}
          ／余裕 {Math.min(frame.com.x - frame.support.min, frame.support.max - frame.com.x).toFixed(3)}
        </p>
        <p className="muted">
          単位は「身長 = 1」。{side ? '前後方向' : '左右方向'}の範囲です。{frame.onSeat ? '座面を支えに数えています。' : '足だけで支えています。'}
          {'hands' in frame && ` 手の接触 ${frame.hands.toFixed(2)}`}
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
          {keyframes.map((k, i) => (
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
        {anim.view === 'side' && anim.contacts && (
          <label className="preview-slider">
            <span>
              手の接触の強さ：<strong>{(kf.hands ?? 0).toFixed(2)}</strong>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={kf.hands ?? 0} onChange={(e) => updateKeyframe((k) => ({ ...k, hands: Number(e.target.value) }))} />
          </label>
        )}

        {!side && (
          <p className="muted">
            手足は「見かけの向き」で表します（節の長さを 1 とした割合）。外へ・上への2つを合わせた長さが 1 より短い分は、手前か奥を向いて短く見えています。
          </p>
        )}
        {mainDefs.map((j) => (
          <Slider key={j.name} def={j} value={valueOf(j.name)} onChange={(v) => updateKeyframe((k) => ({ ...k, pose: { ...k.pose, [j.name]: v } }))} />
        ))}
        {anim.view === 'side' && anim.plants && (
          <>
            <p className="muted">足を床に付ける指定がある脚は、足の傾きから股関節・膝・足首の角度が自動で決まります。</p>
            <Slider def={FOOT_PITCH} value={kf.pose.footPitch ?? 0} onChange={(v) => updateKeyframe((k) => ({ ...k, pose: { ...k.pose, footPitch: v } }))} />
          </>
        )}
        <label className="editor-check">
          <input type="checkbox" checked={hasOther} onChange={(e) => toggleOther(e.target.checked)} />
          {side ? '奥側の手足を別の角度にする' : '左側の手足を、右側と別の値にする'}
        </label>
        {hasOther &&
          otherDefs.map((j) => (
            <Slider key={j.name} def={j} value={kf.pose[j.name] ?? kf.pose[mirrorOf(j.name)] ?? fallbackOf(j.name)} onChange={(v) => updateKeyframe((k) => ({ ...k, pose: { ...k.pose, [j.name]: v } }))} />
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
