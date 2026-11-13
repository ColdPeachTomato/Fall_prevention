// 同梱するすべてのアニメを、付録「アニメ確認チェックリスト」のうち計算で確かめられる項目で検査する。
// 新しいアニメを足すと、自動でこの検査の対象になる。

import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import { ALL_JOINTS } from './bodyModel';
import { ANIMATIONS, getAnimation } from './registry';
import { computeFrame } from './sideRig';
import { validateAnimation } from './validate';

const STEP = 0.02; // 検査する時刻の間隔（秒）

function times(cycle: number): number[] {
  return Array.from({ length: Math.round(cycle / STEP) + 1 }, (_, i) => Math.min(cycle, i * STEP));
}

describe('アニメの登録', () => {
  it('運動データの animationId は、すべて登録済みのアニメを指す', () => {
    for (const anim of ANIMATIONS) {
      const ex = getExercise(anim.exercise);
      const variant = ex.variants.find((v) => v.level === anim.level);
      expect(variant?.animationId).toBe(anim.id);
      expect(variant?.view).toBe(anim.view);
    }
  });

  it('S1 のレベル1・2に横向きのアニメがある', () => {
    expect(getAnimation('S1-side-L1')).toBeDefined();
    expect(getAnimation('S1-side-L2')).toBeDefined();
  });

  it('書き出した JSON を読み直しても、同じデータとして検証に通る', () => {
    for (const anim of ANIMATIONS) {
      const r = validateAnimation(JSON.parse(JSON.stringify(anim)));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.anim).toEqual(anim);
    }
  });
});

describe.each(ANIMATIONS.map((a) => [a.id, a] as const))('%s', (_id, anim) => {
  const frames = times(anim.cycleSeconds).map((t) => computeFrame(anim, t));

  it('B：重心が常に支える面（足と座面）の上にある', () => {
    for (const f of frames) {
      expect(f.com.x, `t=${f.t.toFixed(2)}`).toBeGreaterThanOrEqual(f.support.min);
      expect(f.com.x, `t=${f.t.toFixed(2)}`).toBeLessThanOrEqual(f.support.max);
    }
  });

  it('B：支えている足が滑らず、浮かない', () => {
    const first = frames[0]!;
    for (const f of frames) {
      expect(f.sk.ankle).toEqual(first.sk.ankle);
      expect(f.sk.heel.y).toBeCloseTo(0, 9);
      expect(f.sk.toe.y).toBeCloseTo(0, 9);
      // 奥の足も床についたまま動かない（両足で行う種目）
      expect(f.sk.farAnkle.x).toBeCloseTo(first.sk.farAnkle.x, 6);
      expect(f.sk.farAnkle.y).toBeCloseTo(first.sk.farAnkle.y, 6);
    }
  });

  it('B：関節が可動域を超えない', () => {
    for (const f of frames) {
      for (const j of ALL_JOINTS) {
        expect(f.pose[j.name], `${j.name} t=${f.t.toFixed(2)}`).toBeGreaterThanOrEqual(j.min - 1e-9);
        expect(f.pose[j.name], `${j.name} t=${f.t.toFixed(2)}`).toBeLessThanOrEqual(j.max + 1e-9);
      }
      // 手の接触を反映した後の腕も確かめる
      expect(f.sk.arm.elbow).toBeGreaterThanOrEqual(-5);
      expect(f.sk.arm.elbow).toBeLessThanOrEqual(145);
      expect(f.sk.arm.shoulder).toBeGreaterThanOrEqual(-50);
    }
  });

  it('B：手を付く表現では、手が実際に触れている', () => {
    for (const f of frames) {
      if (f.hands < 0.999 || !f.sk.handTarget) continue;
      const gap = Math.hypot(f.sk.hand.x - f.sk.handTarget.x, f.sk.hand.y - f.sk.handTarget.y);
      expect(gap, `t=${f.t.toFixed(2)}`).toBeLessThan(0.005);
    }
  });

  it('A：座っている間は、お尻が座面の高さにある', () => {
    const chair = anim.props.find((p) => p.type === 'chair');
    if (!chair) return;
    for (const f of frames) {
      if (!f.onSeat) continue;
      expect(f.sk.hip.y - chair.seatHeight, `t=${f.t.toFixed(2)}`).toBeGreaterThan(0.04);
      expect(f.sk.hip.y - chair.seatHeight, `t=${f.t.toFixed(2)}`).toBeLessThan(0.07);
      expect(f.sk.hip.x).toBeGreaterThan(chair.x);
      expect(f.sk.hip.x).toBeLessThan(chair.x + chair.seatDepth);
    }
  });

  it('A：反動がなく、ゆっくり動く（体の各点の速さと、速さの変化に上限がある）', () => {
    // 速さの上限：1秒に身長の 42%（身長160cmで約67cm/秒）。速さの変化：1コマで急に変わらない
    let prevSpeed = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]!.sk;
      const b = frames[i]!.sk;
      const speed = Math.max(
        ...([
          [a.head, b.head],
          [a.hip, b.hip],
          [a.knee, b.knee],
          [a.hand, b.hand],
        ] as const).map(([p, q]) => Math.hypot(q.x - p.x, q.y - p.y) / STEP),
      );
      expect(speed, `t=${frames[i]!.t.toFixed(2)}`).toBeLessThan(0.42);
      expect(Math.abs(speed - prevSpeed), `t=${frames[i]!.t.toFixed(2)}`).toBeLessThan(0.05);
      prevSpeed = speed;
    }
  });

  it('A：1往復の終わりが最初の姿勢に戻る（回数のカウントと合う）', () => {
    const start = frames[0]!;
    const end = frames[frames.length - 1]!;
    for (const j of ALL_JOINTS) expect(end.pose[j.name]).toBeCloseTo(start.pose[j.name], 6);
  });

  it('A：上げ下げがそれぞれ 2〜3 秒', () => {
    // 股関節が上がり続ける時間と、下がり続ける時間を測る（前かがみの時間を含む動きの長さは字幕で示す）
    const moving = frames.filter((f, i) => i > 0 && Math.abs(f.sk.head.y - frames[i - 1]!.sk.head.y) > 1e-5);
    const peak = Math.max(...frames.map((f) => f.sk.head.y));
    const peakIndex = frames.findIndex((f) => f.sk.head.y > peak - 1e-6);
    const upSeconds = moving.filter((f) => f.t <= frames[peakIndex]!.t).length * STEP;
    const downSeconds = moving.filter((f) => f.t > frames[peakIndex]!.t).length * STEP;
    expect(upSeconds).toBeGreaterThanOrEqual(2);
    expect(upSeconds).toBeLessThanOrEqual(3.01);
    expect(downSeconds).toBeGreaterThanOrEqual(2);
    expect(downSeconds).toBeLessThanOrEqual(3.01);
  });

  it('C：支持物（椅子）が常に画面内にある', async () => {
    const { VIEW } = await import('./draw');
    for (const p of anim.props) {
      expect(p.x - 0.02).toBeGreaterThan(VIEW.minX);
      expect(p.x + p.seatDepth).toBeLessThan(VIEW.maxX);
      expect(p.backHeight).toBeLessThan(VIEW.maxY);
    }
  });

  it('E：人物の全身と足元が画面からはみ出さない', async () => {
    const { VIEW } = await import('./draw');
    for (const f of frames) {
      const sk = f.sk;
      const xs = [sk.head.x + 0.075, sk.head.x - 0.075, sk.toe.x, sk.heel.x, sk.elbow.x - 0.035, sk.hand.x + 0.03, sk.hip.x - 0.07];
      expect(Math.max(...xs), `t=${f.t.toFixed(2)}`).toBeLessThan(VIEW.maxX);
      expect(Math.min(...xs), `t=${f.t.toFixed(2)}`).toBeGreaterThan(VIEW.minX);
      expect(sk.head.y + 0.075).toBeLessThan(VIEW.maxY);
      expect(VIEW.minY).toBeLessThan(0);
    }
  });

  it('D：字幕が1往復のすべての時間をすき間なく覆う', () => {
    const sorted = [...anim.captions].sort((a, b) => a.from - b.from);
    expect(sorted[0]?.from).toBe(0);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.from).toBeCloseTo(sorted[i - 1]!.to, 9);
    expect(sorted[sorted.length - 1]?.to).toBe(anim.cycleSeconds);
  });
});

describe('S1 椅子からの立ち座り（仕様との照合）', () => {
  const l1 = getAnimation('S1-side-L1')!;
  const l2 = getAnimation('S1-side-L2')!;

  it.each([l1, l2])('$id：開始姿勢は足を少し引いて座る（足首が膝より後ろ）', (anim) => {
    const f = computeFrame(anim, 0);
    expect(f.onSeat).toBe(true);
    expect(f.sk.ankle.x).toBeLessThan(f.sk.knee.x - 0.05);
    expect(f.pose.spine).toBe(0); // 背筋を伸ばす
  });

  it.each([l1, l2])('$id：お尻が離れる前に前かがみになる', (anim) => {
    const frames = times(anim.cycleSeconds).map((t) => computeFrame(anim, t));
    const liftOff = frames.findIndex((f) => !f.onSeat);
    const before = frames[liftOff - 1]!;
    expect(before.sk.shoulder.x).toBeGreaterThan(before.sk.hip.x + 0.15); // 肩が股関節より前
    expect(before.sk.head.x).toBeGreaterThan(before.sk.knee.x - 0.02); // 頭が膝の上あたりまで出る
  });

  it.each([l1, l2])('$id：立ったときは体がまっすぐ伸びる', (anim) => {
    const frames = times(anim.cycleSeconds).map((t) => computeFrame(anim, t));
    const top = frames.reduce((a, b) => (b.sk.head.y > a.sk.head.y ? b : a));
    expect(top.pose.knee).toBeLessThan(6);
    expect(Math.abs(top.sk.head.x - top.sk.ankle.x)).toBeLessThan(0.04);
  });

  it('レベル1は手を太ももに付いて立ち、立ったら手を離す', () => {
    expect(l1.contacts?.near).toBeDefined();
    expect(computeFrame(l1, 0).hands).toBeCloseTo(1, 6);
    const frames = times(l1.cycleSeconds).map((t) => computeFrame(l1, t));
    const top = frames.reduce((a, b) => (b.sk.head.y > a.sk.head.y ? b : a));
    expect(top.hands).toBeLessThan(0.01);
  });

  it('レベル2は手を使わない（腕は体の横に下ろしたまま。ふらついたらすぐつかまれる）', () => {
    expect(l2.contacts).toBeUndefined();
    const frames = times(l2.cycleSeconds).map((t) => computeFrame(l2, t));
    for (const f of frames) {
      expect(f.hands).toBe(0);
      // 腕はほぼ真下に下がり、肘はほぼ伸びている
      const fromDown = (Math.atan2(f.sk.hand.x - f.sk.shoulder.x, f.sk.shoulder.y - f.sk.hand.y) * 180) / Math.PI;
      expect(Math.abs(fromDown), `t=${f.t.toFixed(2)}`).toBeLessThan(15);
      expect(f.sk.arm.elbow, `t=${f.t.toFixed(2)}`).toBeLessThan(20);
    }
    // 座っているときと立ったときは、手が体の横（股関節のあたり）にある
    for (const t of [0, 3.5]) {
      const f = computeFrame(l2, t);
      expect(Math.abs(f.sk.hand.x - f.sk.hip.x)).toBeLessThan(0.08);
    }
  });

  it('レベル1と2で、下半身の動きは同じ', () => {
    for (const t of [0, 1, 1.4, 2, 3, 4, 5, 6]) {
      const a = computeFrame(l1, t);
      const b = computeFrame(l2, t);
      expect(a.sk.hip.x).toBeCloseTo(b.sk.hip.x, 9);
      expect(a.sk.hip.y).toBeCloseTo(b.sk.hip.y, 9);
      expect(a.sk.knee.x).toBeCloseTo(b.sk.knee.x, 9);
    }
  });
});
