// 「歩いた」の記録。メニューにある分数で記録する。

import { Button } from '../app/Button';

interface Props {
  minutes: number;
  onConfirm: () => void;
  onBack: () => void;
}

export function WalkConfirm({ minutes, onConfirm, onBack }: Props) {
  return (
    <main className="screen">
      <h1>歩いた記録</h1>
      <p className="lead">今日、{minutes}分 歩いたことを記録しますか。</p>
      <div className="actions">
        <Button onClick={onConfirm}>記録する</Button>
        <Button variant="secondary" onClick={onBack}>
          記録しないで戻る
        </Button>
      </div>
    </main>
  );
}
