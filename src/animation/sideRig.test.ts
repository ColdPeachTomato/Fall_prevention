import { describe, expect, it } from 'vitest';
import { BODY, MASS } from './bodyModel';
import { fullPose } from './interpolate';
import { centerOfMass, footContact, solveArm, solveSide, supportRange, type RigConfig } from './sideRig';
import type { ChairProp, Pose } from './types';

const standing: Pose = { ankle: 0, knee: 0, hip: 0, spine: 0, neck: 0, shoulder: 0, elbow: 0 };
const sitting: Pose = { ankle: 0, knee: 90, hip: 90, spine: 0, neck: 0, shoulder: 0, elbow: 0 };
const FOOT: RigConfig = { root: { x: 0 } };
const solve = (pose: Pose, rig: RigConfig = FOOT, hands = 0) => solveSide(fullPose(pose), rig, hands);

describe('質量比', () => {
  it('全身の合計が 1 になる', () => {
    const paired = MASS.upperArm.mass + MASS.forearmHand.mass + MASS.thigh.mass + MASS.shank.mass + MASS.foot.mass;
    expect(MASS.head.mass + MASS.trunk.mass + MASS.pelvis.mass + 2 * paired).toBeCloseTo(1, 6);
  });
});

describe('solveSide（足を起点にする）', () => {
  it('まっすぐ立つと、各点が足首の真上に並び、高さが身長の割合どおりになる', () => {
    const sk = solve(standing, { root: { x: 0.1 } });
    for (const p of [sk.knee, sk.hip, sk.lumbar, sk.shoulder, sk.neckBase, sk.head]) expect(p.x).toBeCloseTo(0.1, 9);
    expect(sk.knee.y).toBeCloseTo(0.285, 3); // 膝の高さ
    expect(sk.hip.y).toBeCloseTo(0.53, 3); // 股関節の高さ
    expect(sk.shoulder.y).toBeCloseTo(0.818, 2); // 肩の高さ
    expect(sk.head.y + 0.07).toBeCloseTo(1.0, 1); // 頭のてっぺん
    expect(sk.wrist.y).toBeCloseTo(sk.shoulder.y - BODY.upperArm - BODY.forearm, 9); // 腕は真下に下がる
  });

  it('床についた足は、姿勢が変わっても動かない', () => {
    const a = solve(standing);
    const b = solve({ ...sitting, ankle: 15, spine: 20 });
    expect(b.ankle).toEqual(a.ankle);
    expect(b.heel).toEqual(a.heel);
    expect(b.toe).toEqual(a.toe);
    expect(a.heel.y).toBeCloseTo(0, 9);
    expect(a.ball.y).toBeCloseTo(0, 9);
    expect(a.toe.y).toBeCloseTo(0, 9);
  });

  it('奥の脚が同じ角度なら、奥の足も同じ位置で床につく', () => {
    const sk = solve({ ...sitting, ankle: 12, knee: 70, hip: 60 });
    expect(sk.farAnkle.x).toBeCloseTo(sk.ankle.x, 9);
    expect(sk.farAnkle.y).toBeCloseTo(sk.ankle.y, 9);
    expect(sk.farFootAngle).toBeCloseTo(90, 9);
  });

  it('椅子に座った姿勢では、太ももが水平、体がまっすぐになる', () => {
    const sk = solve(sitting);
    expect(sk.hip.y).toBeCloseTo(sk.knee.y, 9);
    expect(sk.hip.x).toBeCloseTo(-BODY.thigh, 9);
    expect(sk.head.x).toBeCloseTo(sk.hip.x, 9);
  });

  it('関節を曲げると、決めた向きに動く', () => {
    const base = solve(standing);
    expect(solve({ ...standing, spine: 30 }).head.x).toBeGreaterThan(base.head.x); // 前かがみ
    expect(solve({ ...standing, shoulder: 90 }).wrist.x).toBeGreaterThan(base.wrist.x + 0.3); // 腕を前へ
    expect(solve({ ...standing, farHip: 60 }).farKnee.x).toBeGreaterThan(base.farKnee.x + 0.2); // 膝上げ
    expect(solve({ ...standing, farKnee: 90 }).farAnkle.x).toBeLessThan(base.farAnkle.x - 0.2); // 膝を曲げると足は後ろへ
  });
});

describe('solveSide（座面の股関節を起点にする）', () => {
  const SEAT: RigConfig = { root: { mode: 'seat', x: -0.2, y: 0.298, pelvis: 0 } };
  const seated: Pose = { ankle: 0, knee: 87, hip: 87, spine: 0, neck: 0, shoulder: 0, elbow: 0 };

  it('股関節は動かず、足は床に平らにつく', () => {
    const sk = solve(seated, SEAT);
    expect(sk.hip).toEqual({ x: -0.2, y: 0.298 });
    expect(sk.heel.y).toBeCloseTo(0, 2);
    expect(sk.toe.y).toBeCloseTo(0, 2);
    expect(sk.footAngle).toBeCloseTo(90, 9);
    expect(sk.head.x).toBeCloseTo(-0.2, 9); // 体はまっすぐ
  });

  it('膝を伸ばすと、手前の足だけが前に上がり、奥の足と体は動かない', () => {
    const a = solve({ ...seated, farKnee: 87, farHip: 87, farAnkle: 0 }, SEAT);
    const b = solve({ ...seated, knee: 10, farKnee: 87, farHip: 87, farAnkle: 0 }, SEAT);
    expect(b.ankle.y).toBeGreaterThan(a.ankle.y + 0.15);
    expect(b.ankle.x).toBeGreaterThan(a.ankle.x + 0.15);
    expect(b.farAnkle).toEqual(a.farAnkle);
    expect(b.head).toEqual(a.head);
    expect(b.knee).toEqual(a.knee); // 太ももは座面に乗ったまま
  });

  it('かかと上げ：母趾球とつま先は床に付いたまま、かかとと膝が上がる', () => {
    const flat = solve(seated, SEAT);
    const rig: RigConfig = { ...SEAT, plants: { near: { pivot: 'ball', x: flat.ball.x }, far: { pivot: 'ball', x: flat.ball.x } } };
    const down = solve({ ...seated, footPitch: 0 }, rig);
    const up = solve({ ...seated, footPitch: 30 }, rig);
    expect(down.ankle.x).toBeCloseTo(flat.ankle.x, 6);
    expect(down.knee.y).toBeCloseTo(flat.knee.y, 2);
    for (const sk of [down, up]) {
      expect(sk.ball.x).toBeCloseTo(flat.ball.x, 9);
      expect(sk.ball.y).toBeCloseTo(0, 9);
      expect(sk.toe.y).toBeCloseTo(0, 9); // つま先は曲がって床に付く
      expect(sk.farBall.x).toBeCloseTo(flat.ball.x, 9);
    }
    expect(up.heel.y).toBeGreaterThan(0.04);
    expect(up.knee.y).toBeGreaterThan(down.knee.y + 0.02);
    expect(up.effective.ankle).toBeLessThan(-10); // 足首は底屈する
    expect(up.effective.knee).toBeGreaterThan(0);
  });

  it('つま先上げ：かかとは床に付いたまま、つま先が上がる', () => {
    const flat = solve(seated, SEAT);
    const rig: RigConfig = { ...SEAT, plants: { near: { pivot: 'heel', x: flat.heel.x } } };
    const up = solve({ ...seated, footPitch: -18 }, rig);
    expect(up.heel.x).toBeCloseTo(flat.heel.x, 9);
    expect(up.heel.y).toBeCloseTo(0, 9);
    expect(up.toe.y).toBeGreaterThan(0.03);
    expect(up.effective.ankle).toBeGreaterThan(10); // 足首は背屈する
  });
});

describe('手の接触（腕の2関節を合わせる）', () => {
  it('届く位置なら、手のひらが目標にぴったり付く', () => {
    const contact = { on: 'thigh' as const, along: 0.7, offset: 0.055 };
    const sk = solve({ ...sitting, ankle: 15, knee: 100, hip: 85 }, { ...FOOT, contacts: { near: contact, far: contact } }, 1);
    expect(sk.handTarget).toBeDefined();
    expect(Math.hypot(sk.hand.x - sk.handTarget!.x, sk.hand.y - sk.handTarget!.y)).toBeLessThan(1e-6);
    expect(Math.hypot(sk.farHand.x - sk.farHandTarget!.x, sk.farHand.y - sk.farHandTarget!.y)).toBeLessThan(1e-6);
    expect(sk.arm.elbow).toBeGreaterThan(0); // 肘は曲がる方向にだけ曲がる
  });

  it('接触の強さ 0 なら、キーフレームの角度のまま', () => {
    const sk = solve({ ...sitting, shoulder: 10, elbow: 20 }, { ...FOOT, contacts: { near: { on: 'thigh', along: 0.7, offset: 0.055 } } }, 0);
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
    const sk = solve(standing);
    const com = centerOfMass(sk);
    const range = supportRange(sk, false, [])!;
    expect(com.y).toBeGreaterThan(0.55);
    expect(com.y).toBeLessThan(0.6);
    expect(com.x).toBeGreaterThan(range.min);
    expect(com.x).toBeLessThan(range.max);
  });

  it('支えの範囲は、床についた足のかかとからつま先まで', () => {
    const range = supportRange(solve(standing), false, [])!;
    expect(range.min).toBeCloseTo(-BODY.heelBack, 9);
    expect(range.max).toBeCloseTo(BODY.toeFront, 9);
  });

  it('座っている間は、座面も支えに数える', () => {
    const sk = solve(sitting);
    const com = centerOfMass(sk);
    expect(com.x).toBeLessThan(supportRange(sk, false, [chair])!.min); // 足だけでは支えられない
    const seated = supportRange(sk, true, [chair])!;
    expect(com.x).toBeGreaterThan(seated.min);
    expect(com.x).toBeLessThan(seated.max);
  });

  it('上げた足は支えに数えない', () => {
    const sk = solve({ ...standing, farHip: 40, farKnee: 60 });
    expect(supportRange(sk, false, [])!.max).toBeCloseTo(BODY.toeFront, 9);
    expect(footContact(sk.farHeel, sk.farBall, sk.farToe)).toBeNull();
  });

  it('かかとを上げた足は、指の付け根のふくらみ（母趾球の少し後ろ）からつま先までだけを支えに数える', () => {
    const range = footContact({ x: 0, y: 0.05 }, { x: 0.12, y: 0 }, { x: 0.15, y: 0 });
    expect(range?.min).toBeCloseTo(0.108, 9);
    expect(range?.max).toBe(0.15);
    // かかとも床についていれば、かかとからつま先まで
    expect(footContact({ x: 0, y: 0 }, { x: 0.12, y: 0 }, { x: 0.15, y: 0 })).toEqual({ min: 0, max: 0.15 });
  });

  it('前かがみになると重心は前へ動く', () => {
    const a = centerOfMass(solve(sitting));
    const b = centerOfMass(solve({ ...sitting, hip: 110, spine: 20 }));
    expect(b.x).toBeGreaterThan(a.x + 0.03);
  });
});
