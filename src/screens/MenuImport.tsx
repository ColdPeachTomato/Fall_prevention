// メニューを読み込む（医師用）。アプリの中で QR を読み取るか、メニューコードを貼り付ける。
// カメラは、メニューの QR を読むためだけに使う。写した絵は保存せず、外にも送らない。
// 読み取ったコードは必ず検証し、少しでもおかしければ全体を拒否する（いまのメニューはそのまま残る）。

import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import type { Menu } from '../data/types';
import { CODE_PREFIX, decodeMenuCode } from '../menu/code';

interface Props {
  onDecoded: (menu: Menu) => void; // 検証を通ったメニュー。このあと違いを確かめてから保存する
  onBack: () => void;
}

// カメラの絵から QR を探す。見つけた文字列を onText に渡す
function QrScanner({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const latest = useRef({ onText, onError });
  latest.current = { onText, onError };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');

    const scan = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      // 大きすぎる絵は縮めて調べる（長い辺を 1000 までに）
      const scale = Math.min(1, 1000 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (found && found.data !== '') latest.current.onText(found.data);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          latest.current.onError('この端末では、カメラを使えません。メニューコードを貼り付けて読み込んでください。');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        timer = window.setInterval(scan, 250);
      } catch {
        latest.current.onError('カメラを使えませんでした。カメラの使用を許可するか、メニューコードを貼り付けて読み込んでください。');
      }
    })();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return <video ref={videoRef} className="scan-video" playsInline muted aria-label="カメラの映像" />;
}

export function MenuImport({ onDecoded, onBack }: Props) {
  const [scanning, setScanning] = useState(false);
  const [pasted, setPasted] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastBad = useRef('');

  const tryCode = (text: string, from: 'scan' | 'paste') => {
    if (from === 'scan') {
      // メニューの QR でないものが写っている間は、同じ知らせを繰り返さない
      if (text === lastBad.current) return;
      if (!text.startsWith(CODE_PREFIX.slice(0, 3))) {
        lastBad.current = text;
        setErrors(['メニューの QR ではありません。運動メニューのシートの QR を写してください。']);
        return;
      }
    }
    const r = decodeMenuCode(text);
    if (r.ok) {
      setScanning(false);
      onDecoded(r.menu);
      return;
    }
    lastBad.current = text;
    setErrors(['読み込めませんでした。いまのメニューは変わっていません。', ...r.errors]);
  };

  return (
    <main className="screen doctor">
      <h1>メニューを読み込む</h1>
      <p>読み込んだあと、いまのメニューとの違いを確かめてから保存します。</p>

      <section className="editor-section">
        <h2>QR を読み取る</h2>
        {scanning ? (
          <>
            <QrScanner
              onText={(t) => tryCode(t, 'scan')}
              onError={(m) => {
                setCameraError(m);
                setScanning(false);
              }}
            />
            <p className="muted">シートの QR が、枠いっぱいに写るように近づけてください。カメラは QR を読むためだけに使い、写した絵は保存しません。</p>
            <button type="button" className="btn btn-secondary" onClick={() => setScanning(false)}>
              カメラを止める
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setErrors([]);
              setCameraError(null);
              lastBad.current = '';
              setScanning(true);
            }}
          >
            カメラで QR を読み取る
          </button>
        )}
        {cameraError && <p role="alert">{cameraError}</p>}
      </section>

      <section className="editor-section">
        <h2>メニューコードを貼り付ける</h2>
        <label>
          メニューコード（FPM1: で始まる文字列）
          <textarea className="code-input" rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => tryCode(pasted, 'paste')}>
          このコードを読み込む
        </button>
      </section>

      {errors.length > 0 && (
        <section className="notice notice-warn" role="alert">
          <h2>{errors[0]}</h2>
          {errors.length > 1 && (
            <ul>
              {errors.slice(1).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          読み込まずに戻る
        </button>
      </div>
    </main>
  );
}
