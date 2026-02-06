import { Link } from 'react-router-dom';
import type { Note } from '../db/types';
import { formatTimestamp } from '../utils/date';

type NoteCardProps = {
  note: Note;
};

export function NoteCard({ note }: NoteCardProps) {
  const title = note.text.trim() ? note.text.trim().slice(0, 140) : 'Пустая заметка';

  return (
    <Link to={`/note/${note.id}`} className="note-card glass-card">
      <div className="note-card-top">
        <span className="dot" aria-hidden />
        {note.pinned && <span className="pill">Pinned</span>}
        {note.archived && <span className="pill">Archive</span>}
      </div>
      <p className="note-card-title">{title}</p>
      <p className="muted">Обновлено: {formatTimestamp(note.updatedAt)}</p>
    </Link>
  );
}
