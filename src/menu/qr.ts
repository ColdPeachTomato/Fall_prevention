// メニューコードを QR にする。小さなライブラリ（qrcode-generator、MIT ライセンス）を使う。
// 誤り訂正は、小さく収まるなら M（汚れや折り目に少し強い）にする。
// 種目が多くてマスが細かくなるとき（1辺が FINE を超えるとき）は、L にしてマスを粗くする（カメラで読み取りやすくする）。
// L でも入りきらないときは null（メニューコードの貼り付けで渡してもらう）。

import qrcode from 'qrcode-generator';

export interface QrMatrix {
  size: number; // 1辺のマスの数
  dark: boolean[][]; // [行][列]
  level: 'M' | 'L';
}

// 1辺のマスの数が、これを超えたら L にする
const FINE = 101;

function build(text: string, level: 'M' | 'L'): QrMatrix | null {
  try {
    const qr = qrcode(0, level);
    qr.addData(text, 'Byte');
    qr.make();
    const size = qr.getModuleCount();
    const dark = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => qr.isDark(r, c)));
    return { size, dark, level };
  } catch {
    return null; // 入りきらない
  }
}

export function makeQr(text: string): QrMatrix | null {
  const m = build(text, 'M');
  if (m && m.size <= FINE) return m;
  return build(text, 'L') ?? m;
}
