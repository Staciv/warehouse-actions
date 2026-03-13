import { MOCK_DB_STORAGE_KEY } from '../../constants/app';
import { reconcileTaskStatus } from '../../entities/action-task';
import { calculateDurationMinutes, validateSessionInput } from '../../entities/work-session';
import { toIsoNow } from '../../shared/utils/date';
import { sha256 } from '../../shared/utils/hash';
import { createId } from '../../shared/utils/id';
import type {
  ActionTask,
  ActionType,
  AuditLog,
  Carrier,
  User,
  WorkSession
} from '../../types/domain';
import { seedActionTasks, seedActionTypes, seedCarriers, seedUsers, seedWorkSessions } from '../seed/seedData';
import type {
  CreateActionTaskPayload,
  CreateUserPayload,
  CreateWorkSessionPayload,
  Repository,
  UpdateActionTaskPayload,
  UpdateUserPayload
} from '../repositories/types';
import { applyTaskFilters, sanitizeUserForClient, withTimestamps } from '../repositories/helpers';
import {
  assertAdmin,
  assertCanManageUserRole,
  assertCanRecordWorkSession,
  assertTaskAcceptsWorkSession
} from '../repositories/permissions';
import type { MockDb } from './schema';

const nowStamped = (value: Omit<ActionTask, 'createdAt' | 'updatedAt'>): ActionTask => withTimestamps(value);
const nowStampedUser = (value: Omit<User, 'createdAt' | 'updatedAt'>): User => withTimestamps(value);
const nowStampedCarrier = (value: Omit<Carrier, 'createdAt' | 'updatedAt'>): Carrier => withTimestamps(value);
const nowStampedActionType = (value: Omit<ActionType, 'createdAt' | 'updatedAt'>): ActionType => withTimestamps(value);
const nowStampedSession = (value: Omit<WorkSession, 'createdAt' | 'updatedAt'>): WorkSession => withTimestamps(value);

const redactAuditValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => redactAuditValue(entry));

  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(source)) {
    if (key === 'passwordHash' || key === 'password') {
      next[key] = '[REDACTED]';
      continue;
    }
    next[key] = redactAuditValue(entryValue);
  }
  return next;
};

const createAudit = (
  entityType: AuditLog['entityType'],
  entityId: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  actor: User
): AuditLog => {
  const now = toIsoNow();
  return {
    id: createId(),
    entityType,
    entityId,
    action,
    oldValue: oldValue ? JSON.stringify(redactAuditValue(oldValue)) : undefined,
    newValue: newValue ? JSON.stringify(redactAuditValue(newValue)) : undefined,
    performedByUserId: actor.id,
    performedByUserName: actor.displayName,
    performedAt: now,
    createdAt: now,
    updatedAt: now
  };
};

const getInitialDb = async (): Promise<MockDb> => {
  const users: User[] = [];
  for (const seedUser of seedUsers) {
    users.push(
      nowStampedUser({
        ...seedUser,
        passwordHash: await sha256(seedUser.plainPassword)
      })
    );
  }

  return {
    users,
    carriers: seedCarriers.map((item) => nowStampedCarrier(item)),
    actionTypes: seedActionTypes.map((item) => nowStampedActionType(item)),
    actionTasks: seedActionTasks.map((item) => nowStamped(item)),
    workSessions: seedWorkSessions.map((item) => nowStampedSession(item)),
    auditLogs: []
  };
};

const parseDb = (raw: string | null): MockDb | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockDb;
  } catch {
    return null;
  }
};

export class MockRepository implements Repository {
  mode: 'mock' = 'mock';

  private db: MockDb | null = null;

  private async ensureDb() {
    if (this.db) return this.db;
    const existing = parseDb(localStorage.getItem(MOCK_DB_STORAGE_KEY));
    this.db = existing ?? (await getInitialDb());
    this.db.users = this.db.users.map((user) => ({
      ...user,
      availabilityStatus: user.availabilityStatus ?? 'available'
    }));
    this.db.actionTasks = this.db.actionTasks.map((task) => ({
      ...task,
      participantWorkerIds: task.participantWorkerIds ?? [],
      participantWorkerNames: task.participantWorkerNames ?? []
    }));
    this.db.workSessions = this.db.workSessions.map((session) => ({
      ...session,
      rampNumber: session.rampNumber ?? '—'
    }));
    if (!existing) this.persist();
    return this.db;
  }

  private persist() {
    if (!this.db) return;
    localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(this.db));
  }

  async seedIfEmpty() {
    const db = await this.ensureDb();
    if (db.users.length > 0) return;
    this.db = await getInitialDb();
    this.persist();
  }

  async login(payload: { login: string; password: string }) {
    const db = await this.ensureDb();
    const user = db.users.find((item) => item.login === payload.login);
    if (!user) throw new Error('Nie znaleziono użytkownika');
    if (!user.isActive) throw new Error('Użytkownik jest dezaktywowany');

    const hash = await sha256(payload.password);
    if (hash !== user.passwordHash) throw new Error('Nieprawidłowe hasło');

    return sanitizeUserForClient(user);
  }

  async getUserById(id: string) {
    const db = await this.ensureDb();
    const user = db.users.find((item) => item.id === id && item.isActive) ?? null;
    return user ? sanitizeUserForClient(user) : null;
  }

  async getUsers(actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    return [...db.users].map(sanitizeUserForClient).sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'));
  }

  async createUser(payload: CreateUserPayload, actor: User) {
    assertCanManageUserRole(actor, payload.role);
    const db = await this.ensureDb();
    if (db.users.some((user) => user.login === payload.login)) {
      throw new Error('Login jest już używany');
    }

    const next: User = nowStampedUser({
      id: createId(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: `${payload.firstName} ${payload.lastName}`,
      login: payload.login,
      passwordHash: await sha256(payload.password),
      role: payload.role,
      isActive: payload.isActive,
      availabilityStatus: 'available'
    });

    db.users.push(next);
    db.auditLogs.push(createAudit('user', next.id, 'create', null, next, actor));
    this.persist();
    return sanitizeUserForClient(next);
  }

  async updateUser(id: string, payload: UpdateUserPayload, actor: User) {
    const db = await this.ensureDb();
    const existing = db.users.find((user) => user.id === id);
    if (!existing) throw new Error('Nie znaleziono użytkownika');
    assertCanManageUserRole(actor, payload.role ?? existing.role, existing);

    const old = { ...existing };
    if (payload.firstName !== undefined) existing.firstName = payload.firstName;
    if (payload.lastName !== undefined) existing.lastName = payload.lastName;
    if (payload.login !== undefined) existing.login = payload.login;
    if (payload.role !== undefined) existing.role = payload.role;
    if (payload.isActive !== undefined) existing.isActive = payload.isActive;
    if (payload.password) existing.passwordHash = await sha256(payload.password);

    existing.displayName = `${existing.firstName} ${existing.lastName}`;
    existing.updatedAt = toIsoNow();

    db.auditLogs.push(createAudit('user', existing.id, 'update', old, existing, actor));
    this.persist();
    return sanitizeUserForClient(existing);
  }

  async getCarriers() {
    const db = await this.ensureDb();
    return [...db.carriers].filter((carrier) => carrier.isActive).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }

  async upsertCarrier(carrier: Omit<Carrier, 'createdAt' | 'updatedAt'>, actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    const existing = db.carriers.find((item) => item.id === carrier.id);

    if (existing) {
      const old = { ...existing };
      existing.name = carrier.name;
      existing.code = carrier.code;
      existing.isActive = carrier.isActive;
      existing.updatedAt = toIsoNow();
      db.auditLogs.push(createAudit('carrier', existing.id, 'update', old, existing, actor));
      this.persist();
      return existing;
    }

    const next = nowStampedCarrier(carrier);
    db.carriers.push(next);
    db.auditLogs.push(createAudit('carrier', next.id, 'create', null, next, actor));
    this.persist();
    return next;
  }

  async deleteCarrier(id: string, actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    const existing = db.carriers.find((carrier) => carrier.id === id);
    if (!existing) throw new Error('Nie znaleziono przewoźnika');

    const hasActiveTasks = db.actionTasks.some((task) => task.carrierId === id && !task.archived);
    if (hasActiveTasks) {
      throw new Error('Nie można usunąć przewoźnika: istnieją powiązane niearchiwalne akcje');
    }

    db.carriers = db.carriers.filter((carrier) => carrier.id !== id);
    db.auditLogs.push(createAudit('carrier', id, 'delete', existing, null, actor));
    this.persist();
  }

  async getActionTypes() {
    const db = await this.ensureDb();
    return [...db.actionTypes].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }

  async upsertActionType(actionType: Omit<ActionType, 'createdAt' | 'updatedAt'>, actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    const existing = db.actionTypes.find((item) => item.id === actionType.id);

    if (existing) {
      const old = { ...existing };
      existing.key = actionType.key;
      existing.name = actionType.name;
      existing.description = actionType.description;
      existing.isActive = actionType.isActive;
      existing.updatedAt = toIsoNow();
      db.auditLogs.push(createAudit('actionType', existing.id, 'update', old, existing, actor));
      this.persist();
      return existing;
    }

    const next = nowStampedActionType(actionType);
    db.actionTypes.push(next);
    db.auditLogs.push(createAudit('actionType', next.id, 'create', null, next, actor));
    this.persist();
    return next;
  }

  async getActionTasks(filters?: import('../../types/domain').ActionTaskFilters) {
    const db = await this.ensureDb();
    const typeNameById = new Map(db.actionTypes.map((type) => [type.id, type.name]));
    const normalizedTasks = db.actionTasks.map((task) => ({
      ...task,
      actionTypeName: typeNameById.get(task.actionTypeId) ?? task.actionTypeName
    }));
    return applyTaskFilters(normalizedTasks, filters);
  }

  async getActionTaskById(id: string) {
    const db = await this.ensureDb();
    const task = db.actionTasks.find((entry) => entry.id === id) ?? null;
    if (!task) return null;
    const typeNameById = new Map(db.actionTypes.map((type) => [type.id, type.name]));
    return {
      ...task,
      actionTypeName: typeNameById.get(task.actionTypeId) ?? task.actionTypeName,
      participantWorkerIds: task.participantWorkerIds ?? [],
      participantWorkerNames: task.participantWorkerNames ?? []
    };
  }

  async createActionTask(payload: CreateActionTaskPayload, actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    const carrier = db.carriers.find((item) => item.id === payload.carrierId);
    if (!carrier) throw new Error('Nie znaleziono przewoźnika');

    const actionType = db.actionTypes.find((item) => item.id === payload.actionTypeId);
    if (!actionType) throw new Error('Nie znaleziono typu akcji');

    const totalPallets = payload.totalPallets;
    const task: ActionTask = nowStamped({
      id: createId(),
      carrierId: payload.carrierId,
      carrierName: carrier.name,
      vehicleCode: payload.vehicleCode,
      arrivalDate: payload.arrivalDate,
      arrivalTime: payload.arrivalTime,
      actionTypeId: payload.actionTypeId,
      actionTypeName: actionType.name,
      totalPallets,
      completedPallets: 0,
      remainingPallets: totalPallets ?? 0,
      status: totalPallets === null ? 'draft' : 'planned',
      priority: payload.priority,
      note: payload.note,
      internalComment: payload.internalComment,
      workerComment: payload.workerComment,
      labels: payload.labels ?? [],
      canBeSplit: payload.canBeSplit ?? true,
      participantWorkerIds: [],
      participantWorkerNames: [],
      createdByUserId: actor.id,
      createdByUserName: actor.displayName,
      updatedByUserId: actor.id,
      updatedByUserName: actor.displayName,
      archived: false
    });

    db.actionTasks.push(task);
    db.auditLogs.push(createAudit('actionTask', task.id, 'create', null, task, actor));
    this.persist();
    return task;
  }

  async startActionExecution(taskId: string, workerId: string, actor: User) {
    const db = await this.ensureDb();
    assertCanRecordWorkSession(actor, workerId);
    const task = db.actionTasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error('Nie znaleziono operacji');
    if (task.archived || task.status === 'archived' || task.status === 'cancelled') {
      throw new Error('Operacja jest niedostępna do uruchomienia');
    }
    if (task.totalPallets === null) {
      throw new Error('Najpierw podaj dokładną liczbę palet');
    }
    if (task.remainingPallets <= 0) {
      throw new Error('Operacja jest już zakończona');
    }

    const worker = db.users.find((entry) => entry.id === workerId);
    if (!worker) throw new Error('Nie znaleziono pracownika');
    if (!worker.isActive) throw new Error('Pracownik jest dezaktywowany');

    const oldTask = { ...task };
    const oldWorker = { ...worker };

    if (!task.participantWorkerIds.includes(worker.id)) {
      task.participantWorkerIds = [...task.participantWorkerIds, worker.id];
      task.participantWorkerNames = [...task.participantWorkerNames, worker.displayName];
    }

    task.status = task.remainingPallets > 0 ? 'executing' : 'completed';
    task.updatedByUserId = actor.id;
    task.updatedByUserName = actor.displayName;
    task.updatedAt = toIsoNow();

    worker.availabilityStatus = task.status === 'completed' ? 'completed' : 'in_action';
    worker.updatedAt = toIsoNow();

    db.auditLogs.push(createAudit('actionTask', task.id, 'start_execution', oldTask, task, actor));
    db.auditLogs.push(createAudit('user', worker.id, 'worker_status_update', oldWorker, worker, actor));
    this.persist();
    return task;
  }

  async stopActionExecution(taskId: string, workerId: string, actor: User) {
    const db = await this.ensureDb();
    assertCanRecordWorkSession(actor, workerId);
    const task = db.actionTasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error('Nie znaleziono operacji');
    if (task.archived || task.status === 'archived' || task.status === 'cancelled') {
      throw new Error('Operacja jest niedostępna do zmiany');
    }
    if (!task.participantWorkerIds.includes(workerId)) {
      throw new Error('Pracownik nie uczestniczy w tej operacji');
    }

    const worker = db.users.find((entry) => entry.id === workerId);
    if (!worker) throw new Error('Nie znaleziono pracownika');

    const oldTask = { ...task };
    const oldWorker = { ...worker };

    const workerPosition = task.participantWorkerIds.findIndex((id) => id === workerId);
    if (workerPosition >= 0) {
      task.participantWorkerIds = task.participantWorkerIds.filter((id) => id !== workerId);
      task.participantWorkerNames = task.participantWorkerNames.filter((_, index) => index !== workerPosition);
    }

    if (task.remainingPallets <= 0) {
      task.status = 'completed';
    } else if (task.participantWorkerIds.length > 0) {
      task.status = 'executing';
    } else {
      task.status = 'planned';
    }

    task.updatedByUserId = actor.id;
    task.updatedByUserName = actor.displayName;
    task.updatedAt = toIsoNow();

    const hasOtherActiveExecutions = db.actionTasks.some(
      (entry) =>
        entry.id !== task.id &&
        !entry.archived &&
        entry.status === 'executing' &&
        entry.remainingPallets > 0 &&
        entry.participantWorkerIds.includes(workerId)
    );

    worker.availabilityStatus = hasOtherActiveExecutions ? 'in_action' : 'available';
    worker.updatedAt = toIsoNow();

    db.auditLogs.push(createAudit('actionTask', task.id, 'stop_execution', oldTask, task, actor));
    db.auditLogs.push(createAudit('user', worker.id, 'worker_status_update', oldWorker, worker, actor));
    this.persist();
    return task;
  }

  async updateActionTask(id: string, payload: UpdateActionTaskPayload, actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    const task = db.actionTasks.find((item) => item.id === id);
    if (!task) throw new Error('Nie znaleziono akcji');
    const old = { ...task };

    if (payload.carrierId) {
      const carrier = db.carriers.find((item) => item.id === payload.carrierId);
      if (!carrier) throw new Error('Nie znaleziono przewoźnika');
      task.carrierId = payload.carrierId;
      task.carrierName = carrier.name;
    }

    if (payload.actionTypeId) {
      const actionType = db.actionTypes.find((item) => item.id === payload.actionTypeId);
      if (!actionType) throw new Error('Nie znaleziono typu akcji');
      task.actionTypeId = payload.actionTypeId;
      task.actionTypeName = actionType.name;
    }

    if (payload.vehicleCode !== undefined) task.vehicleCode = payload.vehicleCode;
    if (payload.arrivalDate !== undefined) task.arrivalDate = payload.arrivalDate;
    if (payload.arrivalTime !== undefined) task.arrivalTime = payload.arrivalTime;
    if (payload.priority !== undefined) task.priority = payload.priority;
    if (payload.note !== undefined) task.note = payload.note;
    if (payload.internalComment !== undefined) task.internalComment = payload.internalComment;
    if (payload.workerComment !== undefined) task.workerComment = payload.workerComment;
    if (payload.labels !== undefined) task.labels = payload.labels;
    if (payload.canBeSplit !== undefined) task.canBeSplit = payload.canBeSplit;
    if (payload.archived !== undefined) task.archived = payload.archived;

    if (payload.totalPallets !== undefined) {
      const total = payload.totalPallets;
      if (total !== null && total < task.completedPallets) {
        throw new Error('Całkowita liczba palet nie może być mniejsza niż już wykonana.');
      }
      task.totalPallets = total;
      task.remainingPallets = total === null ? 0 : total - task.completedPallets;
    }

    const requestedStatus = payload.status;

    task.updatedByUserId = actor.id;
    task.updatedByUserName = actor.displayName;
    task.updatedAt = toIsoNow();

    const normalized = reconcileTaskStatus(task, requestedStatus);
    Object.assign(task, normalized);

    if (task.status === 'completed' || task.status === 'cancelled') {
      for (const workerId of task.participantWorkerIds) {
        const worker = db.users.find((entry) => entry.id === workerId);
        if (!worker) continue;
        const oldWorker = { ...worker };
        worker.availabilityStatus = task.status === 'completed' ? 'completed' : 'available';
        worker.updatedAt = toIsoNow();
        db.auditLogs.push(createAudit('user', worker.id, 'worker_status_update', oldWorker, worker, actor));
      }
    }

    db.auditLogs.push(createAudit('actionTask', task.id, 'update', old, task, actor));
    this.persist();
    return task;
  }

  async getWorkSessionsByTask(taskId: string) {
    const db = await this.ensureDb();
    return db.workSessions
      .filter((session) => session.actionTaskId === taskId)
      .map((session) => ({ ...session, rampNumber: session.rampNumber ?? '—' }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getWorkSessions(options?: { fromDate?: string; toDate?: string }) {
    const db = await this.ensureDb();
    let rows = [...db.workSessions];

    if (options?.fromDate) {
      const from = new Date(`${options.fromDate}T00:00:00`).getTime();
      rows = rows.filter((row) => new Date(row.startedAt).getTime() >= from);
    }

    if (options?.toDate) {
      const to = new Date(`${options.toDate}T23:59:59`).getTime();
      rows = rows.filter((row) => new Date(row.startedAt).getTime() <= to);
    }

    return rows
      .map((session) => ({ ...session, rampNumber: session.rampNumber ?? '—' }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createWorkSession(payload: CreateWorkSessionPayload, actor: User) {
    const db = await this.ensureDb();
    assertCanRecordWorkSession(actor, payload.workerId);
    const task = db.actionTasks.find((item) => item.id === payload.actionTaskId);
    if (!task) throw new Error('Nie znaleziono akcji');
    assertTaskAcceptsWorkSession(task, payload.workerId);

    const worker = db.users.find((user) => user.id === payload.workerId);
    if (!worker) throw new Error('Nie znaleziono pracownika');

    const validationError = validateSessionInput(
      task,
      payload.rampNumber,
      payload.palletsCompletedInSession,
      payload.startedAt,
      payload.endedAt
    );
    if (validationError) throw new Error(validationError);

    const session: WorkSession = nowStampedSession({
      id: createId(),
      actionTaskId: payload.actionTaskId,
      workerId: payload.workerId,
      workerName: worker.displayName,
      rampNumber: payload.rampNumber.trim(),
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      startManualDateTime: payload.startedAt,
      endManualDateTime: payload.endedAt,
      palletsCompletedInSession: payload.palletsCompletedInSession,
      durationMinutes: calculateDurationMinutes(payload.startedAt, payload.endedAt),
      comment: payload.comment
    });

    const old = { ...task };

    task.completedPallets += payload.palletsCompletedInSession;
    task.remainingPallets = Math.max(0, (task.totalPallets ?? 0) - task.completedPallets);
    task.status = task.remainingPallets === 0 ? 'completed' : 'executing';
    task.updatedByUserId = actor.id;
    task.updatedByUserName = actor.displayName;
    task.updatedAt = toIsoNow();

    db.workSessions.push(session);
    db.auditLogs.push(createAudit('workSession', session.id, 'create', null, session, actor));
    db.auditLogs.push(createAudit('actionTask', task.id, 'progress_update', old, task, actor));

    if (task.status === 'completed') {
      for (const workerId of task.participantWorkerIds) {
        const workerEntry = db.users.find((entry) => entry.id === workerId);
        if (!workerEntry) continue;
        const oldWorker = { ...workerEntry };
        workerEntry.availabilityStatus = task.status === 'completed' ? 'completed' : 'available';
        workerEntry.updatedAt = toIsoNow();
        db.auditLogs.push(createAudit('user', workerEntry.id, 'worker_status_update', oldWorker, workerEntry, actor));
      }
    } else {
      const sessionWorker = db.users.find((entry) => entry.id === payload.workerId);
      if (sessionWorker && sessionWorker.availabilityStatus !== 'in_action') {
        const oldWorker = { ...sessionWorker };
        sessionWorker.availabilityStatus = 'in_action';
        sessionWorker.updatedAt = toIsoNow();
        db.auditLogs.push(createAudit('user', sessionWorker.id, 'worker_status_update', oldWorker, sessionWorker, actor));
      }
    }

    this.persist();
    return session;
  }

  async getAuditLogs(entityType: AuditLog['entityType'] | undefined, entityId: string | undefined, actor: User) {
    assertAdmin(actor);
    const db = await this.ensureDb();
    return db.auditLogs
      .filter((log) => (entityType ? log.entityType === entityType : true))
      .filter((log) => (entityId ? log.entityId === entityId : true))
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }
}
