import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  where
} from 'firebase/firestore';
import { normalizeTaskAfterProgress, reconcileTaskStatus, validateRequestedTaskStatus } from '../../entities/action-task';
import { validateProblemReportInput } from '../../entities/problem-report';
import {
  calculateMinutes,
  detectOverlaps,
  ensureEndAfterStart,
  evaluateDayClose,
  sortWorkEntries,
  summarizeWorkDay,
  toDateKey,
  validateEntryInWorkDayBounds
} from '../../entities/workday';
import { calculateDurationMinutes, validateSessionInput } from '../../entities/work-session';
import { emitDataSync } from '../../shared/utils/dataSync';
import { toIsoNow } from '../../shared/utils/date';
import { sha256 } from '../../shared/utils/hash';
import { createId } from '../../shared/utils/id';
import type {
  ActionTask,
  ActionTaskFilters,
  ActionType,
  AuditLog,
  Carrier,
  ProblemReport,
  User,
  WorkDay,
  WorkLogEntry,
  WorkTypeDictionary,
  WorkSession
} from '../../types/domain';
import {
  seedActionTasks,
  seedActionTypes,
  seedCarriers,
  seedProblemReports,
  seedUsers,
  seedWorkDays,
  seedWorkLogEntries,
  seedWorkSessions,
  seedWorkTypes
} from '../seed/seedData';
import {
  applyTaskFilters,
  normalizeTaskRow,
  sanitizeUserForClient,
  withTimestamps
} from '../repositories/helpers';
import {
  assertAdmin,
  assertCanCreateProblemReport,
  assertCanManageProblemReport,
  assertCanManageUserRole,
  assertCanAccessWorkerData,
  assertCanRecordWorkSession,
  assertTaskAcceptsWorkSession
} from '../repositories/permissions';
import type {
  AddManualWorkLogEntryPayload,
  CreateActionTaskPayload,
  CreateProblemReportPayload,
  CreateUserPayload,
  CreateWorkSessionPayload,
  ProblemReportFilters,
  Repository,
  StartWorkDayPayload,
  UpdateActionTaskPayload,
  UpdateManualWorkLogEntryPayload,
  UpdateUserPayload,
  WorkDaysFilters
} from '../repositories/types';
import { collections } from './collectionNames';
import { getDb } from './client';

const readCollection = async <T>(name: string): Promise<T[]> => {
  const snap = await getDocs(collection(getDb(), name));
  return snap.docs.map((row) => row.data() as T);
};

const readById = async <T>(name: string, id: string): Promise<T | null> => {
  const ref = doc(getDb(), name, id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as T) : null;
};

const putById = async <T extends { id: string }>(name: string, row: T) => {
  await setDoc(doc(getDb(), name, row.id), row, { merge: false });
};

const ensureDefaultWorkTypes = async () => {
  const existing = await readCollection<WorkTypeDictionary>(collections.workTypes);
  const existingIds = new Set(existing.map((entry) => entry.id));
  const missing = seedWorkTypes.filter((entry) => !existingIds.has(entry.id));

  if (missing.length === 0) return existing;

  const seededMissing = missing.map((item) => withTimestamps(item));
  for (const entry of seededMissing) {
    await putById(collections.workTypes, entry);
  }
  return [...existing, ...seededMissing];
};

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

const pushAudit = async (
  entityType: AuditLog['entityType'],
  entityId: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  actor: User
) => {
  const now = toIsoNow();
  const payload: AuditLog = {
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

  await addDoc(collection(getDb(), collections.auditLogs), payload);
};

const getWorkDayByWorkerAndDate = async (workerId: string, dateKey: string) => {
  const snap = await getDocs(
    query(
      collection(getDb(), collections.workDays),
      where('workerId', '==', workerId),
      where('date', '==', dateKey),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as WorkDay;
};

const getWorkLogEntriesByDay = async (workDayId: string) => {
  const snap = await getDocs(query(collection(getDb(), collections.workLogEntries), where('workDayId', '==', workDayId)));
  return snap.docs.map((row) => row.data() as WorkLogEntry);
};

export class FirebaseRepository implements Repository {
  mode: 'firebase' = 'firebase';

  async seedIfEmpty() {
    if (import.meta.env.VITE_ENABLE_FIREBASE_SEED !== 'true') return;
    const db = getDb();
    const usersRef = collection(db, collections.users);
    const existing = await getDocs(query(usersRef, limit(1)));
    if (!existing.empty) return;

    for (const user of seedUsers) {
      const payload: User = withTimestamps({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        login: user.login,
        passwordHash: await sha256(user.plainPassword),
        role: user.role,
        isActive: user.isActive,
        availabilityStatus: user.availabilityStatus
      });
      await putById(collections.users, payload);
    }

    for (const carrier of seedCarriers) {
      await putById(collections.carriers, withTimestamps(carrier));
    }

    for (const type of seedActionTypes) {
      await putById(collections.actionTypes, withTimestamps(type));
    }

    for (const task of seedActionTasks) {
      await putById(collections.actionTasks, withTimestamps(task));
    }

    for (const session of seedWorkSessions) {
      await putById(collections.workSessions, withTimestamps(session));
    }
    for (const day of seedWorkDays) {
      await putById(collections.workDays, withTimestamps(day));
    }
    for (const logEntry of seedWorkLogEntries) {
      await putById(collections.workLogEntries, withTimestamps(logEntry));
    }
    for (const workType of seedWorkTypes) {
      await putById(collections.workTypes, withTimestamps(workType));
    }
    for (const report of seedProblemReports) {
      await putById(collections.problemReports, withTimestamps(report));
    }
  }

  async login(payload: { login: string; password: string }) {
    const db = getDb();
    const usersRef = collection(db, collections.users);
    const userQuery = query(usersRef, where('login', '==', payload.login), limit(1));
    const snap = await getDocs(userQuery);
    if (snap.empty) throw new Error('Nie znaleziono użytkownika');

    const user = snap.docs[0].data() as User;
    if (!user.isActive) throw new Error('Użytkownik jest dezaktywowany');

    const hash = await sha256(payload.password);
    if (hash !== user.passwordHash) throw new Error('Nieprawidłowe hasło');

    return sanitizeUserForClient(user);
  }

  async getUserById(id: string) {
    const row = await readById<User>(collections.users, id);
    if (!row || !row.isActive) return null;
    return sanitizeUserForClient(row);
  }

  async getUsers(actor: User) {
    assertAdmin(actor);
    const rows = await readCollection<User>(collections.users);
    return rows
      .map((row) => ({ ...row, availabilityStatus: row.availabilityStatus ?? 'available' }))
      .map(sanitizeUserForClient)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'));
  }

  async createUser(payload: CreateUserPayload, actor: User) {
    assertCanManageUserRole(actor, payload.role);
    const rows = await readCollection<User>(collections.users);
    if (rows.some((row) => row.login === payload.login)) throw new Error('Login jest już używany');

    const user: User = withTimestamps({
      id: createId(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: `${payload.firstName} ${payload.lastName}`,
      login: payload.login,
      passwordHash: await sha256(payload.password),
      role: payload.role,
      isActive: payload.isActive,
      availabilityStatus: 'available' as const
    });

    await putById(collections.users, user);
    await pushAudit('user', user.id, 'create', null, user, actor);
    return sanitizeUserForClient(user);
  }

  async updateUser(id: string, payload: UpdateUserPayload, actor: User) {
    const existing = await readById<User>(collections.users, id);
    if (!existing) throw new Error('Nie znaleziono użytkownika');
    assertCanManageUserRole(actor, payload.role ?? existing.role, existing);
    if (payload.login && payload.login !== existing.login) {
      const allUsers = await readCollection<User>(collections.users);
      if (allUsers.some((row) => row.login === payload.login && row.id !== id)) {
        throw new Error('Login jest już używany');
      }
    }

    const old = { ...existing };
    const merged: User = {
      ...existing,
      firstName: payload.firstName ?? existing.firstName,
      lastName: payload.lastName ?? existing.lastName,
      login: payload.login ?? existing.login,
      role: payload.role ?? existing.role,
      isActive: payload.isActive ?? existing.isActive,
      updatedAt: toIsoNow(),
      displayName: `${payload.firstName ?? existing.firstName} ${payload.lastName ?? existing.lastName}`
    };

    if (payload.password) {
      merged.passwordHash = await sha256(payload.password);
    }

    await putById(collections.users, merged);
    await pushAudit('user', id, 'update', old, merged, actor);
    return sanitizeUserForClient(merged);
  }

  async getCarriers() {
    const rows = await readCollection<Carrier>(collections.carriers);
    return rows.filter((carrier) => carrier.isActive).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }

  async upsertCarrier(carrier: Omit<Carrier, 'createdAt' | 'updatedAt'>, actor: User) {
    assertAdmin(actor);
    const existing = await readById<Carrier>(collections.carriers, carrier.id);

    if (existing) {
      const next: Carrier = {
        ...existing,
        ...carrier,
        updatedAt: toIsoNow()
      };
      await putById(collections.carriers, next);
      await pushAudit('carrier', next.id, 'update', existing, next, actor);
      return next;
    }

    const next = withTimestamps(carrier);
    await putById(collections.carriers, next);
    await pushAudit('carrier', next.id, 'create', null, next, actor);
    return next;
  }

  async deleteCarrier(id: string, actor: User) {
    assertAdmin(actor);
    const existing = await readById<Carrier>(collections.carriers, id);
    if (!existing) throw new Error('Nie znaleziono przewoźnika');

    const allTasks = await readCollection<ActionTask>(collections.actionTasks);
    const hasActiveTasks = allTasks.some((task) => task.carrierId === id && !task.archived);
    if (hasActiveTasks) {
      throw new Error('Nie można usunąć przewoźnika: istnieją powiązane niearchiwalne akcje');
    }

    await deleteDoc(doc(getDb(), collections.carriers, id));
    await pushAudit('carrier', id, 'delete', existing, null, actor);
  }

  async getActionTypes() {
    const rows = await readCollection<ActionType>(collections.actionTypes);
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }

  async upsertActionType(actionType: Omit<ActionType, 'createdAt' | 'updatedAt'>, actor: User) {
    assertAdmin(actor);
    const existing = await readById<ActionType>(collections.actionTypes, actionType.id);

    if (existing) {
      const next: ActionType = {
        ...existing,
        ...actionType,
        updatedAt: toIsoNow()
      };
      await putById(collections.actionTypes, next);
      await pushAudit('actionType', next.id, 'update', existing, next, actor);
      return next;
    }

    const next = withTimestamps(actionType);
    await putById(collections.actionTypes, next);
    await pushAudit('actionType', next.id, 'create', null, next, actor);
    return next;
  }

  async getActionTasks(filters?: ActionTaskFilters) {
    const rows = await readCollection<ActionTask>(collections.actionTasks);
    const types = await this.getActionTypes();
    const typeNameById = new Map(types.map((type) => [type.id, type.name]));
    const normalizedRows = rows.map((row) => ({
      ...row,
      actionTypeName: typeNameById.get(row.actionTypeId) ?? row.actionTypeName
    }));
    return applyTaskFilters(normalizedRows, filters);
  }

  async getActionTaskById(id: string) {
    const task = await readById<ActionTask>(collections.actionTasks, id);
    if (!task) return null;
    const types = await this.getActionTypes();
    const typeNameById = new Map(types.map((type) => [type.id, type.name]));
    const normalizedTask: ActionTask = {
      ...task,
      actionTypeName: typeNameById.get(task.actionTypeId) ?? task.actionTypeName
    };
    return normalizeTaskRow(normalizedTask);
  }

  async createActionTask(payload: CreateActionTaskPayload, actor: User) {
    assertAdmin(actor);
    const [carriers, types] = await Promise.all([this.getCarriers(), this.getActionTypes()]);
    const carrier = carriers.find((row) => row.id === payload.carrierId);
    const actionType = types.find((row) => row.id === payload.actionTypeId);

    if (!carrier) throw new Error('Nie znaleziono przewoźnika');
    if (!actionType) throw new Error('Nie znaleziono typu akcji');

    const total = payload.totalPallets;
    const task: ActionTask = withTimestamps({
      id: createId(),
      carrierId: payload.carrierId,
      carrierName: carrier.name,
      vehicleCode: payload.vehicleCode,
      arrivalDate: payload.arrivalDate,
      arrivalTime: payload.arrivalTime,
      actionTypeId: payload.actionTypeId,
      actionTypeName: actionType.name,
      totalPallets: total,
      completedPallets: 0,
      remainingPallets: total ?? 0,
      status: total === null ? ('draft' as const) : ('planned' as const),
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

    await putById(collections.actionTasks, task);
    await pushAudit('actionTask', task.id, 'create', null, task, actor);
    emitDataSync(['tasks']);
    return task;
  }

  async startActionExecution(taskId: string, workerId: string, actor: User) {
    assertCanRecordWorkSession(actor, workerId);
    const db = getDb();
    const taskRef = doc(db, collections.actionTasks, taskId);
    const workerRef = doc(db, collections.users, workerId);

    const updated = await runTransaction(db, async (tx) => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists()) throw new Error('Nie znaleziono operacji');
      const task = normalizeTaskRow(taskSnap.data() as ActionTask);
      if (task.archived || task.status === 'archived' || task.status === 'cancelled') {
        throw new Error('Operacja jest niedostępna do uruchomienia');
      }
      if (task.status === 'deferred' || task.status === 'inactive' || task.status === 'draft') {
        throw new Error('Operacja ma status niedostępny do uruchomienia');
      }
      if (task.totalPallets === null) {
        throw new Error('Najpierw podaj dokładną liczbę palet');
      }
      if (task.remainingPallets <= 0) {
        throw new Error('Operacja jest już zakończona');
      }

      const workerSnap = await tx.get(workerRef);
      if (!workerSnap.exists()) throw new Error('Nie znaleziono pracownika');
      const worker = workerSnap.data() as User;
      if (!worker.isActive) throw new Error('Pracownik jest dezaktywowany');

      const nextTask: ActionTask = {
        ...task,
        participantWorkerIds: task.participantWorkerIds.includes(worker.id)
          ? task.participantWorkerIds
          : [...task.participantWorkerIds, worker.id],
        participantWorkerNames: task.participantWorkerIds.includes(worker.id)
          ? task.participantWorkerNames
          : [...task.participantWorkerNames, worker.displayName],
        status: task.remainingPallets > 0 ? 'executing' : 'completed',
        updatedByUserId: actor.id,
        updatedByUserName: actor.displayName,
        updatedAt: toIsoNow()
      };

      const nextWorker: User = {
        ...worker,
        availabilityStatus: nextTask.status === 'completed' ? 'completed' : 'in_action',
        updatedAt: toIsoNow()
      };

      tx.set(taskRef, nextTask);
      tx.set(workerRef, nextWorker);
      return { oldTask: task, newTask: nextTask, oldWorker: worker, newWorker: nextWorker };
    });

    await pushAudit('actionTask', taskId, 'start_execution', updated.oldTask, updated.newTask, actor);
    await pushAudit('user', workerId, 'worker_status_update', updated.oldWorker, updated.newWorker, actor);

    const now = toIsoNow();
    const dateKey = toDateKey(now);
    const existingDay = await getWorkDayByWorkerAndDate(workerId, dateKey);
    const day =
      existingDay ??
      withTimestamps({
        id: createId(),
        workerId,
        workerName: updated.newWorker.displayName,
        date: dateKey,
        actualStart: `${dateKey}T00:00:00.000Z`,
        plannedEnd: `${dateKey}T08:00:00.000Z`,
        status: 'active' as const,
        totalPresenceMinutes: 0,
        totalWorkedMinutes: 0,
        totalGapMinutes: 0
      });
    if (!existingDay) {
      await putById(collections.workDays, day);
      await pushAudit('workDay', day.id, 'auto_create', null, day, actor);
    }
    const dayEntries = await getWorkLogEntriesByDay(day.id);
    const openEntry = dayEntries
      .filter((entry) => entry.workerId === workerId && !entry.endTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    if (openEntry) {
      const closed: WorkLogEntry = {
        ...openEntry,
        endTime: now,
        durationMinutes: calculateMinutes(openEntry.startTime, now),
        isAutoClosed: true,
        updatedAt: toIsoNow()
      };
      await putById(collections.workLogEntries, closed);
    }
    const actionEntry: WorkLogEntry = withTimestamps({
      id: createId(),
      workDayId: day.id,
      workerId,
      workerName: updated.newWorker.displayName,
      source: 'action' as const,
      workTypeId: 'wt-action',
      workTypeName: 'Akcja magazynowa',
      relatedActionId: updated.newTask.id,
      relatedActionType: updated.newTask.actionTypeName,
      relatedCarrierId: updated.newTask.carrierId,
      relatedCarrierName: updated.newTask.carrierName,
      relatedVehicleCode: updated.newTask.vehicleCode,
      startTime: now,
      endTime: undefined,
      durationMinutes: 0,
      palletsCompleted: 0,
      comment: 'Auto-start z rozpoczęcia akcji',
      isAutoClosed: false
    });
    await putById(collections.workLogEntries, actionEntry);
    emitDataSync(['tasks', 'sessions', 'users', 'workdays']);
    return updated.newTask;
  }

  async stopActionExecution(taskId: string, workerId: string, actor: User) {
    assertCanRecordWorkSession(actor, workerId);
    const db = getDb();
    const taskRef = doc(db, collections.actionTasks, taskId);
    const workerRef = doc(db, collections.users, workerId);
    const updated = await runTransaction(db, async (tx) => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists()) throw new Error('Nie znaleziono operacji');
      const task = normalizeTaskRow(taskSnap.data() as ActionTask);
      if (task.archived || task.status === 'archived' || task.status === 'cancelled') {
        throw new Error('Operacja jest niedostępna do zmiany');
      }
      if (!task.participantWorkerIds.includes(workerId)) {
        throw new Error('Pracownik nie uczestniczy w tej operacji');
      }

      const workerSnap = await tx.get(workerRef);
      if (!workerSnap.exists()) throw new Error('Nie znaleziono pracownika');
      const worker = workerSnap.data() as User;

      const workerPosition = task.participantWorkerIds.findIndex((id) => id === workerId);
      const participantWorkerIds = task.participantWorkerIds.filter((id) => id !== workerId);
      const participantWorkerNames = task.participantWorkerNames.filter((_, index) => index !== workerPosition);

      let status: ActionTask['status'] = 'planned';
      if (task.remainingPallets <= 0) {
        status = 'completed';
      } else if (participantWorkerIds.length > 0) {
        status = 'executing';
      }

      const nextTask: ActionTask = {
        ...task,
        participantWorkerIds,
        participantWorkerNames,
        status,
        updatedByUserId: actor.id,
        updatedByUserName: actor.displayName,
        updatedAt: toIsoNow()
      };

      const nextWorker: User = {
        ...worker,
        availabilityStatus: 'available',
        updatedAt: toIsoNow()
      };

      tx.set(taskRef, nextTask);
      tx.set(workerRef, nextWorker);
      return { oldTask: task, newTask: nextTask, oldWorker: worker, newWorker: nextWorker };
    });

    const activeTasksForWorkerSnap = await getDocs(
      query(
        collection(db, collections.actionTasks),
        where('participantWorkerIds', 'array-contains', workerId),
        where('archived', '==', false),
        where('status', '==', 'executing')
      )
    );

    const hasOtherActiveExecutions = activeTasksForWorkerSnap.docs.some((entry) => {
      if (entry.id === taskId) return false;
      const normalized = normalizeTaskRow(entry.data() as ActionTask);
      return normalized.remainingPallets > 0;
    });

    if (hasOtherActiveExecutions && updated.newWorker.availabilityStatus !== 'in_action') {
      const worker = await readById<User>(collections.users, workerId);
      if (worker) {
        const nextWorker: User = { ...worker, availabilityStatus: 'in_action', updatedAt: toIsoNow() };
        await putById(collections.users, nextWorker);
        await pushAudit('user', workerId, 'worker_status_update', worker, nextWorker, actor);
      }
    } else {
      await pushAudit('user', workerId, 'worker_status_update', updated.oldWorker, updated.newWorker, actor);
    }

    await pushAudit('actionTask', taskId, 'stop_execution', updated.oldTask, updated.newTask, actor);

    const actionEntriesSnap = await getDocs(
      query(
        collection(getDb(), collections.workLogEntries),
        where('workerId', '==', workerId),
        where('relatedActionId', '==', taskId)
      )
    );
    const openActionEntry = actionEntriesSnap.docs
      .map((row) => row.data() as WorkLogEntry)
      .filter((entry) => !entry.endTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    if (openActionEntry) {
      const now = toIsoNow();
      const closed: WorkLogEntry = {
        ...openActionEntry,
        endTime: now,
        durationMinutes: calculateMinutes(openActionEntry.startTime, now),
        isAutoClosed: true,
        updatedAt: now
      };
      await putById(collections.workLogEntries, closed);
    }
    emitDataSync(['tasks', 'users', 'workdays']);
    return updated.newTask;
  }

  async updateActionTask(id: string, payload: UpdateActionTaskPayload, actor: User) {
    assertAdmin(actor);
    const existingRaw = await readById<ActionTask>(collections.actionTasks, id);
    if (!existingRaw) throw new Error('Nie znaleziono akcji');
    const existing = normalizeTaskRow(existingRaw);

    const [carriers, types] = await Promise.all([this.getCarriers(), this.getActionTypes()]);

    const merged: ActionTask = {
      ...existing,
      vehicleCode: payload.vehicleCode ?? existing.vehicleCode,
      arrivalDate: payload.arrivalDate ?? existing.arrivalDate,
      arrivalTime: payload.arrivalTime ?? existing.arrivalTime,
      priority: payload.priority ?? existing.priority,
      note: payload.note ?? existing.note,
      internalComment: payload.internalComment ?? existing.internalComment,
      workerComment: payload.workerComment ?? existing.workerComment,
      labels: payload.labels ?? existing.labels,
      canBeSplit: payload.canBeSplit ?? existing.canBeSplit,
      archived: payload.archived ?? existing.archived,
      status: payload.status ?? existing.status,
      updatedByUserId: actor.id,
      updatedByUserName: actor.displayName,
      updatedAt: toIsoNow()
    };

    if (payload.carrierId) {
      const carrier = carriers.find((row) => row.id === payload.carrierId);
      if (!carrier) throw new Error('Nie znaleziono przewoźnika');
      merged.carrierId = carrier.id;
      merged.carrierName = carrier.name;
    }

    if (payload.actionTypeId) {
      const type = types.find((row) => row.id === payload.actionTypeId);
      if (!type) throw new Error('Nie znaleziono typu akcji');
      merged.actionTypeId = type.id;
      merged.actionTypeName = type.name;
    }

    if (payload.totalPallets !== undefined) {
      if (payload.totalPallets !== null && payload.totalPallets < existing.completedPallets) {
        throw new Error('Całkowita liczba palet nie może być mniejsza niż wykonany wolumen');
      }
      merged.totalPallets = payload.totalPallets;
      merged.remainingPallets = payload.totalPallets === null ? 0 : payload.totalPallets - merged.completedPallets;
    }

    if (payload.status === 'archived') {
      merged.archived = true;
    }

    const statusValidationError = validateRequestedTaskStatus(merged, payload.status, payload.archived);
    if (statusValidationError) {
      throw new Error(statusValidationError);
    }

    const normalized = reconcileTaskStatus(merged, payload.status);
    await putById(collections.actionTasks, normalized);

    if (normalized.status === 'completed' || normalized.status === 'cancelled') {
      for (const workerId of normalized.participantWorkerIds) {
        const worker = await readById<User>(collections.users, workerId);
        if (!worker) continue;
        const nextWorker: User = {
          ...worker,
          availabilityStatus: normalized.status === 'completed' ? 'completed' : 'available',
          updatedAt: toIsoNow()
        };
        await putById(collections.users, nextWorker);
        await pushAudit('user', workerId, 'worker_status_update', worker, nextWorker, actor);
      }
    }

    await pushAudit('actionTask', id, 'update', existing, normalized, actor);
    emitDataSync(['tasks', 'users']);
    return normalized;
  }

  async getWorkSessionsByTask(taskId: string) {
    const snap = await getDocs(query(collection(getDb(), collections.workSessions), where('actionTaskId', '==', taskId)));
    const rows = snap.docs.map((row) => row.data() as WorkSession);
    return rows
      .map((row) => ({ ...row, rampNumber: row.rampNumber ?? '—' }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getWorkSessions(options?: { fromDate?: string; toDate?: string }) {
    const constraints = [];
    if (options?.fromDate) {
      constraints.push(where('startedAt', '>=', new Date(`${options.fromDate}T00:00:00`).toISOString()));
    }
    if (options?.toDate) {
      constraints.push(where('startedAt', '<=', new Date(`${options.toDate}T23:59:59`).toISOString()));
    }
    const snap = await getDocs(query(collection(getDb(), collections.workSessions), ...constraints));
    const filtered = snap.docs.map((row) => row.data() as WorkSession);

    return filtered
      .map((row) => ({ ...row, rampNumber: row.rampNumber ?? '—' }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createWorkSession(payload: CreateWorkSessionPayload, actor: User) {
    assertCanRecordWorkSession(actor, payload.workerId);
    const db = getDb();
    const taskRef = doc(db, collections.actionTasks, payload.actionTaskId);
    const workerRef = doc(db, collections.users, payload.workerId);
    const sessionRef = doc(db, collections.workSessions, createId());

    const createdSession = await runTransaction(db, async (tx) => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists()) throw new Error('Nie znaleziono akcji');
      const task = normalizeTaskRow(taskSnap.data() as ActionTask);
      assertTaskAcceptsWorkSession(task, payload.workerId);

      const workerSnap = await tx.get(workerRef);
      if (!workerSnap.exists()) throw new Error('Nie znaleziono pracownika');
      const worker = workerSnap.data() as User;
      if (!worker.isActive) throw new Error('Pracownik jest dezaktywowany');

      const validationError = validateSessionInput(
        task,
        payload.rampNumber,
        payload.palletsCompletedInSession,
        payload.startedAt,
        payload.endedAt
      );
      if (validationError) throw new Error(validationError);

      const nextTask = normalizeTaskAfterProgress({
        ...task,
        completedPallets: task.completedPallets + payload.palletsCompletedInSession,
        remainingPallets: Math.max(0, (task.totalPallets ?? 0) - (task.completedPallets + payload.palletsCompletedInSession)),
        status: 'executing',
        updatedByUserId: actor.id,
        updatedByUserName: actor.displayName,
        updatedAt: toIsoNow()
      });

      const session: WorkSession = withTimestamps({
        id: sessionRef.id,
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

      const nextWorker: User = {
        ...worker,
        availabilityStatus: nextTask.status === 'completed' ? 'completed' : 'in_action',
        updatedAt: toIsoNow()
      };

      tx.set(taskRef, nextTask);
      tx.set(sessionRef, session);
      tx.set(workerRef, nextWorker);
      return { session, oldTask: task, newTask: nextTask, oldWorker: worker, newWorker: nextWorker };
    });

    await pushAudit('workSession', createdSession.session.id, 'create', null, createdSession.session, actor);
    await pushAudit('actionTask', payload.actionTaskId, 'progress_update', createdSession.oldTask, createdSession.newTask, actor);
    await pushAudit('user', payload.workerId, 'worker_status_update', createdSession.oldWorker, createdSession.newWorker, actor);

    if (createdSession.newTask.status === 'completed') {
      for (const participantId of createdSession.newTask.participantWorkerIds) {
        if (participantId === payload.workerId) continue;
        const worker = await readById<User>(collections.users, participantId);
        if (!worker) continue;
        const nextWorker: User = {
          ...worker,
          availabilityStatus: createdSession.newTask.status === 'completed' ? 'completed' : 'available',
          updatedAt: toIsoNow()
        };
        await putById(collections.users, nextWorker);
        await pushAudit('user', participantId, 'worker_status_update', worker, nextWorker, actor);
      }
    }

    const dateKey = toDateKey(payload.startedAt);
    const existingDay = await getWorkDayByWorkerAndDate(payload.workerId, dateKey);
    const day =
      existingDay ??
      withTimestamps({
        id: createId(),
        workerId: payload.workerId,
        workerName: createdSession.session.workerName,
        date: dateKey,
        actualStart: `${dateKey}T00:00:00.000Z`,
        plannedEnd: `${dateKey}T08:00:00.000Z`,
        status: 'active' as const,
        totalPresenceMinutes: 0,
        totalWorkedMinutes: 0,
        totalGapMinutes: 0
      });
    if (!existingDay) {
      await putById(collections.workDays, day);
      await pushAudit('workDay', day.id, 'auto_create', null, day, actor);
    }

    const dayEntries = await getWorkLogEntriesByDay(day.id);
    const openActionEntry = dayEntries
      .filter((entry) => entry.relatedActionId === payload.actionTaskId && !entry.endTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
    if (openActionEntry) {
      const updatedEntry: WorkLogEntry = {
        ...openActionEntry,
        startTime: payload.startedAt,
        endTime: payload.endedAt,
        durationMinutes: calculateMinutes(payload.startedAt, payload.endedAt),
        palletsCompleted: (openActionEntry.palletsCompleted ?? 0) + payload.palletsCompletedInSession,
        updatedAt: toIsoNow()
      };
      await putById(collections.workLogEntries, updatedEntry);
    } else {
      const entry: WorkLogEntry = withTimestamps({
        id: createId(),
        workDayId: day.id,
        workerId: payload.workerId,
        workerName: createdSession.session.workerName,
        source: 'action' as const,
        workTypeId: 'wt-action',
        workTypeName: 'Akcja magazynowa',
        relatedActionId: createdSession.newTask.id,
        relatedActionType: createdSession.newTask.actionTypeName,
        relatedCarrierId: createdSession.newTask.carrierId,
        relatedCarrierName: createdSession.newTask.carrierName,
        relatedVehicleCode: createdSession.newTask.vehicleCode,
        startTime: payload.startedAt,
        endTime: payload.endedAt,
        durationMinutes: calculateMinutes(payload.startedAt, payload.endedAt),
        palletsCompleted: payload.palletsCompletedInSession,
        comment: payload.comment,
        isAutoClosed: false
      });
      await putById(collections.workLogEntries, entry);
    }

    emitDataSync(['tasks', 'sessions', 'users', 'workdays']);
    return createdSession.session;
  }

  async createProblemReport(payload: CreateProblemReportPayload, actor: User) {
    assertCanCreateProblemReport(actor);
    let vehicleCode = payload.vehicleCode?.trim() ?? '';
    if (payload.actionTaskId) {
      const task = await readById<ActionTask>(collections.actionTasks, payload.actionTaskId);
      if (!task) throw new Error('Nie znaleziono akcji do zgłoszenia problemu');
      vehicleCode = task.vehicleCode;
    }
    const validationError = validateProblemReportInput(payload.issueType, payload.rampNumber, payload.shortDescription, vehicleCode);
    if (validationError) throw new Error(validationError);

    const now = toIsoNow();
    const report: ProblemReport = withTimestamps({
      id: createId(),
      actionTaskId: payload.actionTaskId,
      vehicleCode,
      issueType: payload.issueType,
      rampNumber: payload.rampNumber.trim(),
      shortDescription: payload.shortDescription.trim(),
      photoUrl: payload.photoUrl?.trim() || undefined,
      message: `Problem: ${payload.issueType}\nMaszyna: ${vehicleCode}\nRampa: ${payload.rampNumber}\nCzas: ${now}\nZgłosił: ${actor.displayName}`,
      status: 'new' as const,
      createdByUserId: actor.id,
      createdByUserName: actor.displayName,
      createdByUserRole: actor.role,
      updatedByUserId: actor.id,
      updatedByUserName: actor.displayName
    });

    await putById(collections.problemReports, report);
    await pushAudit('problemReport', report.id, 'create', null, report, actor);
    emitDataSync(['problems']);
    return report;
  }

  async getProblemReports(filters: ProblemReportFilters | undefined, actor: User) {
    const isAdmin = actor.role === 'admin' || actor.role === 'superadmin';
    const constraints = [] as Array<ReturnType<typeof where>>;
    if (!isAdmin) constraints.push(where('createdByUserId', '==', actor.id));
    if (filters?.actionTaskId) constraints.push(where('actionTaskId', '==', filters.actionTaskId));
    if (filters?.status && filters.status !== 'all') constraints.push(where('status', '==', filters.status));
    if (filters?.issueType && filters.issueType !== 'all') constraints.push(where('issueType', '==', filters.issueType));

    const snap = await getDocs(query(collection(getDb(), collections.problemReports), ...constraints));
    const rows = snap.docs.map((row) => row.data() as ProblemReport);
    return rows
      .filter((item) =>
        filters?.rampNumber ? item.rampNumber.toLowerCase().includes(filters.rampNumber.toLowerCase()) : true
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateProblemReportStatus(id: string, status: ProblemReport['status'], actor: User) {
    assertCanManageProblemReport(actor);
    const existing = await readById<ProblemReport>(collections.problemReports, id);
    if (!existing) throw new Error('Nie znaleziono zgłoszenia');

    const next: ProblemReport = {
      ...existing,
      status,
      updatedByUserId: actor.id,
      updatedByUserName: actor.displayName,
      updatedAt: toIsoNow(),
      resolvedAt: status === 'resolved' ? toIsoNow() : existing.resolvedAt
    };
    await putById(collections.problemReports, next);
    await pushAudit('problemReport', id, 'status_update', existing, next, actor);
    emitDataSync(['problems']);
    return next;
  }

  async getWorkTypes() {
    const rows = await ensureDefaultWorkTypes();
    return rows.filter((entry) => entry.isActive).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }

  async upsertWorkType(workType: Omit<WorkTypeDictionary, 'createdAt' | 'updatedAt'>, actor: User) {
    assertAdmin(actor);
    const existing = await readById<WorkTypeDictionary>(collections.workTypes, workType.id);
    if (existing) {
      const next: WorkTypeDictionary = {
        ...existing,
        name: workType.name,
        category: workType.category,
        isActive: workType.isActive,
        updatedAt: toIsoNow()
      };
      await putById(collections.workTypes, next);
      await pushAudit('workType', next.id, 'update', existing, next, actor);
      return next;
    }

    const next = withTimestamps(workType);
    await putById(collections.workTypes, next);
    await pushAudit('workType', next.id, 'create', null, next, actor);
    return next;
  }

  async getWorkDayByDate(workerId: string, date: string, actor: User) {
    assertCanAccessWorkerData(actor, workerId);
    return getWorkDayByWorkerAndDate(workerId, date);
  }

  async getWorkDays(filters: WorkDaysFilters | undefined, actor: User) {
    const constraints = [] as Array<ReturnType<typeof where>>;
    if (actor.role === 'worker') constraints.push(where('workerId', '==', actor.id));
    if (filters?.workerId && actor.role !== 'worker') constraints.push(where('workerId', '==', filters.workerId));
    if (filters?.date) constraints.push(where('date', '==', filters.date));
    if (filters?.status && filters.status !== 'all') constraints.push(where('status', '==', filters.status));
    const snap = await getDocs(query(collection(getDb(), collections.workDays), ...constraints));
    const rows = snap.docs.map((row) => row.data() as WorkDay);
    return rows.sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt));
  }

  async startWorkDay(payload: StartWorkDayPayload, actor: User) {
    assertCanAccessWorkerData(actor, payload.workerId);
    const worker = await readById<User>(collections.users, payload.workerId);
    if (!worker) throw new Error('Nie znaleziono pracownika');
    const existing = await getWorkDayByWorkerAndDate(payload.workerId, payload.date);
    if (existing?.status === 'active') return existing;
    if (ensureEndAfterStart(payload.actualStart, payload.plannedEnd)) {
      throw new Error('Planowane zakończenie musi być późniejsze niż start pracy.');
    }

    const workTypes = await this.getWorkTypes();
    const draftDay: Pick<WorkDay, 'actualStart' | 'actualEnd' | 'date'> = {
      actualStart: payload.actualStart,
      actualEnd: undefined,
      date: payload.date
    };

    const intervals: WorkLogEntry[] = payload.preShiftIntervals.map((item) => {
      const type = workTypes.find((entry) => entry.id === item.workTypeId);
      if (!type) throw new Error('Nie znaleziono typu pracy');
      const validationError = ensureEndAfterStart(item.startTime, item.endTime);
      if (validationError) throw new Error(validationError);
      const dayBoundError = validateEntryInWorkDayBounds(draftDay, item.startTime, item.endTime);
      if (dayBoundError) throw new Error(dayBoundError);
      return withTimestamps({
        id: createId(),
        workDayId: '',
        workerId: worker.id,
        workerName: worker.displayName,
        source: 'manual' as const,
        workTypeId: type.id,
        workTypeName: type.name,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: calculateMinutes(item.startTime, item.endTime),
        comment: item.comment,
        isAutoClosed: false
      });
    });
    if (detectOverlaps(intervals).length > 0) throw new Error('Wykryto nakładające się interwały.');

    const day: WorkDay = withTimestamps({
      id: createId(),
      workerId: worker.id,
      workerName: worker.displayName,
      date: payload.date,
      actualStart: payload.actualStart,
      plannedEnd: payload.plannedEnd,
      status: 'active' as const,
      totalPresenceMinutes: 0,
      totalWorkedMinutes: 0,
      totalGapMinutes: 0
    });

    await putById(collections.workDays, day);
    for (const interval of intervals) {
      const entry: WorkLogEntry = { ...interval, workDayId: day.id };
      await putById(collections.workLogEntries, entry);
    }
    await pushAudit('workDay', day.id, 'start_day', null, day, actor);
    return day;
  }

  async updateWorkDayPlannedEnd(workDayId: string, plannedEnd: string, actor: User) {
    const day = await readById<WorkDay>(collections.workDays, workDayId);
    if (!day) throw new Error('Nie znaleziono karty pracy');
    assertCanAccessWorkerData(actor, day.workerId);
    if (day.status !== 'active' && actor.role === 'worker') throw new Error('Karta pracy jest zamknięta');
    const validationError = ensureEndAfterStart(day.actualStart, plannedEnd);
    if (validationError) throw new Error(validationError);
    const next: WorkDay = {
      ...day,
      plannedEnd,
      updatedAt: toIsoNow()
    };
    await putById(collections.workDays, next);
    await pushAudit('workDay', day.id, 'update_planned_end', day, next, actor);
    return next;
  }

  async closeWorkDay(workDayId: string, payload: import('../repositories/types').CloseWorkDayPayload, actor: User) {
    const day = await readById<WorkDay>(collections.workDays, workDayId);
    if (!day) throw new Error('Nie znaleziono karty pracy');
    assertCanAccessWorkerData(actor, day.workerId);
    const entries = await getWorkLogEntriesByDay(day.id);
    if (entries.some((entry) => !entry.endTime)) throw new Error('Nie można zamknąć dnia: aktywność jest nadal otwarta.');
    if (detectOverlaps(entries).length > 0) throw new Error('Nie można zamknąć dnia: wykryto nakładanie interwałów.');
    const closeEval = evaluateDayClose(day.plannedEnd, payload.actualEnd);
    if (closeEval.earlyByMinutes > 0 && !payload.exitTarget) {
      throw new Error('Wybierz, dokąd idziesz po zakończeniu pracy na przyjęciach.');
    }
    if (payload.exitTarget === 'other_process' && !payload.exitWorkTypeId) {
      throw new Error('Wybierz proces, do którego przechodzisz po przyjęciach.');
    }
    const exitWorkType =
      payload.exitWorkTypeId ? await readById<WorkTypeDictionary>(collections.workTypes, payload.exitWorkTypeId) : null;
    const next: WorkDay = {
      ...day,
      actualEnd: payload.actualEnd,
      countedEnd: closeEval.countedEnd,
      exitTarget: payload.exitTarget,
      exitWorkTypeId: payload.exitTarget === 'other_process' ? payload.exitWorkTypeId : undefined,
      exitWorkTypeName: payload.exitTarget === 'other_process' ? exitWorkType?.name : undefined,
      exitComment: payload.exitComment,
      status: 'closed',
      updatedAt: toIsoNow()
    };
    const summary = summarizeWorkDay(next, entries);
    next.totalWorkedMinutes = summary.totalWorkedMinutes;
    next.totalGapMinutes = summary.totalGapMinutes;
    next.totalPresenceMinutes = summary.totalPresenceMinutes;
    await putById(collections.workDays, next);
    await pushAudit('workDay', day.id, 'close_day', day, next, actor);
    return next;
  }

  async getWorkLogEntries(workDayId: string, actor: User) {
    const day = await readById<WorkDay>(collections.workDays, workDayId);
    if (!day) throw new Error('Nie znaleziono karty pracy');
    assertCanAccessWorkerData(actor, day.workerId);
    const entries = await getWorkLogEntriesByDay(workDayId);
    return sortWorkEntries(entries);
  }

  async addManualWorkLogEntry(payload: AddManualWorkLogEntryPayload, actor: User) {
    const day = await readById<WorkDay>(collections.workDays, payload.workDayId);
    if (!day) throw new Error('Nie znaleziono karty pracy');
    assertCanAccessWorkerData(actor, day.workerId);
    if (day.status !== 'active' && actor.role === 'worker') throw new Error('Karta pracy jest zamknięta');
    if (payload.workerId !== day.workerId) throw new Error('Niepoprawny pracownik');
    const validationError = ensureEndAfterStart(payload.startTime, payload.endTime);
    if (validationError) throw new Error(validationError);
    const workType = await readById<WorkTypeDictionary>(collections.workTypes, payload.workTypeId);
    if (!workType) throw new Error('Nie znaleziono typu pracy');
    const dayBoundError = validateEntryInWorkDayBounds(day, payload.startTime, payload.endTime);
    if (dayBoundError) throw new Error(dayBoundError);

    const next: WorkLogEntry = withTimestamps({
      id: createId(),
      workDayId: day.id,
      workerId: day.workerId,
      workerName: day.workerName,
      source: 'manual' as const,
      workTypeId: workType.id,
      workTypeName: workType.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      durationMinutes: calculateMinutes(payload.startTime, payload.endTime),
      comment: payload.comment,
      isAutoClosed: false
    });
    const existing = await getWorkLogEntriesByDay(day.id);
    if (detectOverlaps([...existing, next]).length > 0) throw new Error('Nakładające się interwały nie są dozwolone.');
    await putById(collections.workLogEntries, next);
    await pushAudit('workLogEntry', next.id, 'create_manual', null, next, actor);
    return next;
  }

  async updateManualWorkLogEntry(entryId: string, payload: UpdateManualWorkLogEntryPayload, actor: User) {
    const entry = await readById<WorkLogEntry>(collections.workLogEntries, entryId);
    if (!entry) throw new Error('Nie znaleziono wpisu');
    const day = await readById<WorkDay>(collections.workDays, entry.workDayId);
    if (!day) throw new Error('Nie znaleziono karty pracy');
    assertCanAccessWorkerData(actor, day.workerId);
    if (entry.source !== 'manual' && actor.role === 'worker') throw new Error('Pracownik może edytować tylko wpisy ręczne');
    if (day.status !== 'active' && actor.role === 'worker') throw new Error('Karta pracy jest zamknięta');

    let next = { ...entry };
    if (payload.workTypeId) {
      const workType = await readById<WorkTypeDictionary>(collections.workTypes, payload.workTypeId);
      if (!workType) throw new Error('Nie znaleziono typu pracy');
      next = { ...next, workTypeId: workType.id, workTypeName: workType.name };
    }
    if (payload.startTime) next.startTime = payload.startTime;
    if (payload.endTime) next.endTime = payload.endTime;
    if (payload.comment !== undefined) next.comment = payload.comment;
    if (!next.endTime) throw new Error('Wpis ręczny musi mieć czas zakończenia');
    const validationError = ensureEndAfterStart(next.startTime, next.endTime);
    if (validationError) throw new Error(validationError);
    const dayBoundError = validateEntryInWorkDayBounds(day, next.startTime, next.endTime);
    if (dayBoundError) throw new Error(dayBoundError);
    next.durationMinutes = calculateMinutes(next.startTime, next.endTime);
    next.updatedAt = toIsoNow();
    const entries = await getWorkLogEntriesByDay(day.id);
    const merged = entries.map((item) => (item.id === next.id ? next : item));
    if (detectOverlaps(merged).length > 0) throw new Error('Nakładające się interwały nie są dozwolone.');
    await putById(collections.workLogEntries, next);
    await pushAudit('workLogEntry', next.id, 'update_manual', entry, next, actor);
    return next;
  }

  async getAuditLogs(entityType: AuditLog['entityType'] | undefined, entityId: string | undefined, actor: User) {
    assertAdmin(actor);
    const constraints = [];
    if (entityType) constraints.push(where('entityType', '==', entityType));
    if (entityId) constraints.push(where('entityId', '==', entityId));
    const snap = await getDocs(query(collection(getDb(), collections.auditLogs), ...constraints));
    const rows = snap.docs.map((row) => row.data() as AuditLog);
    return rows
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }
}
