// 医師用設定に入るための暗証番号

import { useState } from 'react';
import { Button } from '../app/Button';
import { playTap } from '../app/feedback';

// 本人が誤って医師用の画面に入らないための番号。秘密の保護が目的ではない
export const DOCTOR_PIN = '0101';

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '消す'];

export function PinEntry({ onSuccess, onBack }: Props) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);

  const press = (key: string) => {
    playTap();
    if (key === '消す') {
      setDigits(digits.slice(0, -1));
      return;
    }
    const next = digits + key;
    if (next.length < DOCTOR_PIN.length) {
      setDigits(next);
      setError(false);
      return;
    }
    if (next === DOCTOR_PIN) {
      onSuccess();
    } else {
      setDigits('');
      setError(true);
    }
  };

  return (
    <main className="screen">
      <h1>医師用の設定</h1>
      <p className="lead">暗証番号を入れてください。</p>
      <p className="pin-dots" aria-label={`${digits.length}けた入力済み`}>
        {Array.from({ length: DOCTOR_PIN.length }, (_, i) => (i < digits.length ? '●' : '○')).join(' ')}
      </p>
      {error && (
        <p className="error" role="alert">
          番号が違います
        </p>
      )}
      <div className="keypad">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={k} type="button" className="key" onClick={() => press(k)}>
              {k}
            </button>
          ),
        )}
      </div>
      <div className="actions">
        <Button variant="secondary" onClick={onBack}>
          戻る
        </Button>
      </div>
    </main>
  );
}
