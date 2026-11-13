// アニメのデータ形式。キーフレームは JSON（src/data/animations/）で持ち、コードと分ける。
// 長さの単位は「身長 = 1」。x は人物の前方向が正、y は床からの高さ。
// 角度の単位は度。

export type AnimationView = 'side'; // 正面・後ろはフェーズ3で足す

// 手前側（near）の関節。奥側（far）は省略すると手前側と同じ角度になる
export type NearJoint = 'ankle' | 'knee' | 'hip' | 'spine' | 'neck' | 'shoulder' | 'elbow';
export type FarJoint = 'farAnkle' | 'farKnee' | 'farHip' | 'farShoulder' | 'farElbow';
export type JointName = NearJoint | FarJoint;

export type Pose = Record<NearJoint, number> & Partial<Record<FarJoint, number>>;
export type FullPose = Record<JointName, number>;

export interface Keyframe {
  t: number; // 秒。0 以上、1往復の時間より小さい。昇順
  pose: Pose;
  onSeat?: boolean; // お尻が座面についているか（前後のキーフレームが両方 true の間だけ、座面を支えに数える）
  hands?: number; // 手の接触の強さ 0〜1。1 のとき手は接触先にぴったり付く
  label?: string; // プレビュー用の名前
}

// 手の接触先
export type ContactTarget =
  | { on: 'thigh'; along: number; offset: number } // 太ももの上（along：股関節から膝への割合、offset：前面への距離）
  | { on: 'world'; x: number; y: number }; // 支持物などの決まった位置

export interface ChairProp {
  type: 'chair';
  x: number; // 座面の後ろの端
  seatHeight: number; // 座面の上の高さ
  seatDepth: number;
  backHeight: number; // 背もたれの上の高さ
}
export type Prop = ChairProp;

export type SegmentName = 'head' | 'trunk' | 'pelvis' | 'upperArm' | 'forearm' | 'thigh' | 'shank' | 'foot';

export type AnchorName =
  | 'ankle'
  | 'toe'
  | 'knee'
  | 'hip'
  | 'lumbar'
  | 'shoulder'
  | 'neckBase'
  | 'head'
  | 'elbow'
  | 'hand';

// 注意点の印（体の上に重ねる矢印）
export interface ArrowMark {
  type: 'arrow';
  from: number; // 表示する区間（秒）
  to: number;
  anchor: AnchorName; // 矢印の根元を付ける体の点
  dx: number; // 根元のずらし
  dy: number;
  angle: number; // 向き。真上が 0、前方向が 90
  length: number;
}
export type Mark = ArrowMark;

export interface Caption {
  from: number;
  to: number;
  text: string;
}

export interface AnimationData {
  id: string;
  exercise: string; // 運動ID
  level: number;
  view: AnimationView;
  cycleSeconds: number; // 1往復の時間。終わりが回数のカウントになる
  root: { x: number }; // 床についた足（手前側）の足首の位置。動かさない
  props: Prop[]; // 支持物の種類と位置
  highlight: SegmentName[]; // 動かしている部位（目立つ色で描く）
  contacts?: { near?: ContactTarget; far?: ContactTarget }; // 手の接触
  keyframes: Keyframe[];
  captions: Caption[]; // 字幕の区間
  marks: Mark[];
}
