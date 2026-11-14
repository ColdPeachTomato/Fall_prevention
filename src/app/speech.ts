// 音声の読み上げ。端末の読み上げ機能（Web Speech API）を使う。
// 実機で聞いて不十分なら録音音声に差し替えられるよう、呼び出し側は Speaker の形だけを使う。
// 読み上げの文は speechTexts.ts にまとめてある。

export interface Speaker {
  say(text: string): void; // 順番待ちに入れて読み上げる
  stop(): void; // 読み上げを止め、順番待ちも消す
}

function japaneseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'ja-JP') ?? voices.find((v) => v.lang.startsWith('ja')) ?? null;
}

// 端末の読み上げ機能を使う Speaker。使えない端末では何もしない
export const speaker: Speaker = {
  say(text) {
    try {
      if (!('speechSynthesis' in window) || text === '') return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.95; // 少しゆっくり
      const voice = japaneseVoice();
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // 読み上げが使えない端末では、字幕だけで進める
    }
  },
  stop() {
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      // 何もしない
    }
  },
};
