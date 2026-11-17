// はじめに。ホーム画面への追加を案内する。
// ブラウザで開いているとき、初回に一度だけ出す。ホームの知らせ（「追加の手順を見る」）からも開ける。
// ホーム画面から開いているときは出さない。

import { Button } from '../app/Button';
import { APP_NAME, INSTALL_STEPS, type Platform } from '../app/install';

interface Props {
  platform: Platform;
  first: boolean; // 初回の表示か（ホームの知らせから開いたときは false）
  onDone: () => void;
}

export function Welcome({ platform, first, onDone }: Props) {
  return (
    <main className="screen">
      <h1>{first ? 'はじめに' : 'ホーム画面に追加する'}</h1>
      <p className="lead">このアプリは、ホーム画面に追加して使います。</p>
      <section className="notice">
        <h2>ホーム画面に追加する手順</h2>
        <ol className="steps">
          {INSTALL_STEPS[platform].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <p>ホーム画面に追加しないで使うと、しばらく使わなかったときに、メニューや記録が消えることがあります。</p>
      <p>
        メニューと記録は、ホーム画面の「{APP_NAME}」から開いたアプリの中に残ります。いま開いているこの画面に入れたものは、引き継がれません。
      </p>
      <div className="actions">
        <Button variant="secondary" onClick={onDone}>
          {first ? 'あとで追加する（このまま使う）' : '戻る'}
        </Button>
      </div>
    </main>
  );
}
