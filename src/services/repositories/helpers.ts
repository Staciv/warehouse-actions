import type {
  ActionTask,
  ActionTaskFilters,
  ActionType,
  Carrier,
  User
} from '../../types/domain';
import { deriveTaskStatus, sortTasksByPriorityAndDate, toOperationStatus } from '../../entities/action-task';
import { toIsoNow } from '../../shared/utils/date';

export const withTimestamps = <T extends Record<string, unknown>>(
  data: T,
  existingCreatedAt?: string
): T & { createdAt: string; updatedAt: string } => {
  const now = toIsoNow();
  return {
    ...data,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now
  };
};

export const byIsActive = <T extends { isActive: boolean }>(rows: T[]) => rows.filter((row) => row.isActive);

export const getCarrierSnapshot = (carriers: Carrier[], carrierId: string) => {
  const found = carriers.find((carrier) => carrier.id === carrierId);
  if (!found) throw new Error('Nie znaleziono przewoźnika');
  return found.name;
};

export const getActionTypeSnapshot = (types: ActionType[], actionTypeId: string) => {
  const found = types.find((item) => item.id === actionTypeId);
  if (!found) throw new Error('Nie znaleziono typu akcji');
  return found.name;
};

export const getUserSnapshot = (users: User[], userId: string) => {
  const found = users.find((user) => user.id === userId);
  if (!found) throw new Error('Nie znaleziono użytkownika');
  return found.displayName;
};

export const applyTaskFilters = (tasks: ActionTask[], filters?: ActionTaskFilters) => {
  const normalizedTasks = tasks.map(normalizeTaskRow);
  if (!filters) return sortTasksByPriorityAndDate(normalizedTasks);

  const includeArchived = filters.status === 'archived';
  const filtered = normalizedTasks
    .filter((task) => (includeArchived ? true : !task.archived))
    .filter((task) => (filters.status && filters.status !== 'all' ? task.status === filters.status : true))
    .filter((task) => (filters.priority && filters.priority !== 'all' ? task.priority === filters.priority : true))
    .filter((task) => (filters.carrierId && filters.carrierId !== 'all' ? task.carrierId === filters.carrierId : true))
    .filter((task) =>
      filters.actionTypeId && filters.actionTypeId !== 'all' ? task.actionTypeId === filters.actionTypeId : true
    )
    .filter((task) => {
      if (!filters.vehicleQuery) return true;
      return task.vehicleCode.toLowerCase().includes(filters.vehicleQuery.toLowerCase());
    })
    .filter((task) => {
      if (filters.onlyActive === 'active') return task.totalPallets !== null;
      if (filters.onlyActive === 'inactive') return task.totalPallets === null;
      return true;
    });

  const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null;
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59`).getTime() : null;

  const byDate = filtered.filter((task) => {
    const ts = new Date(task.arrivalDate).getTime();
    if (from !== null && ts < from) return false;
    if (to !== null && ts > to) return false;
    return true;
  });

  return sortTasksByPriorityAndDate(byDate);
};

export const applyStatusFromPallets = (task: ActionTask) => {
  const status = deriveTaskStatus(task);
  return { ...task, status };
};

export const normalizeTaskRow = (task: ActionTask): ActionTask => {
  return {
    ...task,
    status: toOperationStatus(task.status),
    participantWorkerIds: task.participantWorkerIds ?? [],
    participantWorkerNames: task.participantWorkerNames ?? []
  };
};

export const sanitizeUserForClient = (user: User): User => ({
  ...user,
  passwordHash: ''
});
