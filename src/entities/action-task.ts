import type { ActionTask, TaskStatus } from '../types/domain';

const workerAvailableStatuses: TaskStatus[] = ['planned', 'executing', 'active', 'in_progress', 'partial'];

export const isTaskAvailableForWorkers = (task: ActionTask) => {
  return task.totalPallets !== null && task.remainingPallets > 0 && workerAvailableStatuses.includes(task.status);
};

export const deriveTaskStatus = (task: ActionTask): TaskStatus => {
  if (task.archived) return 'archived';
  if (task.totalPallets === null) return 'draft';
  if (task.totalPallets <= 0) return 'inactive';
  if (task.remainingPallets <= 0) return 'completed';
  if (task.participantWorkerIds.length > 0 || task.completedPallets > 0) return 'executing';
  return 'planned';
};

export const sortTasksByPriorityAndDate = (tasks: ActionTask[]) => {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime();
  });
};

export const normalizeTaskAfterProgress = (task: ActionTask): ActionTask => {
  const remaining = Math.max(0, (task.totalPallets ?? 0) - task.completedPallets);
  const merged = {
    ...task,
    remainingPallets: remaining
  };

  if (merged.totalPallets === null) {
    merged.status = 'draft';
    return merged;
  }

  if (remaining === 0) {
    merged.status = 'completed';
    return merged;
  }

  merged.status = merged.completedPallets > 0 ? 'executing' : 'planned';
  return merged;
};

export const reconcileTaskStatus = (task: ActionTask, requestedStatus?: TaskStatus): ActionTask => {
  if (task.archived) {
    return { ...task, status: 'archived' };
  }

  if (task.totalPallets === null) {
    return { ...task, status: 'draft', remainingPallets: 0 };
  }

  if (task.remainingPallets <= 0) {
    return { ...task, status: 'completed', remainingPallets: 0 };
  }

  if (requestedStatus) {
    return { ...task, status: requestedStatus };
  }

  return normalizeTaskAfterProgress(task);
};

export const toOperationStatus = (status: TaskStatus): TaskStatus => {
  if (status === 'active') return 'planned';
  if (status === 'in_progress' || status === 'partial') return 'executing';
  if (status === 'deferred') return 'cancelled';
  return status;
};
