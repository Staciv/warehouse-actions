import type { ActionTask } from '../types/domain';

export const validateSessionInput = (
  task: ActionTask,
  palletsDone: number,
  startedAt: string,
  endedAt: string
): string | null => {
  if (task.totalPallets === null) return 'Для задачи не указано общее количество палет.';
  if (palletsDone <= 0) return 'Количество палет должно быть больше 0.';
  if (palletsDone > task.remainingPallets) return 'Нельзя выполнить палет больше, чем осталось.';
  if (!startedAt || !endedAt) return 'Укажите время начала и окончания.';
  const startTs = new Date(startedAt).getTime();
  const endTs = new Date(endedAt).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs)) return 'Некорректный формат времени.';
  if (endTs <= startTs) return 'Время окончания должно быть позже времени начала.';
  return null;
};

export const calculateDurationMinutes = (startedAt: string, endedAt: string) => {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(1, Math.round(ms / 60000));
};
