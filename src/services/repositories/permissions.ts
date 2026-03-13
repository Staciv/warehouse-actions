import type { ActionTask, User, UserRole } from '../../types/domain';

export const assertAdmin = (actor: User) => {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new Error('Brak uprawnień do operacji administracyjnej');
  }
};

export const assertSuperAdmin = (actor: User) => {
  if (actor.role !== 'superadmin') {
    throw new Error('Operacja dostępna tylko dla superadministratora');
  }
};

export const assertCanManageUserRole = (
  actor: User,
  targetRole: UserRole,
  existingTarget?: User
) => {
  assertAdmin(actor);

  if (targetRole === 'superadmin' && actor.role !== 'superadmin') {
    throw new Error('Tylko superadministrator może nadać rolę superadmin');
  }

  if (existingTarget?.role === 'superadmin' && actor.role !== 'superadmin') {
    throw new Error('Tylko superadministrator może zmieniać konto superadmin');
  }
};

export const assertCanRecordWorkSession = (actor: User, workerId: string) => {
  if (actor.role !== 'worker') {
    throw new Error('Tylko pracownik może uruchamiać i zapisywać wykonanie');
  }
  if (actor.id !== workerId) {
    throw new Error('Pracownik może zapisać tylko własne wykonanie');
  }
};

export const assertTaskAcceptsWorkSession = (task: ActionTask, workerId: string) => {
  if (task.archived || task.status === 'archived') {
    throw new Error('Akcja archiwalna jest niedostępna do wykonania');
  }

  if (task.totalPallets === null || task.status === 'draft' || task.status === 'inactive') {
    throw new Error('Akcja nieaktywna: brak potwierdzonego wolumenu palet');
  }

  if (task.status === 'deferred') {
    throw new Error('Akcja odłożona i tymczasowo niedostępna');
  }
  if (task.status === 'cancelled') {
    throw new Error('Operacja anulowana i niedostępna do wykonania');
  }
  if (task.status !== 'executing') {
    throw new Error('Najpierw ustaw operację na status „W realizacji”');
  }
  if (!task.participantWorkerIds.includes(workerId)) {
    throw new Error('Pracownik musi najpierw dołączyć do realizacji operacji');
  }

  if (task.remainingPallets <= 0) {
    throw new Error('Dla tej akcji nie pozostały palety do wykonania');
  }

  if (!task.canBeSplit && task.completedPallets > 0) {
    throw new Error('Ta akcja nie obsługuje częściowego wykonania');
  }
};
