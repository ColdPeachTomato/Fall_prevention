// 開始前チェック。体調（S-2）→ 環境（S-3）→ 強度の上限と中止の目安（S-5）。
// 「今日は休む」はどの段階でも選べる（S-4）。

import { useState } from 'react';
import { Button } from '../app/Button';
import type { Menu } from '../data/types';
import { CONSULT_TEXT, ENVIRONMENT_CHECKS, STOP_SIGNS, SYMPTOMS } from '../safety/texts';

interface Props {
  menu: Menu;
  onRest: (reason: 'symptom' | 'choice') => void;
  onBegin: () => void;
}

type Stage = 'health' | 'environment' | 'limits';

export function PreCheck({ menu, onRest, onBegin }: Props) {
  const [stage, setStage] = useState<Stage>('health');
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const restButton = (
    <Button variant="secondary" onClick={() => onRest('choice')}>
      今日は休む
    </Button>
  );

  if (stage === 'health') {
    const hasSymptom = symptoms.size > 0;
    return (
      <main className="screen">
        <h1>今日の体調</h1>
        <p className="lead">当てはまるものがあれば、押してください。</p>
        <div className="choices">
          {SYMPTOMS.map((s) => (
            <Button key={s.id} variant="secondary" pressed={symptoms.has(s.id)} onClick={() => setSymptoms(toggle(symptoms, s.id))}>
              {symptoms.has(s.id) ? '✓ ' : ''}
              {s.label}
            </Button>
          ))}
        </div>
        {hasSymptom ? (
          <>
            <section className="notice" role="status">
              <p>今日は運動をお休みしましょう。</p>
              <p>{CONSULT_TEXT}</p>
            </section>
            <div className="actions">
              <Button onClick={() => onRest('symptom')}>今日は休む</Button>
            </div>
          </>
        ) : (
          <div className="actions">
            <Button onClick={() => setStage('environment')}>どれも当てはまらない</Button>
            {restButton}
          </div>
        )}
      </main>
    );
  }

  if (stage === 'environment') {
    const allChecked = checks.size === ENVIRONMENT_CHECKS.length;
    return (
      <main className="screen">
        <h1>まわりの確認</h1>
        <p className="lead">確かめたものを押してください。</p>
        <div className="choices">
          {ENVIRONMENT_CHECKS.map((c) => (
            <Button key={c.id} variant="secondary" pressed={checks.has(c.id)} onClick={() => setChecks(toggle(checks, c.id))}>
              {checks.has(c.id) ? '✓ ' : '□ '}
              {c.label}
            </Button>
          ))}
        </div>
        <div className="actions">
          {allChecked ? (
            <Button onClick={() => setStage('limits')}>次へ</Button>
          ) : (
            <p className="hint">4つすべて確かめると、次へ進めます。</p>
          )}
          {restButton}
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1>始める前に</h1>
      <section className="notice">
        <h2>今日の強さの上限</h2>
        <p className="big-text">{menu.intensityCap}</p>
      </section>
      <section className="notice notice-warn">
        <h2>次のことがあったら、すぐに中止してください</h2>
        <ul>
          {STOP_SIGNS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p>運動中は、画面の「中止」をいつでも押せます。</p>
      </section>
      <div className="actions">
        <Button onClick={onBegin}>始める</Button>
        {restButton}
      </div>
    </main>
  );
}
