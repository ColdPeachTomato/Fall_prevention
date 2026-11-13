// 仮の静止画（フェーズ2でCanvasのアニメに置き換える）。
// つかまる所（椅子の背・カウンター）は常に描く。

import type { Posture } from '../data/types';

interface Props {
  posture: Posture;
}

export function PlaceholderFigure({ posture }: Props) {
  return (
    <figure className="placeholder-figure">
      <svg viewBox="0 0 200 200" role="img" aria-label={posture === 'sitting' ? '椅子に座った人の絵' : 'つかまる所の横に立つ人の絵'}>
        <rect x="0" y="0" width="200" height="200" fill="#f3efe6" />
        <line x1="10" y1="185" x2="190" y2="185" stroke="#8a8170" strokeWidth="4" />
        {posture === 'sitting' ? (
          <g>
            {/* 椅子 */}
            <rect x="70" y="120" width="60" height="8" fill="#9b8f7a" />
            <rect x="122" y="60" width="8" height="68" fill="#9b8f7a" />
            <rect x="72" y="128" width="6" height="57" fill="#9b8f7a" />
            <rect x="122" y="128" width="6" height="57" fill="#9b8f7a" />
            {/* 人 */}
            <circle cx="100" cy="52" r="15" fill="#2f6e8f" />
            <rect x="90" y="68" width="22" height="52" rx="10" fill="#2f6e8f" />
            <rect x="62" y="110" width="44" height="14" rx="7" fill="#2f6e8f" />
            <rect x="60" y="112" width="13" height="70" rx="6" fill="#2f6e8f" />
          </g>
        ) : (
          <g>
            {/* カウンター */}
            <rect x="130" y="95" width="60" height="10" fill="#9b8f7a" />
            <rect x="170" y="105" width="10" height="80" fill="#9b8f7a" />
            {/* 人 */}
            <circle cx="90" cy="40" r="15" fill="#2f6e8f" />
            <rect x="78" y="57" width="24" height="62" rx="11" fill="#2f6e8f" />
            <rect x="80" y="112" width="11" height="73" rx="5" fill="#2f6e8f" />
            <rect x="90" y="112" width="11" height="73" rx="5" fill="#2f6e8f" />
            <rect x="95" y="64" width="44" height="10" rx="5" fill="#2f6e8f" transform="rotate(25 95 64)" />
          </g>
        )}
      </svg>
      <figcaption>動きの見本は準備中です</figcaption>
    </figure>
  );
}
