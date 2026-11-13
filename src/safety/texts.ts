// 安全にかかわる文言。病気の治療や予防の効果をうたう表現は使わない。

import type { StopReason } from '../data/types';

// S-2 開始前にたずねる体調
export const SYMPTOMS = [
  { id: 'fever', label: '熱がある' },
  { id: 'pain', label: '体に痛みがある' },
  { id: 'dizzy', label: 'めまいがする' },
  { id: 'chest', label: '胸が苦しい・胸が痛い' },
] as const;

// S-3 開始前に確かめる環境
export const ENVIRONMENT_CHECKS = [
  { id: 'shoes', label: '滑りにくい靴をはいた' },
  { id: 'floor', label: '床に物が置いていない' },
  { id: 'support', label: 'つかまる所（動かない椅子の背やカウンター）がすぐ横にある' },
  { id: 'phone', label: '電話が手の届く所にある' },
] as const;

// S-5 中止の目安
export const STOP_SIGNS = ['胸の痛み', 'いつもと違う息切れ', 'めまい', '動悸（胸がどきどきする）', '関節の痛み'];

// S-7 中止の理由
export const STOP_REASONS: { id: StopReason; label: string }[] = [
  { id: 'pain', label: '痛み' },
  { id: 'breath-dizzy', label: '息切れ・めまい' },
  { id: 'tired', label: '疲れた' },
  { id: 'other', label: 'その他' },
];

export const CONSULT_TEXT = '症状が続くときやつらいときは、医療機関に相談してください。';

export const EXERTION_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'とても楽',
  2: '楽',
  3: 'ちょうどよい',
  4: 'ややきつい',
  5: 'とてもきつい',
};
