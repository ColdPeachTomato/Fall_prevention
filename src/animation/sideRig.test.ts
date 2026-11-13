import { describe, expect, it } from 'vitest';
import { BODY, MASS } from './bodyModel';
import { fullPose } from './interpolate';
import { centerOfMass, solveArm, solveSide, supportRange } from './sideRig';
import type { ChairProp, Pose } from './types';

const standing: Pose = { ankle: 0, knee: 0, hip: 0, spine: 0, neck: 0, shoulder: 0, elbow: 0 };
const sitting: Pose = { ankle: 0, knee: 90, hip: 90, spine: 0, neck: 0, shoulder: 0, elbow: 0 };

describe('質量比', () => {
  it('全身の合計が 1 になる', () => {
    const paired = MASS.upperArm.mass + MASS.forearmHand.mass + MASS.thigh.mass + MASS.shank.mass + MASS.foot.mass;
    expect(MASS.head.mass + MASS.trunk.mass + MASS.pelvis.mass + 2 * paired).toBeCloseTo(1, 6);
  });
});

describe('solveSide', () => {
  it('まっすぐ立つと、各点が足首の真上に並び、高さが身長の割合どおりになる', () => {
    const sk = solveSide(fullPose(standing), 0.1);
    for (const p of [sk.knee, sk.hip, sk.lumbar, sk.shoulder, sk.neckBase, sk.head]) expect(p.x).toBeCloseTo(0.1, 9);
    expect(sk.knee.y).toBeCloseTo(0.285, 3); // 膝の高さ
    expect(sk.hip.y).toBeCloseTo(0.53, 3); // 股関節の高さ
    expect(sk.shoulder.y).toBeCloseTo(0.818, 2); // 肩の高さ
    expect(sk.head.y + 0.07).toBeCloseTo(1.0, 1); // 頭のてっぺん
    expect(sk.wrist.y).toBeCloseTo(sk.shoulder.y - BODY.upperArm - BODY.forearm, 9); // 腕は真下に下がる
  });

  it('床についた足は、姿勢が変わっても動かない', () => {
    const a = solveSide(fullPose(standing), 0);
    const b = solveSide(fullPose({ ...sitting, ankle: 15, spine: 20 }), 0);
    expect(b.ankle).toEqual(a.ankle);
    expect(b.heel).toEqual(a.heel);
    expect(b.toe).toEqual(a.toe);
    expect(a.heel.y).toBeCloseTo(0, 9);
    expect(a.toe.y).toBeCloseTo(0, 9);
  });

  it('奥の脚が同じ角度なら、奥の足も同じ位置で床につく', () => {
    const sk = solveSide(fullPose({ ...sitting, ankle: 12, knee: 70, hip: 60 }), 0);
    expect(sk.farAnkle.x).toBeCloseTo(sk.ankle.x, 9);
    expect(sk.farAnkle.y).toBeCloseTo(sk.ankle.y, 9);
    expect(sk.farFootAngle).toBeCloseTo(90, 9);
  });

  it('椅子に座った姿勢では、太ももが水平、体がまっすぐになる', () => {
    const sk = solveSide(fullPose(sitting), 0);
    expect(sk.hip.y).toBeCloseTo(sk.knee.y, 9);
    expect(sk.hip.x).toBeCloseTo(-BODY.thigh, 9);
    expect(sk.head.x).toBeCloseTo(sk.hip.x, 9);
  });

  it('関節を曲げると、決めた向きに動く', () => {
    const base = solveSide(fullPose(standing), 0);
    expect(solveSide(fullPose({ ...standing, spine: 30 }), 0).head.x).toBeGreaterThan(base.head.x); // 前かがみ
    expect(solveSide(fullPose({ ...standing, shoulder: 90 }), 0).wrist.x).toBeGreaterThan(base.wrist.x + 0.3); // 腕を前へ
    expect(solveSide(fullPose({ ...standing, farHip: 60 }), 0).farKnee.x).toBeGreaterThan(base.farKnee.x + 0.2); // 膝上げ
    const bent = solveSide(fullPose({ ...standing, farKnee: 90 }), 0);
    expect(bent.farAnkle.x).toBeLessThan(base.farAnkle.x - 0.2); // 膝を曲げると足は後ろへ
  });
});

describe('手の接触（腕の2関節を合わせる）', () => {
  it('届く位置なら、手のひらが目標にぴったり付く', () => {
    const pose = fullPose({ ...sitting, ankle: 15, knee: 100, hip: 85 });
    const contact = { on: 'thigh' as const, along: 0.7, offset: 0.055 };
    const sk = solveSide(pose, 0, { near: contact, far: contact }, 1);
    expect(sk.handTarget).toBeDefined();
    expect(Math.hypot(sk.hand.x - sk.handTarget!.x, sk.hand.y - sk.handTarget!.y)).toBeLessThan(1e-6);
    expect(Math.hypot(sk.farHand.x - sk.farHandTarget!.x, sk.farHand.y - sk.farHandTarget!.y)).toBeLessThan(1e-6);
    expect(sk.arm.elbow).toBeGreaterThan(0); // 肘は曲がる方向にだけ曲がる
  });

  it('接触の強さ 0 なら、キーフレームの角度のまま', () => {
    const pose = fullPose({ ...sitting, shoulder: 10, elbow: 20 });
    const sk = solveSide(pose, 0, { near: { on: 'thigh', along: 0.7, offset: 0.055 } }, 0);
    expect(sk.arm.shoulder).toBe(10);
    expect(sk.arm.elbow).toBe(20);
  });

  it('solveArm：真下の届く限界では、腕がまっすぐ下がる', () => {
    const reach = BODY.upperArm + BODY.forearm + BODY.palm;
    const r = solveArm({ x: 0, y: 1 }, { x: 0, y: 1 - reach }, 0);
    expect(r.shoulder).toBeCloseTo(0, 0);
    expect(r.elbow).toBeCloseTo(0, 0);
  });
});

describe('重心と支えの範囲', () => {
  const chair: ChairProp = { type: 'chair', x: -0.4, seatHeight: 0.24, seatDepth: 0.3, backHeight: 0.5 };

  it('まっすぐ立つと、重心は足の上、高さは身長の 55〜60% になる', () => {
    const sk = solveSide(fullPose(standing), 0);
    const com = centerOfMass(sk);
    const range = supportRange(sk, false, []);
    expect(com.y).toBeGreaterThan(0.55);
    expect(com.y).toBeLessThan(0.6);
    expect(com.x).toBeGreaterThan(range.min);
    expect(com.x).toBeLessThan(range.max);
  });

  it('支えの範囲は、床についた足のかかとからつま先まで', () => {
    const sk = solveSide(fullPose(standing), 0);
    const range = supportRange(sk, false, []);
    expect(range.min).toBeCloseTo(-BODY.heelBack, 9);
    expect(range.max).toBeCloseTo(BODY.toeFront, 9);
  });

  it('座っている間は、座面も支えに数える', () => {
    const sk = solveSide(fullPose(sitting), 0);
    const com = centerOfMass(sk);
    expect(com.x).toBeLessThan(supportRange(sk, false, [chair]).min); // 足だけでは支えられない
    const seated = supportRange(sk, true, [chair]);
    expect(com.x).toBeGreaterThan(seated.min);
    expect(com.x).toBeLessThan(seated.max);
  });

  it('上げた足は支えに数えない', () => {
    const sk = solveSide(fullPose({ ...standing, farHip: 40, farKnee: 60 }), 0);
    const range = supportRange(sk, false, []);
    expect(range.max).toBeCloseTo(BODY.toeFront, 9);
  });

  it('前かがみになると重心は前へ動く', () => {
    const a = centerOfMass(solveSide(fullPose(sitting), 0));
    const b = centerOfMass(solveSide(fullPose({ ...sitting, hip: 110, spine: 20 }), 0));
    expect(b.x).toBeGreaterThan(a.x + 0.03);
  });
});
