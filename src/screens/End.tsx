// 終了。きつさと、転倒・ヒヤリの有無を記録する。

import { useState } from 'react';
import { Button } from '../app/Button';
import type { StopReason } from '../data/types';
import { CONSULT_TEXT, EXERTION_LABELS } from '../safety/texts';

export interface EndResult {
  exertion: 1 | 2 | 3 | 4 | 5;
  fall: boolean;
  nearMiss: boolean;
}

interface Props {
  stoppedReason?: StopReason;
  onSave: (result: EndResult) => void;
}

const LEVELS = [1, 2, 3, 4, 5] as const;

export function End({ stoppedReason, onSave }: Props) {
  const [exertion, setExertion] = useState<EndResult['exertion'] | null>(null);
  const [fall, setFall] = useState<boolean | null>(null);
  const [nearMiss, setNearMiss] = useState<boolean | null>(null);
  const ready = exertion !== null && fall !== null && nearMiss !== null;
  const symptomStop = stoppedReason === 'pain' || stoppedReason === 'breath-dizzy';

  return (
    <main className="screen">
      <h1>{stoppedReason ? '運動を中止しました' : 'おつかれさまでした'}</h1>
      {stoppedReason && (
        <section className="notice notice-warn" role="status">
          {symptomStop ? <p>{CONSULT_TEXT}</p> : <p>無理をせず、ゆっくり休んでください。</p>}
        </section>
      )}

      <section>
        <h2>きつさはどうでしたか</h2>
        <div className="choices">
          {LEVELS.map((n) => (
            <Button key={n} variant="secondary" pressed={exertion === n} onClick={() => setExertion(n)}>
              {exertion === n ? '✓ ' : ''}
              {n}　{EXERTION_LABELS[n]}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h2>今日、転びましたか</h2>
        <div className="choices choices-row">
          <Button variant="secondary" pressed={fall === false} onClick={() => setFall(false)}>
            {fall === false ? '✓ ' : ''}転んでいない
          </Button>
          <Button variant="secondary" pressed={fall === true} onClick={() => setFall(true)}>
            {fall === true ? '✓ ' : ''}転んだ
          </Button>
        </div>
      </section>

      <section>
        <h2>ヒヤリとしたことはありましたか</h2>
        <div className="choices choices-row">
          <Button variant="secondary" pressed={nearMiss === false} onClick={() => setNearMiss(false)}>
            {nearMiss === false ? '✓ ' : ''}なかった
          </Button>
          <Button variant="secondary" pressed={nearMiss === true} onClick={() => setNearMiss(true)}>
            {nearMiss === true ? '✓ ' : ''}あった
          </Button>
        </div>
      </section>

      <div className="actions">
        {ready ? (
          <Button onClick={() => onSave({ exertion, fall, nearMiss })}>記録して終わる</Button>
        ) : (
          <p className="hint">3つの質問に答えると、記録できます。</p>
        )}
      </div>
    </main>
  );
}
