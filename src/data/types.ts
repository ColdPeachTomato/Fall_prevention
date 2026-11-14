// データの型。要件メモ「データ定義」を出発点にしている。

export type Level = 1 | 2 | 3;
export type { SupportStage } from '../animation/types'; // 両手・片手・指先・なし
import type { SupportStage } from '../animation/types';
export type View = 'front' | 'side' | 'back';
export type Category = 'warmup' | 'strength' | 'balance' | 'dynamic' | 'walking';
export type Unit = 'reps' | 'seconds' | 'laps' | 'minutes';
export type Posture = 'sitting' | 'standing';

// 運動（アプリに同梱。利用者のデータではない）
export interface Exercise {
  id: string;
  name: string;
  category: Category;
  highRisk: boolean; // true の種目はメニューで明示的に選んだときだけ表示
  unit: Unit;
  bilateral: boolean; // 左右を入れ替えて行うか（回数は片側ずつの数）
  // 回す向きを替えて行う種目の、向きの名前（例：外回し・内回し）。回数は向きごとの数。
  // 2つ目の向きは、同じアニメを逆向きに再生して見せる
  directions?: [string, string];
  cues: string[]; // 注意点。1つ目を画面に大きく出す
  variants: ExerciseVariant[];
  // 種目として最低限必要な支え。メニューの支えがこれより少ないときはこちらを使う（支えは増やす方向にしか変えない）
  minSupport?: SupportStage;
}

export interface ExerciseVariant {
  level: Level;
  howTo: string; // そのレベルでの行い方（短い文）
  posture: Posture; // 立って行うときは開始前に支持物の確認を出す（S-6）
  usesSupport: boolean; // 支持物につかまるか
  view: View;
  animationId: string | null; // キーフレームの参照。未作成なら null
}

// メニュー（医師が決める。QRやコードに入るのはこれだけ）
export interface Menu {
  v: 1;
  issuedOn: string; // 'YYYY-MM-DD'
  reviewAfterDays: number;
  support: SupportStage; // 立位種目の支えの段階
  intensityCap: string; // 強度の上限の文言
  standard: MenuItem[];
  short: MenuItem[];
  walking?: { minutes: number; daysPerWeek: number };
}

export interface MenuItem {
  ex: string;
  level: Level;
  amount: number; // 回数・秒数・往復数（左右がある種目は片側の数、回す向きがある種目は向きごとの数）
  sets: number;
}

export type SessionKind = 'standard' | 'short';
export type StopReason = 'pain' | 'breath-dizzy' | 'tired' | 'other';

// 記録（端末内だけに保存）
export interface SessionRecord {
  id: string;
  date: string; // 'YYYY-MM-DD'
  createdAt: string; // ISO 日時。メニュー設定より後の転倒・ヒヤリかを判断する
  kind: 'standard' | 'short' | 'rest' | 'walk';
  completed: string[];
  stopped?: { ex: string; reason: StopReason };
  exertion?: 1 | 2 | 3 | 4 | 5;
  fall: boolean;
  nearMiss: boolean;
  walkMinutes?: number;
}

// 端末の設定
export interface Settings {
  menuSetAt?: string; // メニューを保存した日時（ISO）
}
