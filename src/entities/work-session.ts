import type { ActionTask } from '../types/domain';

export const validateSessionInput = (
  task: ActionTask,
  rampNumber: string,
  palletsDone: number,
  startedAt: string,
  endedAt: string
): string | null => {
  if (task.totalPallets === null) return 'Dla zadania nie podano całkowitej liczby palet.';
  if (!rampNumber.trim()) return 'Podaj numer rampy.';
  if (palletsDone <= 0) return 'Liczba palet musi być większa od 0.';
  if (palletsDone > task.remainingPallets) return 'Nie można wykonać więcej palet, niż pozostało.';
  if (!startedAt || !endedAt) return 'Podaj czas rozpoczęcia i zakończenia.';
  const startTs = new Date(startedAt).getTime();
  const endTs = new Date(endedAt).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs)) return 'Niepoprawny format czasu.';
  if (endTs <= startTs) return 'Czas zakończenia musi być późniejszy niż czas rozpoczęcia.';
  return null;
};

export const calculateDurationMinutes = (startedAt: string, endedAt: string) => {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(1, Math.round(ms / 60000));
};
