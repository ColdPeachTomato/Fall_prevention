// ホーム。主なボタンは「今日の運動を始める」。

import { Button } from '../app/Button';
import { WEEKDAY_LABEL, formatJapaneseDate, today, weekDates } from '../app/dates';
import type { Menu, SessionRecord, Settings } from '../data/types';
import { reviewNotice } from '../safety/reviewNotice';

interface Props {
  menu: Menu | null;
  settings: Settings;
  records: SessionRecord[];
  onStart: (kind: 'standard' | 'short') => void;
  onWalk: () => void;
  onReview: () => void;
  onDoctor: () => void;
}

type DayMark = '運動' | '休み' | '歩行' | '';

function dayMarks(records: SessionRecord[], date: string): DayMark[] {
  const marks: DayMark[] = [];
  const onDay = records.filter((r) => r.date === date);
  if (onDay.some((r) => (r.kind === 'standard' || r.kind === 'short') && r.completed.length > 0)) marks.push('運動');
  if (onDay.some((r) => r.kind === 'walk')) marks.push('歩行');
  if (marks.length === 0 && onDay.some((r) => r.kind === 'rest')) marks.push('休み');
  return marks;
}

export function Home({ menu, settings, records, onStart, onWalk, onReview, onDoctor }: Props) {
  const todayStr = today();
  const week = weekDates(todayStr);
  const exerciseDays = week.filter((d) => dayMarks(records, d).includes('運動')).length;
  const notice = menu ? reviewNotice(menu, settings, records, todayStr) : null;

  return (
    <main className="screen">
      <h1>今日の運動</h1>
      <p className="muted">{formatJapaneseDate(todayStr)}</p>

      {!menu && (
        // S-1 メニューが未設定のときは始められない
        <section className="notice" role="status">
          <h2>メニューがまだありません</h2>
          <p>運動のメニューは医師が決めます。次の受診のときに、医師に設定してもらってください。</p>
        </section>
      )}

      {notice && (notice.fallOrNearMiss || notice.overdue) && (
        // S-11 医師に相談する時期の知らせ。運動は止めない
        <section className="notice" role="status">
          <h2>医師に相談する時期です</h2>
          {notice.fallOrNearMiss && <p>転んだこと・ヒヤリとしたことの記録があります。次の受診のときに医師に伝えてください。</p>}
          {notice.overdue && <p>メニューの見直しの時期（{formatJapaneseDate(notice.reviewDate)}）が来ました。医師にメニューを見てもらってください。</p>}
          <p>運動はこれまでどおり続けられます。</p>
        </section>
      )}

      {menu && (
        <div className="actions">
          <Button onClick={() => onStart('standard')}>今日の運動を始める</Button>
          {menu.short.length > 0 && (
            <Button variant="secondary" onClick={() => onStart('short')}>
              短い運動をする
            </Button>
          )}
          {menu.walking && (
            <Button variant="secondary" onClick={onWalk}>
              歩いた
            </Button>
          )}
        </div>
      )}

      <section className="week" aria-label="今週の実施状況">
        <h2>今週の運動：{exerciseDays}日</h2>
        <ol className="week-days">
          {week.map((d, i) => {
            const marks = dayMarks(records, d);
            return (
              <li key={d} className={`week-day${d === todayStr ? ' is-today' : ''}${marks.length ? ' has-mark' : ''}`}>
                <span className="week-label">{WEEKDAY_LABEL[i]}</span>
                <span className="week-mark">{marks.length ? marks.join('・') : '－'}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="footer-link">
        <button type="button" className="text-link" onClick={onReview}>
          これまでの記録を見る
        </button>
        <button type="button" className="text-link" onClick={onDoctor}>
          医師用の設定
        </button>
      </div>
    </main>
  );
}
