import { describe, expect, it } from 'vitest';
import { buildCurve, evalCurve, fullPose, sampleAnimation, wrapTime } from './interpolate';
import type { AnimationData, Pose } from './types';

const pose = (knee: number): Pose => ({ ankle: 0, knee, hip: 0, spine: 0, neck: 0, shoulder: 0, elbow: 0 });

describe('wrapTime', () => {
  it('1往復の時間で折り返す', () => {
    expect(wrapTime(7.5, 7)).toBeCloseTo(0.5);
    expect(wrapTime(-1, 7)).toBeCloseTo(6);
    expect(wrapTime(14, 7)).toBeCloseTo(0);
  });
});

describe('補間（buildCurve / evalCurve）', () => {
  // 0 で止まる → 上がる → 100 で止まる → 下がる
  const times = [0, 1, 2, 3, 4, 5];
  const values = [0, 0, 60, 100, 100, 40];
  const period = 6;
  const curve = buildCurve(times, values, period);

  it('キーフレームの値を通る', () => {
    times.forEach((t, i) => expect(evalCurve(curve, t)).toBeCloseTo(values[i]!, 9));
  });

  it('1往復の終わりで最初の値に戻り、つなぎ目が連続する', () => {
    expect(evalCurve(curve, period)).toBeCloseTo(values[0]!, 9);
    expect(evalCurve(curve, period - 1e-6)).toBeCloseTo(evalCurve(curve, 1e-6), 3);
    expect(evalCurve(curve, period + 2.5)).toBeCloseTo(evalCurve(curve, 2.5), 9);
  });

  it('隣り合うキーフレームの範囲からはみ出さない（反動がつかない）', () => {
    for (let i = 0; i < times.length; i++) {
      const t0 = times[i]!;
      const t1 = i + 1 < times.length ? times[i + 1]! : period;
      const v0 = values[i]!;
      const v1 = values[(i + 1) % values.length]!;
      const lo = Math.min(v0, v1) - 1e-9;
      const hi = Math.max(v0, v1) + 1e-9;
      for (let k = 0; k <= 50; k++) {
        const v = evalCurve(curve, t0 + ((t1 - t0) * k) / 50);
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('上がる区間では戻らない（単調）', () => {
    let prev = evalCurve(curve, 1);
    for (let t = 1.01; t <= 3; t += 0.01) {
      const v = evalCurve(curve, t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('止まる所では速さが 0 になる（ゆっくり始まり、ゆっくり止まる）', () => {
    const speed = (t: number) => (evalCurve(curve, t + 1e-4) - evalCurve(curve, t - 1e-4)) / 2e-4;
    expect(Math.abs(speed(1))).toBeLessThan(0.05); // 動き始め
    expect(Math.abs(speed(3))).toBeLessThan(0.05); // 止まる所
    expect(evalCurve(curve, 0.5)).toBeCloseTo(0, 9); // 止まっている間は動かない
    expect(evalCurve(curve, 3.5)).toBeCloseTo(100, 9);
  });

  it('途中のキーフレームでは止まらない', () => {
    const speed = (evalCurve(curve, 2 + 1e-4) - evalCurve(curve, 2 - 1e-4)) / 2e-4;
    expect(speed).toBeGreaterThan(20);
  });

  it('キーフレームが2つなら、ゆっくり始まりゆっくり止まる往復になる', () => {
    const c = buildCurve([0, 2], [0, 10], 4);
    expect(evalCurve(c, 1)).toBeCloseTo(5, 9);
    expect(evalCurve(c, 0.2)).toBeLessThan(1); // 直線なら 1
    expect(evalCurve(c, 3)).toBeCloseTo(5, 9);
  });

  it('時刻が昇順でないとエラーにする', () => {
    expect(() => buildCurve([0, 2, 1], [0, 1, 2], 4)).toThrow();
    expect(() => buildCurve([0, 5], [0, 1], 4)).toThrow();
  });
});

describe('fullPose', () => {
  it('奥側を省略すると手前側と同じになる', () => {
    const p = fullPose({ ...pose(30), shoulder: 20, farShoulder: 50 });
    expect(p.farKnee).toBe(30);
    expect(p.farShoulder).toBe(50);
    expect(p.farElbow).toBe(0);
  });
});

describe('sampleAnimation', () => {
  const anim: AnimationData = {
    id: 'test',
    exercise: 'S1',
    level: 1,
    view: 'side',
    cycleSeconds: 4,
    root: { x: 0 },
    props: [],
    highlight: [],
    keyframes: [
      { t: 0, pose: pose(90), onSeat: true, hands: 1 },
      { t: 1, pose: pose(90), onSeat: true, hands: 1 },
      { t: 2, pose: pose(0), hands: 0 },
      { t: 3, pose: pose(0), hands: 0 },
    ],
    captions: [],
    marks: [],
  };

  it('座面は、前後のキーフレームが両方ついている間だけ数える', () => {
    expect(sampleAnimation(anim, 0.5).onSeat).toBe(true);
    expect(sampleAnimation(anim, 1).onSeat).toBe(true); // 離れる瞬間のキーフレームはまだついている
    expect(sampleAnimation(anim, 1.01).onSeat).toBe(false);
    expect(sampleAnimation(anim, 2.5).onSeat).toBe(false);
    expect(sampleAnimation(anim, 3.5).onSeat).toBe(false); // 座る途中
  });

  it('手の接触の強さは 0〜1 の間でなめらかに変わる', () => {
    const h = sampleAnimation(anim, 1.5).hands;
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(1);
    expect(sampleAnimation(anim, 0.5).hands).toBeCloseTo(1, 9);
  });

  it('姿勢を補間する', () => {
    expect(sampleAnimation(anim, 1.5).pose.knee).toBeCloseTo(45, 6);
    expect(sampleAnimation(anim, 1.5).pose.farKnee).toBeCloseTo(45, 6);
  });
});
