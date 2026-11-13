// 短い知らせを出して、ホームへ戻る画面

import { Button } from '../app/Button';

interface Props {
  title: string;
  lines: string[];
  onDone: () => void;
}

export function Message({ title, lines, onDone }: Props) {
  return (
    <main className="screen">
      <h1>{title}</h1>
      {lines.map((l) => (
        <p key={l} className="lead">
          {l}
        </p>
      ))}
      <div className="actions">
        <Button onClick={onDone}>ホームに戻る</Button>
      </div>
    </main>
  );
}
