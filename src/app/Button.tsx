import type { ReactNode } from 'react';
import { playTap } from './feedback';

interface Props {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  disabled?: boolean;
  pressed?: boolean; // 選んだ状態（チェックや選択肢）
}

// 本人用の画面のボタン。高さ56px以上、横幅いっぱい。押すと色が変わり音が鳴る
export function Button({ children, onClick, variant = 'primary', disabled, pressed }: Props) {
  return (
    <button
      type="button"
      className={`btn btn-${variant}${pressed ? ' is-pressed' : ''}`}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => {
        playTap();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
