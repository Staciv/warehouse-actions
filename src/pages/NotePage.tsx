import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '../db/database';
import { ReminderSheet } from '../components/ReminderSheet';
import { formatTimestamp } from '../utils/date';

export function NotePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const note = useLiveQuery(async () => {
    if (!id) return undefined;
    return db.notes.get(id);
  }, [id]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!note) return;
    setText(note.text);
  }, [note?.id, note?.text]);

  useEffect(() => {
    if (!note) return;

    const timer = setTimeout(() => {
      if (text === note.text) return;
      void db.notes.update(note.id, { text, updatedAt: now() });
    }, 180);

    return () => clearTimeout(timer);
  }, [text, note]);

  const canRender = useMemo(() => note !== undefined, [note]);

  if (!id || !canRender) {
    return (
      <main className="page grid-bg">
        <button className="ghost-btn" onClick={() => navigate('/')}>
          Назад
        </button>
        <p className="muted">Заметка не найдена.</p>
      </main>
    );
  }

  async function togglePinned() {
    await db.notes.update(id, { pinned: !note.pinned, updatedAt: now() });
  }

  async function toggleArchived() {
    await db.notes.update(id, { archived: !note.archived, updatedAt: now() });
  }

  async function remove() {
    const ok = window.confirm('Удалить заметку безвозвратно?');
    if (!ok) return;
    await db.notes.delete(id);
    navigate('/');
  }

  return (
    <main className="page note-page grid-bg">
      <header className="topbar">
        <button className="ghost-btn" onClick={() => navigate('/')}>
          Назад
        </button>
        <div className="actions">
          <button className={`icon-btn ${note.pinned ? 'active' : ''}`} onClick={togglePinned}>
            ⭐
          </button>
          <button className={`icon-btn ${note.archived ? 'active' : ''}`} onClick={toggleArchived}>
            🗄️
          </button>
          <button className="icon-btn danger" onClick={remove}>
            🗑️
          </button>
        </div>
      </header>

      <section className="glass-card note-editor-block">
        <textarea
          className="note-editor"
          placeholder="Запишите идею..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </section>

      <ReminderSheet note={{ ...note, text }} />

      <footer className="meta muted">
        <p>Создано: {formatTimestamp(note.createdAt)}</p>
        <p>Обновлено: {formatTimestamp(note.updatedAt)}</p>
      </footer>
    </main>
  );
}
