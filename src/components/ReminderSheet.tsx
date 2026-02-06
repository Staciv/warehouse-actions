import { useMemo, useState } from 'react';
import type { Note } from '../db/types';
import { toDatetimeLocalValue } from '../utils/date';
import { downloadReminderIcs, type ReminderLead } from '../utils/ics';

type ReminderSheetProps = {
  note: Note;
};

const options: { value: ReminderLead; label: string }[] = [
  { value: 0, label: 'Без опережения' },
  { value: 5, label: 'За 5 минут' },
  { value: 10, label: 'За 10 минут' },
  { value: 30, label: 'За 30 минут' },
  { value: 60, label: 'За 1 час' },
  { value: 1440, label: 'За 1 день' }
];

export function ReminderSheet({ note }: ReminderSheetProps) {
  const [open, setOpen] = useState(false);
  const [startAt, setStartAt] = useState(() => toDatetimeLocalValue(Date.now() + 30 * 60_000));
  const [lead, setLead] = useState<ReminderLead>(5);
  const canCreate = useMemo(() => Boolean(startAt), [startAt]);

  return (
    <section className={`reminder-sheet glass-card ${open ? 'open' : ''}`}>
      <button className="sheet-toggle" type="button" onClick={() => setOpen((v) => !v)}>
        Напоминание
      </button>

      {open && (
        <div className="sheet-body">
          <label className="field">
            <span className="field-label">Дата и время</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Напомнить заранее</span>
            <select value={lead} onChange={(event) => setLead(Number(event.target.value) as ReminderLead)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="primary-btn"
            disabled={!canCreate}
            onClick={() => downloadReminderIcs(note, startAt, lead)}
          >
            Добавить в календарь (.ics)
          </button>
        </div>
      )}
    </section>
  );
}
