import type { Note } from '../db/types';

export type ReminderLead = 0 | 5 | 10 | 30 | 60 | 1440;

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function toUtcIcsDate(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function toLocalIcsDate(input: string): string {
  // input is datetime-local format: YYYY-MM-DDTHH:mm
  return input.replace(/[-:]/g, '') + '00';
}

function triggerFromLead(leadMinutes: ReminderLead): string | null {
  if (leadMinutes === 0) return null;
  switch (leadMinutes) {
    case 5:
      return '-PT5M';
    case 10:
      return '-PT10M';
    case 30:
      return '-PT30M';
    case 60:
      return '-PT1H';
    case 1440:
      return '-P1D';
    default:
      return null;
  }
}

export function buildIcsContent(note: Note, startLocal: string, leadMinutes: ReminderLead): string {
  const start = new Date(startLocal);
  const end = new Date(start.getTime() + 15 * 60_000);
  const uid = `${note.id}-${start.getTime()}@ideas-reminders.local`;

  const summarySource = note.text.trim() || 'Идея';
  const summary = escapeIcsText(summarySource.slice(0, 60));
  const description = escapeIcsText(note.text || '');
  const dtStartLocal = toLocalIcsDate(startLocal);
  const dtEndLocal = toLocalIcsDate(
    `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(
      2,
      '0'
    )}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
  );
  const dtStamp = toUtcIcsDate(new Date());

  const alarmTrigger = triggerFromLead(leadMinutes);
  const alarmBlock =
    alarmTrigger === null
      ? ''
      : [
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${summary}`,
          `TRIGGER:${alarmTrigger}`,
          'END:VALARM'
        ].join('\r\n') + '\r\n';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ideas Reminder//RU//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStartLocal}`,
    `DTEND:${dtEndLocal}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    alarmBlock + 'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadReminderIcs(note: Note, startLocal: string, leadMinutes: ReminderLead): void {
  const content = buildIcsContent(note, startLocal, leadMinutes);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (note.text.trim().slice(0, 30) || 'reminder').replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, '_');

  a.href = url;
  a.download = `${slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
