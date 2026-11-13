// 画面の切り替えと全体の状態。ルーターは使わず、状態で画面を切り替える。

import { useCallback, useEffect, useState } from 'react';
import type { Menu, SessionKind, SessionRecord, Settings, StopReason } from '../data/types';
import { CONSULT_TEXT } from '../safety/texts';
import { Doctor } from '../screens/Doctor';
import { End, type EndResult } from '../screens/End';
import { Home } from '../screens/Home';
import { Message } from '../screens/Message';
import { PinEntry } from '../screens/PinEntry';
import { Player } from '../screens/Player';
import { PreCheck } from '../screens/PreCheck';
import { WalkConfirm } from '../screens/WalkConfirm';
import { addRecord, loadMenu, loadRecords, loadSettings, requestPersistence, saveMenu } from '../storage/db';
import { today } from './dates';

type Screen =
  | { name: 'home' }
  | { name: 'precheck'; kind: SessionKind }
  | { name: 'player'; kind: SessionKind }
  | { name: 'end'; kind: SessionKind; completed: string[]; stopped?: { ex: string; reason: StopReason } }
  | { name: 'message'; title: string; lines: string[] }
  | { name: 'walk' }
  | { name: 'pin' }
  | { name: 'doctor' };

interface Data {
  menu: Menu | null;
  settings: Settings;
  records: SessionRecord[];
}

function newRecord(fields: Omit<SessionRecord, 'id' | 'date' | 'createdAt'>): SessionRecord {
  return { id: crypto.randomUUID(), date: today(), createdAt: new Date().toISOString(), ...fields };
}

export function App() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreenState] = useState<Screen>({ name: 'home' });

  const reload = useCallback(async () => {
    const [menu, settings, records] = await Promise.all([loadMenu(), loadSettings(), loadRecords()]);
    setData({ menu, settings, records });
  }, []);

  useEffect(() => {
    void requestPersistence();
    reload().catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  const setScreen = (s: Screen) => {
    setScreenState(s);
    window.scrollTo({ top: 0 });
  };

  const save = async (record: SessionRecord) => {
    await addRecord(record);
    await reload();
  };

  if (loadError) {
    return (
      <main className="screen">
        <h1>データを読み込めませんでした</h1>
        <p>{loadError}</p>
      </main>
    );
  }
  if (!data) return <main className="screen" aria-busy="true" />;

  const { menu } = data;
  const home = () => setScreen({ name: 'home' });

  switch (screen.name) {
    case 'home':
      return (
        <Home
          menu={menu}
          settings={data.settings}
          records={data.records}
          onStart={(kind) => {
            // S-1 メニューが未設定のときは始められない
            if (menu) setScreen({ name: 'precheck', kind });
          }}
          onWalk={() => setScreen({ name: 'walk' })}
          onDoctor={() => setScreen({ name: 'pin' })}
        />
      );

    case 'precheck':
      if (!menu) return null;
      return (
        <PreCheck
          menu={menu}
          onRest={async (reason) => {
            await save(newRecord({ kind: 'rest', completed: [], fall: false, nearMiss: false }));
            setScreen({
              name: 'message',
              title: '今日はお休みにしました',
              lines:
                reason === 'symptom'
                  ? ['今日は体を休めましょう。', CONSULT_TEXT]
                  : ['体を休めることも大切です。', 'また次の日に運動しましょう。'],
            });
          }}
          onBegin={() => setScreen({ name: 'player', kind: screen.kind })}
        />
      );

    case 'player':
      if (!menu) return null;
      return (
        <Player
          menu={menu}
          kind={screen.kind}
          onFinish={(completed) => setScreen({ name: 'end', kind: screen.kind, completed })}
          onStop={(stopped, completed) => setScreen({ name: 'end', kind: screen.kind, completed, stopped })}
        />
      );

    case 'end':
      return (
        <End
          stoppedReason={screen.stopped?.reason}
          onSave={async (r: EndResult) => {
            const record = newRecord({
              kind: screen.kind,
              completed: screen.completed,
              exertion: r.exertion,
              fall: r.fall,
              nearMiss: r.nearMiss,
            });
            if (screen.stopped) record.stopped = screen.stopped;
            await save(record);
            if (r.fall || r.nearMiss) {
              // S-11 医師に相談する時期の知らせ。運動は止めない
              setScreen({
                name: 'message',
                title: '記録しました',
                lines: ['転んだこと・ヒヤリとしたことを、次の受診のときに医師に伝えてください。', '運動はこれまでどおり続けられます。'],
              });
            } else {
              home();
            }
          }}
        />
      );

    case 'walk':
      if (!menu?.walking) return null;
      return (
        <WalkConfirm
          minutes={menu.walking.minutes}
          onBack={home}
          onConfirm={async () => {
            await save(newRecord({ kind: 'walk', completed: [], fall: false, nearMiss: false, walkMinutes: menu.walking!.minutes }));
            setScreen({ name: 'message', title: '記録しました', lines: [`${menu.walking!.minutes}分の歩行を記録しました。`] });
          }}
        />
      );

    case 'message':
      return <Message title={screen.title} lines={screen.lines} onDone={home} />;

    case 'pin':
      return <PinEntry onSuccess={() => setScreen({ name: 'doctor' })} onBack={home} />;

    case 'doctor':
      return (
        <Doctor
          menu={menu}
          onSave={async (m) => {
            await saveMenu(m, new Date().toISOString());
            await reload();
          }}
          onExit={home}
        />
      );
  }
}
