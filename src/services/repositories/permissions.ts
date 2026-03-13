import type { ActionTask, User, UserRole } from '../../types/domain';

export const assertAdmin = (actor: User) => {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new Error('Недостаточно прав для административной операции');
  }
};

export const assertSuperAdmin = (actor: User) => {
  if (actor.role !== 'superadmin') {
    throw new Error('Операция доступна только главному администратору');
  }
};

export const assertCanManageUserRole = (
  actor: User,
  targetRole: UserRole,
  existingTarget?: User
) => {
  assertAdmin(actor);

  if (targetRole === 'superadmin' && actor.role !== 'superadmin') {
    throw new Error('Только главный админ может назначать роль superadmin');
  }

  if (existingTarget?.role === 'superadmin' && actor.role !== 'superadmin') {
    throw new Error('Только главный админ может изменять superadmin');
  }
};

export const assertCanRecordWorkSession = (actor: User, workerId: string) => {
  if (actor.role !== 'worker') {
    throw new Error('Только работник может запускать и фиксировать выполнение');
  }
  if (actor.id !== workerId) {
    throw new Error('Работник может фиксировать только своё выполнение');
  }
};

export const assertTaskAcceptsWorkSession = (task: ActionTask, workerId: string) => {
  if (task.archived || task.status === 'archived') {
    throw new Error('Архивная акция недоступна для выполнения');
  }

  if (task.totalPallets === null || task.status === 'draft' || task.status === 'inactive') {
    throw new Error('Акция не активирована: отсутствует подтверждённый объём палет');
  }

  if (task.status === 'deferred') {
    throw new Error('Акция отложена и временно недоступна для выполнения');
  }
  if (task.status === 'cancelled') {
    throw new Error('Операция отменена и недоступна для выполнения');
  }
  if (task.status !== 'executing') {
    throw new Error('Сначала переведите операцию в статус \"Выполняется\"');
  }
  if (!task.participantWorkerIds.includes(workerId)) {
    throw new Error('Работник должен сначала присоединиться к выполнению операции');
  }

  if (task.remainingPallets <= 0) {
    throw new Error('По акции не осталось палет к выполнению');
  }

  if (!task.canBeSplit && task.completedPallets > 0) {
    throw new Error('Эта акция не поддерживает частичное разбиение');
  }
};
