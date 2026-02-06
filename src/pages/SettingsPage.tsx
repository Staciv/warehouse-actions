import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '../db/database';
import type { ExportPayload } from '../db/types';
import { InstallHint } from '../components/InstallHint';

export function SettingsPage() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const settings = useLiveQuery(() => db.settings.get('main'), []);

  async function exportJson() {
    const notes = await db.notes.toArray();
    const settings =
      (await db.settings.get('main')) ??
      ({ id: 'main', installHintDismissed: false, updatedAt: now() } as const);

    const payload: ExportPayload = {
      schemaVersion: 1,
      notes,
      settings
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ideas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as Partial<ExportPayload>;

    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.notes) || !parsed.settings) {
      throw new Error('Неверный формат backup файла');
    }

    const ok = window.confirm('Импорт заменит текущие локальные данные. Продолжить?');
    if (!ok) return;

    await db.transaction('rw', db.notes, db.settings, async () => {
      await db.notes.clear();
      await db.notes.bulkAdd(parsed.notes);
      await db.settings.put(parsed.settings);
    });

    window.alert('Импорт завершен.');
    navigate('/');
  }

  return (
    <main className="page settings-page grid-bg">
      <header className="topbar">
        <button className="ghost-btn" onClick={() => navigate('/')}>
          Назад
        </button>
        <h1>Settings</h1>
      </header>

      <section className="glass-card settings-block">
        <h2>Резервная копия</h2>
        <button className="primary-btn" onClick={exportJson}>
          Экспорт JSON
        </button>

        <input
          ref={fileRef}
          className="file-input"
          type="file"
          accept="application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              await importJson(file);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Ошибка импорта';
              window.alert(message);
            } finally {
              event.target.value = '';
            }
          }}
        />
        <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
          Импорт JSON
        </button>
      </section>

      <InstallHint
        dismissed={dismissed || Boolean(settings?.installHintDismissed)}
        onDismissed={() => setDismissed(true)}
      />
    </main>
  );
}
