// メニューを渡す（医師用）。メニューコード、QR、A4 の印刷シートを作る。
// シートには、氏名など個人を特定する情報を入れない。

import { useMemo, useState } from 'react';
import { addDays } from '../app/dates';
import type { Menu } from '../data/types';
import { encodeMenu } from '../menu/code';
import { makeQr } from '../menu/qr';
import { MenuSummary } from './MenuSummary';
import { QrImage } from './QrImage';

interface Props {
  menu: Menu;
  onBack: () => void;
}

export function MenuShare({ menu, onBack }: Props) {
  const code = useMemo(() => encodeMenu(menu), [menu]);
  const qr = useMemo(() => makeQr(code), [code]);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('yes');
    } catch {
      setCopied('no'); // コピーできない端末では、下のコードを手で選んでもらう
    }
  };

  return (
    <main className="screen doctor share">
      <div className="no-print">
        <h1>メニューを渡す</h1>
        <p>下のシートを印刷して渡すか、QR を本人の端末で読み取ります。QR が読めないときは、メニューコードを貼り付けて読み込めます。</p>
        <p className="muted">このシートとコードには、氏名や生年月日など、個人を特定する情報は入っていません。</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            シートを印刷する
          </button>
          <button type="button" className="btn btn-secondary" onClick={copy}>
            メニューコードをコピーする
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            戻る
          </button>
        </div>
        {copied === 'yes' && <p role="status">コピーしました。</p>}
        {copied === 'no' && <p role="status">この端末ではコピーできませんでした。シートの下のコードを選んでコピーしてください。</p>}
      </div>

      {/* A4 の印刷シート。画面でも同じものを見せる */}
      <section className="print-sheet" aria-label="印刷シート">
        <h2 className="sheet-title">運動メニュー</h2>
        <p className="sheet-dates">
          作成日 {menu.issuedOn}　／　見直しの目安 {addDays(menu.issuedOn, menu.reviewAfterDays)}
        </p>
        <div className="sheet-top">
          {qr ? (
            <QrImage qr={qr} label="メニューの QR" />
          ) : (
            <p className="sheet-noqr">種目が多く、QR に入りきりません。下のメニューコードを貼り付けて読み込んでください。</p>
          )}
          <div className="sheet-how">
            <h3>アプリへの入れ方</h3>
            <ol>
              <li>アプリのホームのいちばん下の「医師用の設定」を開きます。</li>
              <li>「メニューを読み込む」を押します。</li>
              <li>「カメラで QR を読み取る」を押し、この QR を写します。</li>
              <li>いまのメニューとの違いを確かめて、「保存する」を押します。</li>
            </ol>
            <p>iPhone のカメラアプリでは読み込めません。必ずアプリの中で読み取ってください。</p>
          </div>
        </div>
        <MenuSummary menu={menu} />
        <h3>メニューコード（QR が読めないときに使います）</h3>
        <p className="sheet-code">{code}</p>
      </section>
    </main>
  );
}
