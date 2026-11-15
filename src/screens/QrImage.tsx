// QR を絵（SVG）にする。まわりに4マス分の余白を取る（読み取りに必要）。

import type { QrMatrix } from '../menu/qr';

export function QrImage({ qr, label }: { qr: QrMatrix; label: string }) {
  const margin = 4;
  const side = qr.size + margin * 2;
  // 横に続く黒いマスを、1本の線としてまとめて描く
  let path = '';
  for (let r = 0; r < qr.size; r++) {
    let c = 0;
    while (c < qr.size) {
      if (!qr.dark[r]![c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < qr.size && qr.dark[r]![end]) end++;
      path += `M${c + margin} ${r + margin}h${end - c}v1h${c - end}z`;
      c = end;
    }
  }
  return (
    <svg className="qr-image" viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={side} height={side} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
