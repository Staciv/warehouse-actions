import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Note } from '../db/types';

export type NotesFilter = 'all' | 'pinned' | 'archived';

function sortNotes(notes: Note[]): Note[] {
  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function useNotes(search: string, filter: NotesFilter) {
  const query = search.trim().toLowerCase();

  return useLiveQuery(async () => {
    const all = await db.notes.toArray();

    const filtered = all.filter((note) => {
      if (filter === 'pinned' && !note.pinned) return false;
      if (filter === 'archived' && !note.archived) return false;
      if (filter === 'all' && note.archived) return false;
      if (!query) return true;
      return note.text.toLowerCase().includes(query);
    });

    return sortNotes(filtered);
  }, [query, filter]);
}
