// メニューの内容を一覧で見せる（医師用）

import { addDays } from '../app/dates';
import { getExercise } from '../data/exercises';
import { UNIT_LABEL } from '../data/limits';
import type { Menu, MenuItem } from '../data/types';
import { SUPPORT_LABEL } from '../menu/support';

function ItemList({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return <p className="muted">なし</p>;
  return (
    <ol className="summary-list">
      {items.map((i) => {
        const ex = getExercise(i.ex);
        return (
          <li key={i.ex}>
            {i.ex} {ex.name}：レベル{i.level}、{i.amount}
            {UNIT_LABEL[ex.unit]}
            {ex.bilateral ? '（片側ずつ）' : ''}
            {ex.directions ? `（${ex.directions[0]}・${ex.directions[1]}を各${i.amount}${UNIT_LABEL[ex.unit]}）` : ''} × {i.sets}セット
          </li>
        );
      })}
    </ol>
  );
}

export function MenuSummary({ menu }: { menu: Menu }) {
  return (
    <div className="summary">
      <dl>
        <dt>作成日</dt>
        <dd>
          {menu.issuedOn}（見直しの目安：{addDays(menu.issuedOn, menu.reviewAfterDays)}、{menu.reviewAfterDays}日後）
        </dd>
        <dt>立って行う種目の支え</dt>
        <dd>{SUPPORT_LABEL[menu.support]}</dd>
        <dt>強度の上限</dt>
        <dd>{menu.intensityCap}</dd>
        <dt>歩行</dt>
        <dd>{menu.walking ? `1回 ${menu.walking.minutes}分、週 ${menu.walking.daysPerWeek}日` : 'なし'}</dd>
      </dl>
      <h3>標準セッション</h3>
      <ItemList items={menu.standard} />
      <h3>短いセッション</h3>
      <ItemList items={menu.short} />
    </div>
  );
}
