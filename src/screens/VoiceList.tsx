// この端末で、アプリから選べる読み上げの声の一覧（開発用。プレビュー画面に出す）。
// iPhone の設定で追加した「拡張」「プレミアム」の声が、アプリから選べるかを実機で確かめるために使う。

import { useEffect, useState } from 'react';

const SAMPLE = '足を少し引き、前かがみになって立ちます。いち、に、さん。';

export function VoiceList() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    // 声の一覧は、あとから届くことがある
    synth.addEventListener?.('voiceschanged', load);
    const timer = window.setTimeout(load, 1000);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      window.clearTimeout(timer);
    };
  }, [supported]);

  const japanese = voices.filter((v) => v.lang.toLowerCase().startsWith('ja'));
  // アプリがいま使う声：日本語の声のうち、最初に見つかったもの（src/app/speech.ts と同じ決め方）
  const used = voices.find((v) => v.lang === 'ja-JP') ?? japanese[0] ?? null;

  const speak = (voice: SpeechSynthesisVoice) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(SAMPLE);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.95;
    utterance.voice = voice;
    synth.speak(utterance);
  };

  return (
    <section className="notice">
      <h2>読み上げの声（この端末でアプリから選べるもの）</h2>
      {!supported && <p>この端末では、読み上げ機能が使えません。</p>}
      {supported && (
        <>
          <p>
            日本語の声：{japanese.length} 個（すべての言語：{voices.length} 個）
          </p>
          {japanese.length === 0 && <p>日本語の声が見つかりません。少し待ってから、もう一度開いてください。</p>}
          <ul>
            {japanese.map((v) => (
              <li key={v.voiceURI}>
                <strong>{v.name}</strong>（{v.lang}、{v.localService ? '端末内' : '通信が必要'}
                {v === used ? '、いまアプリが使う声' : ''}）
                <br />
                <small>{v.voiceURI}</small>
                <br />
                <button type="button" className="btn btn-secondary" onClick={() => speak(v)}>
                  この声で聞く
                </button>
              </li>
            ))}
          </ul>
          <p className="muted">設定で追加した「拡張」「プレミアム」の声がここに出ていれば、アプリから選べます。</p>
        </>
      )}
    </section>
  );
}
