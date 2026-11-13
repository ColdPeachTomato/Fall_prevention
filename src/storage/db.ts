// IndexedDB の薄いラッパー。メニュー、記録、設定を端末内に保存する。
// 外部には一切送らない。

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Menu, SessionRecord, Settings } from '../data/types';
import { validateMenu } from '../menu/validate';

interface AppDB extends DBSchema {
  kv: {
    key: 'menu' | 'settings';
    value: unknown;
  };
  records: {
    key: string;
    value: SessionRecord;
    indexes: { date: string };
  };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

function db(): Promise<IDBPDatabase<AppDB>> {
  dbPromise ??= openDB<AppDB>('fall-prevention', 1, {
    upgrade(database) {
      database.createObjectStore('kv');
      const records = database.createObjectStore('records', { keyPath: 'id' });
      records.createIndex('date', 'date');
    },
  });
  return dbPromise;
}

// 保存データが勝手に消されにくくするよう、端末に永続化を頼む（断られても続行する）
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // 使えない端末では何もしない
  }
}

// 保存してあるメニューを読む。検証に通らないものは使わない
export async function loadMenu(): Promise<Menu | null> {
  const raw = await (await db()).get('kv', 'menu');
  if (raw === undefined) return null;
  const r = validateMenu(raw);
  return r.ok ? r.menu : null;
}

export async function saveMenu(menu: Menu, setAt: string): Promise<void> {
  const r = validateMenu(menu);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  const database = await db();
  const tx = database.transaction('kv', 'readwrite');
  const settings = ((await tx.store.get('settings')) as Settings | undefined) ?? {};
  await tx.store.put(r.menu, 'menu');
  await tx.store.put({ ...settings, menuSetAt: setAt } satisfies Settings, 'settings');
  await tx.done;
}

export async function loadSettings(): Promise<Settings> {
  return ((await (await db()).get('kv', 'settings')) as Settings | undefined) ?? {};
}

export async function addRecord(record: SessionRecord): Promise<void> {
  await (await db()).put('records', record);
}

export async function loadRecords(): Promise<SessionRecord[]> {
  return (await db()).getAllFromIndex('records', 'date');
}
