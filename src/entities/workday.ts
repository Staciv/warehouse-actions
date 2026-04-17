import type { WorkDay, WorkLogEntry } from '../types/domain';

export interface TimeGap {
  from: string;
  to: string;
  minutes: number;
}

export interface TimeOverlap {
  entryAId: string;
  entryBId: string;
  from: string;
  to: string;
}

const toMs = (value?: string) => {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
};

export const toDateKey = (iso: string) => iso.slice(0, 10);

export const toIsoByDateAndTime = (dateKey: string, time: string) => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${dateKey}T${normalizedTime}`).toISOString();
};

export const ensureEndAfterStart = (startTime: string, endTime: string) => {
  const startMs = toMs(startTime);
  const endMs = toMs(endTime);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 'Niepoprawny format czasu.';
  if (endMs <= startMs) return 'Czas zakończenia musi być późniejszy niż rozpoczęcia.';
  return null;
};

export const calculateMinutes = (startTime: string, endTime: string) => {
  const startMs = toMs(startTime);
  const endMs = toMs(endTime);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.max(1, Math.round((endMs - startMs) / 60000));
};

export const sortWorkEntries = (entries: WorkLogEntry[]) => {
  return [...entries].sort((a, b) => toMs(a.startTime) - toMs(b.startTime));
};

export const detectOverlaps = (entries: WorkLogEntry[]): TimeOverlap[] => {
  const sorted = sortWorkEntries(entries.filter((entry) => entry.endTime));
  const overlaps: TimeOverlap[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const currentEnd = toMs(current.endTime);
    for (let j = i + 1; j < sorted.length; j += 1) {
      const next = sorted[j];
      const nextStart = toMs(next.startTime);
      if (nextStart >= currentEnd) break;
      overlaps.push({
        entryAId: current.id,
        entryBId: next.id,
        from: next.startTime,
        to: current.endTime as string
      });
    }
  }

  return overlaps;
};

export const detectGaps = (
  entries: WorkLogEntry[],
  thresholdMinutes = 5
): TimeGap[] => {
  const sorted = sortWorkEntries(entries.filter((entry) => entry.endTime));
  const gaps: TimeGap[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd = toMs(prev.endTime);
    const currStart = toMs(curr.startTime);
    const diffMinutes = Math.round((currStart - prevEnd) / 60000);
    if (diffMinutes > thresholdMinutes) {
      gaps.push({
        from: prev.endTime as string,
        to: curr.startTime,
        minutes: diffMinutes
      });
    }
  }

  return gaps;
};

export const hasActiveWorkEntry = (entries: WorkLogEntry[]) => entries.some((entry) => !entry.endTime);

export const summarizeWorkDay = (day: WorkDay, entries: WorkLogEntry[]) => {
  const workedMinutes = entries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0);
  const gaps = detectGaps(entries);
  const gapMinutes = gaps.reduce((sum, gap) => sum + gap.minutes, 0);
  const presenceMinutes = day.actualEnd ? calculateMinutes(day.actualStart, day.actualEnd) : 0;

  return {
    totalWorkedMinutes: workedMinutes,
    totalGapMinutes: gapMinutes,
    totalPresenceMinutes: presenceMinutes
  };
};

export const evaluateDayClose = (plannedEnd: string, actualEnd: string) => {
  const plannedMs = toMs(plannedEnd);
  const actualMs = toMs(actualEnd);
  if (!Number.isFinite(plannedMs) || !Number.isFinite(actualMs)) {
    return { earlyByMinutes: 0, shouldRoundToPlanned: false, countedEnd: actualEnd };
  }
  const earlyByMinutes = Math.max(0, Math.round((plannedMs - actualMs) / 60000));
  const shouldRoundToPlanned = earlyByMinutes > 0 && earlyByMinutes <= 15;
  return {
    earlyByMinutes,
    shouldRoundToPlanned,
    countedEnd: shouldRoundToPlanned ? plannedEnd : actualEnd
  };
};

export const validateEntryInWorkDayBounds = (
  day: Pick<WorkDay, 'actualStart' | 'actualEnd' | 'date'>,
  startTime: string,
  endTime: string
) => {
  const startMs = toMs(startTime);
  const endMs = toMs(endTime);
  const dayStartMs = toMs(day.actualStart);
  const dayEndMs = day.actualEnd ? toMs(day.actualEnd) : Number.POSITIVE_INFINITY;
  const nowMs = Date.now();
  const isToday = day.date === toDateKey(new Date().toISOString());

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 'Niepoprawny format czasu.';
  }
  if (startMs < dayStartMs) {
    return 'Wpis nie może zaczynać się przed rozpoczęciem dnia pracy.';
  }
  if (endMs > dayEndMs) {
    return 'Wpis nie może wykraczać poza granice dnia pracy.';
  }
  if (isToday && endMs > nowMs + 60000) {
    return 'Wpis nie może kończyć się w przyszłości.';
  }

  return null;
};
