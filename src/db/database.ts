import Dexie, { type Table } from 'dexie';
import type { AppSettings, Note } from './types';

class IdeasDatabase extends Dexie {
  notes!: Table<Note, string>;
  settings!: Table<AppSettings, 'main'>;

  constructor() {
    super('ideas_reminders_db');
    this.version(1).stores({
      notes: 'id, updatedAt, pinned, archived',
      settings: 'id, updatedAt'
    });
  }
}

export const db = new IdeasDatabase();

export const now = () => Date.now();

export function createEmptyNote(): Note {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    text: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    pinned: false,
    archived: false
  };
}
