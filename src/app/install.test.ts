import { describe, expect, it } from 'vitest';
import { APP_NAME, detectPlatform, detectStandalone, INSTALL_STEPS } from './install';

describe('ホーム画面から開いているかどうか', () => {
  it('iPhone の印（standalone）か、表示のしかたが「アプリ」なら、ホーム画面から開いている', () => {
    expect(detectStandalone(true, false)).toBe(true);
    expect(detectStandalone(undefined, true)).toBe(true);
    expect(detectStandalone(false, true)).toBe(true);
  });

  it('どちらでもなければ、ブラウザで開いている（案内を出す）', () => {
    expect(detectStandalone(false, false)).toBe(false);
    expect(detectStandalone(undefined, false)).toBe(false);
  });
});

describe('端末の見分け', () => {
  it('iPhone と iPad は ios', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 27_2 like Mac OS X) AppleWebKit/605.1.15', 5)).toBe('ios');
    // iPad は Mac と名乗ることがある。指で触れる画面なら iPad
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5)).toBe('ios');
  });

  it('Mac や Android は other', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0)).toBe('other');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile', 5)).toBe('other');
  });
});

describe('ホーム画面に追加する手順の文', () => {
  it('どの端末の手順も、最後はホーム画面の印から開き直す', () => {
    for (const steps of Object.values(INSTALL_STEPS)) {
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps[steps.length - 1]).toContain(APP_NAME);
      expect(steps[steps.length - 1]).toContain('開き直します');
      for (const s of steps) expect(s.endsWith('。')).toBe(true);
    }
  });
});
