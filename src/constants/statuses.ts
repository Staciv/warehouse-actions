import type { TaskPriority, TaskStatus } from '../types/domain';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: 'Запланировано',
  executing: 'Выполняется',
  cancelled: 'Отменено',
  draft: 'Черновик',
  inactive: 'Неактивно',
  active: 'Активно',
  in_progress: 'В процессе',
  partial: 'Частично выполнено',
  completed: 'Завершено',
  deferred: 'Отложено',
  archived: 'Архив'
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  1: 'Низкий',
  2: 'Обычный',
  3: 'Высокий',
  4: 'Срочно'
};

export const PRIORITY_ORDER: TaskPriority[] = [4, 3, 2, 1];
