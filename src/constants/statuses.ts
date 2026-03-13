import type { TaskPriority, TaskStatus } from '../types/domain';

export const STATUS_I18N_KEYS: Record<TaskStatus, string> = {
  planned: 'status.planned',
  executing: 'status.executing',
  cancelled: 'status.cancelled',
  draft: 'status.draft',
  inactive: 'status.inactive',
  active: 'status.active',
  in_progress: 'status.in_progress',
  partial: 'status.partial',
  completed: 'status.completed',
  deferred: 'status.deferred',
  archived: 'status.archived'
};

export const PRIORITY_I18N_KEYS: Record<TaskPriority, string> = {
  1: 'priority.1',
  2: 'priority.2',
  3: 'priority.3',
  4: 'priority.4'
};

export const PRIORITY_ORDER: TaskPriority[] = [4, 3, 2, 1];
