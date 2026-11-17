// ホーム画面から開いているかどうかの判定と、ホーム画面に追加する手順の文。
// iPhone では、ホーム画面に追加したアプリは Safari とは別の保存領域を持つ。
// ブラウザのまま使うと、しばらく使わなかったときに保存データが消えることがあるので、ホーム画面への追加を案内する。

export type Platform = 'ios' | 'other';

// ホーム画面から開いているか。standalone：iPhone の Safari が持つ印。displayMode：表示のしかたが「アプリ」か
export function detectStandalone(standalone: boolean | undefined, displayModeStandalone: boolean): boolean {
  return standalone === true || displayModeStandalone;
}

// iPhone・iPad かどうか（iPad は Mac と名乗るので、指で触れる画面かどうかで見分ける）
export function detectPlatform(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

export function isStandalone(): boolean {
  try {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    return detectStandalone(standalone, window.matchMedia('(display-mode: standalone)').matches);
  } catch {
    return false;
  }
}

export function currentPlatform(): Platform {
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

// アプリの名前（ホーム画面に出る名前。vite.config.ts の short_name にも、これを使う）
export const APP_NAME = '転倒予防';

// ホーム画面に追加する手順
export const INSTALL_STEPS: Record<Platform, string[]> = {
  ios: [
    '画面の下か上にある「共有」のボタン（四角から上向きの矢印が出ている印）を押します。',
    '出てきた一覧を下へ動かし、「ホーム画面に追加」を押します。',
    '右上の「追加」を押します。',
    `ホーム画面にできた「${APP_NAME}」の印を押して、開き直します。`,
  ],
  other: [
    'ブラウザのメニュー（画面の右上の「︙」など）を開きます。',
    '「ホーム画面に追加」または「アプリをインストール」を押します。',
    `ホーム画面にできた「${APP_NAME}」の印を押して、開き直します。`,
  ],
};
