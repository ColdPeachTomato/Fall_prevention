// 手で作ったアニメ（S1）や、プレビューで手直しした JSON の字幕を整える。
// 使い方：node tools/tidy-captions.mjs src/data/animations/S1-side-L1.json ...
import { readFileSync, writeFileSync } from 'node:fs';
import { tidyCaptions } from './captions.mjs';

for (const file of process.argv.slice(2)) {
  const anim = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify(tidyCaptions(anim), null, 2) + '\n');
  console.log(file, '→', anim.captions.length, 'から', tidyCaptions(anim).captions.length, '個');
}
