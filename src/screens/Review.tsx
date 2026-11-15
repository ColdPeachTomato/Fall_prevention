// 振り返り（本人と医師）。直近12週の記録を、週ごとに見せる。
// 評価や判定はしない。記録にある事実を並べるだけ。休んだ日を責める表現は使わない。

import { Button } from '../app/Button';
import { WEEKDAY_LABEL, formatJapaneseDate, today } from '../app/dates';
import { REVIEW_WEEKS, summarize } from '../app/review';
import { findExercise } from '../data/exercises';
import type { Menu, SessionRecord } from '../data/types';
import { EXERTION_LABELS, STOP_REASONS } from '../safety/texts';
import { MenuSummary } from './MenuSummary';

interface Props {
  menu: Menu | null;
  records: SessionRecord[];
  onBack: () => void;
}

export function Review({ menu, records, onBack }: Props) {
  const s = summarize(records, today());
  const newestFirst = [...s.weeks].reverse();
  const reasonLabel = (id: string) => STOP_REASONS.find((r) => r.id === id)?.label ?? id;

  return (
    <main className="screen review">
      <h1>これまでの記録</h1>
      <p className="muted">
        {formatJapaneseDate(s.from)}〜{formatJapaneseDate(s.to)}（{REVIEW_WEEKS}週間）
      </p>

      <section>
        <h2>{REVIEW_WEEKS}週間の合計</h2>
        <ul className="review-totals">
          <li>
            運動した日：<strong>{s.totals.exerciseDays}日</strong>（標準 {s.totals.standard}回、短い運動 {s.totals.short}回）
          </li>
          <li>
            歩行を記録した日：<strong>{s.totals.walkDays}日</strong>
          </li>
          <li>
            お休みにした日：<strong>{s.totals.restDays}日</strong>
          </li>
          <li>
            転んだ記録：<strong>{s.totals.falls}回</strong>、ヒヤリとした記録：<strong>{s.totals.nearMisses}回</strong>
          </li>
        </ul>
      </section>

      <section>
        <h2>週ごとの記録</h2>
        <p className="muted">新しい週が上です。印は 運＝運動、歩＝歩行、休＝お休み です。</p>
        <ol className="review-weeks">
          {newestFirst.map((w) => (
            <li key={w.start} className="review-week">
              <p className="review-week-head">
                <strong>
                  {formatJapaneseDate(w.start)}〜{formatJapaneseDate(w.end)}
                </strong>
                　運動 {w.exerciseDays}日
                {w.walkDays > 0 && `、歩行 ${w.walkDays}日`}
                {w.restDays > 0 && `、お休み ${w.restDays}日`}
              </p>
              <ol className="review-days" aria-label="この週の1日ずつの記録">
                {w.days.map((d, i) => {
                  const marks = [d.exercised && '運', d.walked && '歩', d.rested && '休'].filter(Boolean).join('');
                  return (
                    <li key={d.date} className={`review-day${marks ? ' has-mark' : ''}`}>
                      <span className="week-label">{WEEKDAY_LABEL[i]}</span>
                      <span className="week-mark">{marks || '－'}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="review-week-detail">
                標準 {w.standard}回、短い運動 {w.short}回
                {w.exertionAverage !== null && `　きつさの平均 ${w.exertionAverage.toFixed(1)}（記録 ${w.exertion.length}回）`}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>きつさの記録</h2>
        <p className="muted">1 とても楽 〜 5 とてもきつい</p>
        {s.exertion.length === 0 ? (
          <p>記録はありません。</p>
        ) : (
          <ol className="review-list">
            {[...s.exertion].reverse().map((e, i) => (
              <li key={`${e.date}-${i}`}>
                {formatJapaneseDate(e.date)}：{e.value}（{EXERTION_LABELS[e.value as 1 | 2 | 3 | 4 | 5]}）
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2>転んだ・ヒヤリとした記録</h2>
        {s.incidents.length === 0 ? (
          <p>記録はありません。</p>
        ) : (
          <>
            <ol className="review-list">
              {[...s.incidents].reverse().map((e, i) => (
                <li key={`${e.date}-${i}`}>
                  {formatJapaneseDate(e.date)}：{[e.fall && '転んだ', e.nearMiss && 'ヒヤリとした'].filter(Boolean).join('、')}
                </li>
              ))}
            </ol>
            <p>受診のときに、医師に伝えてください。</p>
          </>
        )}
      </section>

      <section>
        <h2>途中で中止した記録</h2>
        {s.stops.length === 0 ? (
          <p>記録はありません。</p>
        ) : (
          <ol className="review-list">
            {[...s.stops].reverse().map((e, i) => (
              <li key={`${e.date}-${i}`}>
                {formatJapaneseDate(e.date)}：{findExercise(e.ex)?.name ?? e.ex}（理由：{reasonLabel(e.reason)}）
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2>いまのメニュー</h2>
        {menu ? <MenuSummary menu={menu} /> : <p>メニューはまだ設定されていません。</p>}
      </section>

      <div className="actions">
        <Button onClick={onBack}>戻る</Button>
      </div>
    </main>
  );
}
