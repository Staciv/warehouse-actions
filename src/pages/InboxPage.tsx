import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmptyNote, db } from '../db/database';
import { Fab } from '../components/Fab';
import { FilterTabs } from '../components/FilterTabs';
import { NoteCard } from '../components/NoteCard';
import { useNotes, type NotesFilter } from '../hooks/useNotes';

export function InboxPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NotesFilter>('all');
  const notes = useNotes(search, filter);

  async function createNote() {
    const note = createEmptyNote();
    await db.notes.add(note);
    navigate(`/note/${note.id}`);
  }

  return (
    <main className="page inbox-page grid-bg">
      <header className="topbar">
        <h1>Ideas Space</h1>
        <button className="ghost-btn" onClick={() => navigate('/settings')}>
          Settings
        </button>
      </header>

      <section className="search-block glass-card">
        <input
          type="search"
          placeholder="Поиск мыслей..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterTabs active={filter} onChange={setFilter} />
      </section>

      <section className="notes-list">
        {notes?.length ? notes.map((note) => <NoteCard key={note.id} note={note} />) : <p className="muted">Нет заметок.</p>}
      </section>

      <Fab onClick={createNote} label="Создать заметку">
        +
      </Fab>
    </main>
  );
}
