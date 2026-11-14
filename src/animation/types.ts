// アニメのデータ形式。キーフレームは JSON（src/data/animations/）で持ち、コードと分ける。
// 長さの単位は「身長 = 1」。y は床からの高さ。角度の単位は度。
// 視点ごとに 2D で定義する（3D にはしない）。
//   横向き（side）：x は人物の前方向が正。関節角度で姿勢を表す。
//   正面（front）・後ろ（back）：x は画面の右方向が正。手足は「見かけの向きと長さ」で表す（下の FrontPose）。

export type AnimationView = 'side' | 'front' | 'back';

// 手前側（near）の関節。必ず書く
export type NearJoint = 'ankle' | 'knee' | 'hip' | 'spine' | 'neck' | 'shoulder' | 'elbow';
// 奥側（far）の関節。省略すると手前側と同じ角度になる
export type FarJoint = 'farAnkle' | 'farKnee' | 'farHip' | 'farShoulder' | 'farElbow' | 'farFootPitch';
// 省略できる値。footPitch は足の傾き（正：かかとを上げる、負：つま先を上げる）。省略すると 0。
// travel は歩いた距離（身長 = 1）。歩く種目で、床の目印を流すのに使う。体の位置は変えない
export type OptionalJoint = FarJoint | 'footPitch' | 'travel';
export type JointName = NearJoint | OptionalJoint;

export type Pose = Record<NearJoint, number> & Partial<Record<OptionalJoint, number>>;
export type FullPose = Record<JointName, number>;

export interface Keyframe {
  t: number; // 秒。0 以上、1往復の時間より小さい。昇順
  pose: Pose;
  onSeat?: boolean; // お尻が座面についているか（前後のキーフレームが両方 true の間だけ、座面を支えに数える）
  hands?: number; // 手の接触の強さ 0〜1。1 のとき手は接触先にぴったり付く
  label?: string; // プレビュー用の名前
}

// 体の位置を決める起点
export type Root =
  // 立つ・立ち上がる種目：床についた足首を起点にする（足は滑らない）。side が far なら、奥側の足が起点（手前の足を踏み出す種目）
  | { mode?: 'foot'; x: number; side?: 'far' }
  // 座って行う種目：座面に乗った股関節を起点にする。pelvis は骨盤の前傾（まっすぐ座ると 0）
  | { mode: 'seat'; x: number; y: number; pelvis: number }
  // 立って片脚ずつ動かす種目：股関節の位置を動かさず、脚は股関節から下へ計算する（足踏み、脚の後ろ上げ など）
  | { mode: 'hip'; x: number; y: number; pelvis: number };

// 足を床の決まった位置に付けたままにする指定。
// 足の傾き（footPitch）に合わせて、脚の関節は自動で決まる。
// 足首を起点にする種目（root.mode = foot）の手前側だけは、足首から上をキーフレームの角度で計算する。
export interface Plant {
  pivot: 'ball' | 'heel'; // 支点。ball：母趾球（かかと上げ）、heel：かかと（つま先上げ）
  x: number; // 支点の位置
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
// カウンター（体の向こう側に、歩く向きに沿って置く。横から見ると、体の後ろに長く見える）
export interface SideCounterProp {
  type: 'counter';
  x: number; // 左の端
  length: number;
  height: number;
}
export type Prop = ChairProp | SideCounterProp;

export type SegmentName = 'head' | 'trunk' | 'pelvis' | 'upperArm' | 'forearm' | 'thigh' | 'shank' | 'foot';
// 目立たせる部位。far を付けると奥側だけ、near を付けると手前側だけ
export type HighlightName = SegmentName | `near:${SegmentName}` | `far:${SegmentName}`;

export type AnchorName =
  | 'ankle'
  | 'heel'
  | 'toe'
  | 'knee'
  | 'hip'
  | 'lumbar'
  | 'shoulder'
  | 'neckBase'
  | 'head'
  | 'elbow'
  | 'hand'
  | 'farAnkle'
  | 'farKnee';

// 注意点の印（体の上に重ねる矢印や線）
export interface ArrowMark {
  type: 'arrow';
  from: number; // 表示する区間（秒）
  to: number;
  anchor: AnchorName; // 根元を付ける体の点
  dx: number; // 根元のずらし
  dy: number;
  angle: number; // 向き。真上が 0、前方向が 90
  length: number;
}
// まっすぐな目安の線（例：体をまっすぐ保つ線）。anchor を中心に両側へ伸びる
export interface LineMark {
  type: 'line';
  from: number;
  to: number;
  anchor: AnchorName;
  dx: number;
  dy: number;
  angle: number;
  length: number;
}
export type Mark = ArrowMark | LineMark;

export interface Caption {
  from: number;
  to: number;
  text: string;
}

// 視点によらず共通の項目
interface AnimationBase {
  id: string;
  exercise: string; // 運動ID
  level: number;
  cycleSeconds: number; // 1往復の時間
  countsPerCycle?: number; // 1往復で数える回数。省略すると 1（左右交互の種目は 2）
  cyclesPerLap?: number; // 往復で数える種目で、アニメ何周ぶんを1往復とするか。省略すると 1
  checked?: boolean; // 確認済みの印。医師などが見本を確かめたら true にする
  // 姿勢の文（どう構えるか）。動きの字幕の上に、出し続ける。一瞬しか出ない字幕を作らないために分けてある
  posture?: string;
  captions: Caption[]; // 字幕の区間。どの字幕も2秒以上出す
  // 逆向きに再生するとき（内回し・前回しなど）の字幕。これがあるアニメだけ、逆向きに再生できる。
  // 時刻は再生の時刻（逆向きに再生し始めてからの秒）
  reverseCaptions?: Caption[];
}

// 横向きのアニメ
export interface SideAnimation extends AnimationBase {
  view: 'side';
  root: Root;
  plants?: { near?: Plant; far?: Plant }; // 足を床に付けたままにする指定
  props: Prop[]; // 支持物の種類と位置
  highlight: HighlightName[]; // 動かしている部位（目立つ色で描く）
  contacts?: { near?: ContactTarget; far?: ContactTarget }; // 手の接触
  // つかまる所（支持物）の、手を置く点。支えの段階に合わせて、腕だけがここに付く（下半身のキーフレームは共通）
  // hand：片手・指先のときに使う手（省略すると手前側）。体の向こう側のカウンターには、奥側の手でつかまる
  // follow：体（股関節）と一緒に動く。x は股関節からの距離になる（踏み出して体が前へ動く種目で、手がカウンターの上をすべる）
  support?: { x: number; y: number; hand?: 'near' | 'far'; follow?: boolean };
  // 歩く種目の床の目印。spacing：目印の間隔。perCycle：1往復（アニメの1周）で進む距離（spacing の整数倍）
  floor?: { spacing: number; perCycle: number };
  keyframes: Keyframe[];
  marks: Mark[];
}

// 支えの段階（両手・片手・指先・なし）。つかまらない種目は null
export type SupportStage = 'both' | 'one' | 'fingertip' | 'none';

// ── 正面・後ろ向き ───────────────────────────────────────────
// 体の左右は、人物から見た右（r）と左（l）で表す。
// 後ろ向きでは人物の右が画面の右に来る。正面は鏡に映したように描く（frontRig.ts の MIRROR_FRONT）。
//
// 手足の各節は、付け根から先への「見かけの向き」を2つの数で表す（節の長さを 1 とした割合）。
//   Out：体の外側への成分（正：外へ、負：内へ）
//   Up ：上への成分（正：上へ、負：下へ）
// 2つを合わせた長さが 1 より短い分は、手前か奥に向いて短く見えていることを表す。
// 例：下ろした腕は Out 0, Up -1。こちらに向けて伸ばした腕は Out 0, Up 0（点に見える）。
export type FrontLimbChannel =
  | 'ShoulderOut' // 肩の位置のずれ（身長 = 1。肩甲骨の動きで、肩が上下・内外に動く）
  | 'ShoulderUp'
  | 'ElbowOut' // 肩→肘
  | 'ElbowUp'
  // 肘が手前（正）にあるか、奥（負）にあるか（-1〜1）。位置は変えず、重なりの順と色の濃さだけに使う：
  // 手前にあるほど腕を濃く描き、手を腕の後ろに隠す。奥にあるほど薄く描く（腕回しで、回す向きが分かるように）
  | 'ElbowDepth'
  | 'HandOut' // 肘→手のひら
  | 'HandUp'
  | 'KneeOut' // 股関節→膝
  | 'KneeUp'
  // 脚が手前（正）にあるか、奥（負）にあるか（-1〜1）。位置は変えず、描き方だけに使う：
  // 手前の足は少し大きく・濃く・下に、奥の足は小さく・薄く・上に描く（足先を前や後ろに出す種目）
  | 'KneeDepth'
  | 'AnkleOut' // 膝→足首
  | 'AnkleUp'
  | 'ToeOut' // かかと→つま先
  | 'ToeUp';
export type FrontRightChannel = `r${FrontLimbChannel}`;
export type FrontLeftChannel = `l${FrontLimbChannel}`; // 省略すると右と同じ値（左右対称）
// lean：体幹を横に傾ける角度（正：画面の右へ）。turn：胸を回す角度（正：人物の右へ）。
// scapula：肩甲骨の寄り具合（0：ふつう、1：寄せきった）。shift：骨盤を横に動かす距離（正：画面の右へ。身長 = 1）
export type FrontBodyChannel = 'lean' | 'turn' | 'scapula' | 'shift';
export type FrontChannel = FrontBodyChannel | FrontRightChannel | FrontLeftChannel;

export type FrontPose = Partial<Record<FrontChannel, number>>;
export type FrontFullPose = Record<FrontChannel, number>;

export interface FrontKeyframe {
  t: number;
  pose: FrontPose;
  onSeat?: boolean;
  label?: string;
}

// 正面・後ろ向きの起点。x, y は左右の股関節の中央（shift が 0 のとき）。
// seat：座って行う種目。stand：立って行う種目（脚は股関節から下へ計算する。足が床で滑らないことはテストで確かめる）
export interface FrontRoot {
  mode: 'seat' | 'stand';
  x: number;
  y: number;
}

export type BodySide = 'r' | 'l';

// かかとを床の決まった位置に付けたままにする指定。足首の位置は、つま先の上げ具合から自動で決まる
export interface FrontPlant {
  x: number; // かかとの位置
}

// 支えの段階によって、置く場所を変える支持物のための指定
interface SupportPropOptions {
  showFor?: SupportStage[]; // この段階のときだけ描く（省略すると、いつも描く。つかまらない種目は none として扱う）
  inFront?: boolean; // 体の手前にある。体が見えるよう、薄く描く
}
export interface FrontChairProp extends SupportPropOptions {
  type: 'chair';
  x: number; // 座面の中央
  width: number;
  seatHeight: number;
  backHeight: number;
}
// カウンター（D3）
export interface CounterProp extends SupportPropOptions {
  type: 'counter';
  x: number; // 中央
  width: number;
  height: number;
}
// 両手で持つバンド（S8）。手から手へ描く
export interface BandProp {
  type: 'band';
}
export type FrontProp = FrontChairProp | CounterProp | BandProp;

// つかまる所の、手を置く点（正面・後ろ向き）。支えの段階に合わせて、腕だけがここに付く
export interface FrontSupport {
  hand: BodySide; // 片手・指先のときに使う手
  side?: { x: number; y: number }; // 体の横の支持物（片手・指先のとき）
  // 体の前の支持物。中心 x から左右に half の点をつかむ。follow：体と一緒に動く（カウンターに沿って進む種目）。
  // 両手のときに使う。side がなければ、片手・指先のときも使う
  front: { x: number; half: number; y: number; follow?: boolean };
}

export type FrontHighlightName = SegmentName | 'scapula' | `r:${SegmentName}` | `l:${SegmentName}`;

export type FrontLimbPoint = 'shoulder' | 'elbow' | 'hand' | 'hip' | 'knee' | 'ankle' | 'heel' | 'toe';
export type FrontAnchorName = 'pelvis' | 'lumbar' | 'chest' | 'neckBase' | 'head' | `r.${FrontLimbPoint}` | `l.${FrontLimbPoint}`;

interface FrontMarkBase {
  from: number;
  to: number;
  anchor: FrontAnchorName;
  dx: number;
  dy: number;
}
export interface FrontArrowMark extends FrontMarkBase {
  type: 'arrow';
  angle: number; // 向き。真上が 0、画面の右が 90
  length: number;
}
export interface FrontLineMark extends FrontMarkBase {
  type: 'line';
  angle: number;
  length: number;
}
// 回す向きを示す、弧の形の矢印。逆向きに再生するときは、矢じりが反対の端に付く
export interface FrontArcMark extends FrontMarkBase {
  type: 'arc';
  radius: number;
  start: number; // 始まりの向き（真上が 0、画面の右が 90）
  sweep: number; // 回る角度（正：時計回り）
}
export type FrontMark = FrontArrowMark | FrontLineMark | FrontArcMark;

// 正面・後ろ向きのアニメ
export interface FrontAnimation extends AnimationBase {
  view: 'front' | 'back';
  root: FrontRoot;
  plants?: Partial<Record<BodySide, FrontPlant>>;
  support?: FrontSupport;
  props: FrontProp[];
  highlight: FrontHighlightName[];
  // 表示する範囲（身長 = 1）。種目ごとに、全身と足元、支持物が入るように決める
  viewBox: { minX: number; maxX: number; minY: number; maxY: number };
  keyframes: FrontKeyframe[];
  marks: FrontMark[];
}

export type AnimationData = SideAnimation | FrontAnimation;
