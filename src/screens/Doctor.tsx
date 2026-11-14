// 医師用設定。現在のメニューを見て、作成・変更する。

import { useState } from 'react';
import { today } from '../app/dates';
import { EXERCISES, isSelectableInEditor } from '../data/exercises';
import {
  AMOUNT_RANGE,
  DEFAULT_REVIEW_DAYS,
  REVIEW_DAYS_RANGE,
  SETS_RANGE,
  UNIT_LABEL,
  WALK_DAYS_RANGE,
  WALK_MINUTES_RANGE,
  defaultAmount,
} from '../data/limits';
import type { Exercise, Level, Menu, MenuItem, SessionKind, SupportStage } from '../data/types';
import { SUPPORT_LABEL } from '../menu/support';
import { validateMenu } from '../menu/validate';
import { MenuSummary } from './MenuSummary';

interface Props {
  menu: Menu | null;
  onSave: (menu: Menu) => Promise<void>;
  onExit: () => void;
}

interface DraftItem {
  selected: boolean;
  level: Level;
  amount: number;
  sets: number;
}

interface Draft {
  issuedOn: string;
  reviewAfterDays: number;
  support: SupportStage;
  intensityCap: string;
  standard: Record<string, DraftItem>;
  short: Record<string, DraftItem>;
  walkingOn: boolean;
  walkMinutes: number;
  walkDays: number;
}

const SELECTABLE = EXERCISES.filter(isSelectableInEditor);
const NOT_SELECTABLE = EXERCISES.filter((e) => e.category !== 'walking' && !isSelectableInEditor(e));
const SUPPORT_OPTIONS: SupportStage[] = ['both', 'one', 'fingertip', 'none'];
const SESSION_LABEL: Record<SessionKind, string> = { standard: '標準セッション（約30分）', short: '短いセッション（約10分）' };

function draftItems(items: MenuItem[] | undefined): Record<string, DraftItem> {
  const result: Record<string, DraftItem> = {};
  for (const ex of SELECTABLE) {
    const found = items?.find((i) => i.ex === ex.id);
    const d = defaultAmount(ex);
    result[ex.id] = found
      ? { selected: true, level: found.level, amount: found.amount, sets: found.sets }
      : { selected: false, level: ex.variants[0]!.level, amount: d.amount, sets: d.sets };
  }
  return result;
}

function initialDraft(menu: Menu | null): Draft {
  return {
    issuedOn: today(),
    reviewAfterDays: menu?.reviewAfterDays ?? DEFAULT_REVIEW_DAYS,
    support: menu?.support ?? 'both',
    intensityCap: menu?.intensityCap ?? '',
    standard: draftItems(menu?.standard),
    short: draftItems(menu?.short),
    walkingOn: menu?.walking !== undefined,
    walkMinutes: menu?.walking?.minutes ?? Number.NaN,
    walkDays: menu?.walking?.daysPerWeek ?? Number.NaN,
  };
}

function toMenu(d: Draft): unknown {
  const items = (rec: Record<string, DraftItem>): MenuItem[] =>
    SELECTABLE.filter((ex) => rec[ex.id]?.selected).map((ex) => {
      const i = rec[ex.id]!;
      return { ex: ex.id, level: i.level, amount: i.amount, sets: i.sets };
    });
  const menu: Record<string, unknown> = {
    v: 1,
    issuedOn: d.issuedOn,
    reviewAfterDays: d.reviewAfterDays,
    support: d.support,
    intensityCap: d.intensityCap,
    standard: items(d.standard),
    short: items(d.short),
  };
  if (d.walkingOn) menu.walking = { minutes: d.walkMinutes, daysPerWeek: d.walkDays };
  return menu;
}

function num(v: string): number {
  return v.trim() === '' ? Number.NaN : Number(v);
}

function numValue(n: number): string | number {
  return Number.isNaN(n) ? '' : n;
}

function ExerciseRow({ ex, item, onChange }: { ex: Exercise; item: DraftItem; onChange: (i: DraftItem) => void }) {
  const range = ex.unit === 'minutes' ? null : AMOUNT_RANGE[ex.unit];
  return (
    <li className={`editor-row${item.selected ? ' is-selected' : ''}`}>
      <label className="editor-check">
        <input type="checkbox" checked={item.selected} onChange={(e) => onChange({ ...item, selected: e.target.checked })} />
        {ex.id} {ex.name}
        {ex.bilateral && <span className="muted">（片側ずつ）</span>}
        {ex.directions && (
          <span className="muted">
            （{ex.directions[0]}・{ex.directions[1]}を、それぞれこの回数）
          </span>
        )}
      </label>
      {item.selected && (
        <div className="editor-fields">
          <label>
            レベル
            <select value={item.level} onChange={(e) => onChange({ ...item, level: Number(e.target.value) as Level })}>
              {ex.variants.map((v) => (
                <option key={v.level} value={v.level}>
                  {v.level}
                </option>
              ))}
            </select>
          </label>
          <label>
            量（{UNIT_LABEL[ex.unit]}
            {range && `、${range.min}〜${range.max}`}）
            <input
              type="number"
              inputMode="numeric"
              min={range?.min}
              max={range?.max}
              value={numValue(item.amount)}
              onChange={(e) => onChange({ ...item, amount: num(e.target.value) })}
            />
          </label>
          <label>
            セット（{SETS_RANGE.min}〜{SETS_RANGE.max}）
            <input
              type="number"
              inputMode="numeric"
              min={SETS_RANGE.min}
              max={SETS_RANGE.max}
              value={numValue(item.sets)}
              onChange={(e) => onChange({ ...item, sets: num(e.target.value) })}
            />
          </label>
        </div>
      )}
    </li>
  );
}

export function Doctor({ menu, onSave, onExit }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const [draft, setDraft] = useState<Draft>(() => initialDraft(menu));
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Menu | null>(null);
  const [saving, setSaving] = useState(false);

  if (mode === 'view') {
    return (
      <main className="screen doctor">
        <h1>医師用の設定</h1>
        <section>
          <h2>現在のメニュー</h2>
          {menu ? <MenuSummary menu={menu} /> : <p>メニューはまだ設定されていません。</p>}
        </section>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setDraft(initialDraft(menu));
              setErrors([]);
              setMode('edit');
            }}
          >
            {menu ? 'メニューを変える' : 'メニューを作る'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExit}>
            本人用の画面に戻る
          </button>
        </div>
      </main>
    );
  }

  if (mode === 'confirm' && pending) {
    return (
      <main className="screen doctor">
        <h1>このメニューで保存しますか</h1>
        <MenuSummary menu={pending} />
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(pending);
                setMode('view');
              } catch (e) {
                setErrors([e instanceof Error ? e.message : '保存できませんでした']);
                setMode('edit');
              } finally {
                setSaving(false);
              }
            }}
          >
            保存する
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMode('edit')}>
            直す
          </button>
        </div>
      </main>
    );
  }

  const setItem = (kind: SessionKind, id: string, item: DraftItem) =>
    setDraft({ ...draft, [kind]: { ...draft[kind], [id]: item } });

  return (
    <main className="screen doctor">
      <h1>{menu ? 'メニューを変える' : 'メニューを作る'}</h1>
      <p className="muted">メニューに氏名や生年月日など、個人を特定する情報は入れないでください。</p>

      <section className="editor-section">
        <label>
          作成日
          <input type="date" value={draft.issuedOn} onChange={(e) => setDraft({ ...draft, issuedOn: e.target.value })} />
        </label>
        <label>
          見直し日数（{REVIEW_DAYS_RANGE.min}〜{REVIEW_DAYS_RANGE.max}日）
          <input
            type="number"
            inputMode="numeric"
            value={numValue(draft.reviewAfterDays)}
            onChange={(e) => setDraft({ ...draft, reviewAfterDays: num(e.target.value) })}
          />
        </label>
        <label>
          立って行う種目の支え
          <select value={draft.support} onChange={(e) => setDraft({ ...draft, support: e.target.value as SupportStage })}>
            {SUPPORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SUPPORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          強度の上限（本人に毎回表示します）
          <input
            type="text"
            placeholder="例：ややきつい と感じるところまで"
            value={draft.intensityCap}
            onChange={(e) => setDraft({ ...draft, intensityCap: e.target.value })}
          />
        </label>
      </section>

      {(['standard', 'short'] as const).map((kind) => (
        <section key={kind} className="editor-section">
          <h2>{SESSION_LABEL[kind]}</h2>
          <ul className="editor-list">
            {SELECTABLE.map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} item={draft[kind][ex.id]!} onChange={(i) => setItem(kind, ex.id, i)} />
            ))}
          </ul>
        </section>
      ))}

      <section className="editor-section">
        <h2>歩行</h2>
        <label className="editor-check">
          <input type="checkbox" checked={draft.walkingOn} onChange={(e) => setDraft({ ...draft, walkingOn: e.target.checked })} />
          歩行をメニューに入れる
        </label>
        {draft.walkingOn && (
          <div className="editor-fields">
            <label>
              1回の時間（{WALK_MINUTES_RANGE.min}〜{WALK_MINUTES_RANGE.max}分）
              <input
                type="number"
                inputMode="numeric"
                value={numValue(draft.walkMinutes)}
                onChange={(e) => setDraft({ ...draft, walkMinutes: num(e.target.value) })}
              />
            </label>
            <label>
              週の日数（{WALK_DAYS_RANGE.min}〜{WALK_DAYS_RANGE.max}日）
              <input
                type="number"
                inputMode="numeric"
                value={numValue(draft.walkDays)}
                onChange={(e) => setDraft({ ...draft, walkDays: num(e.target.value) })}
              />
            </label>
          </div>
        )}
      </section>

      <section className="editor-section">
        <h2>選べない種目</h2>
        <p className="muted">次の高リスクの種目は、動きの見本（アニメ）の確認が済むまで選べません。</p>
        <p className="muted">{NOT_SELECTABLE.map((e) => `${e.id} ${e.name}`).join('、')}</p>
      </section>

      {errors.length > 0 && (
        <section className="notice notice-warn" role="alert">
          <h2>直してください</h2>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const r = validateMenu(toMenu(draft));
            if (!r.ok) {
              setErrors(r.errors);
              window.scrollTo({ top: document.body.scrollHeight });
              return;
            }
            setErrors([]);
            setPending(r.menu);
            setMode('confirm');
            window.scrollTo({ top: 0 });
          }}
        >
          確認へ進む
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setMode('view')}>
          変えずに戻る
        </button>
      </div>
    </main>
  );
}
