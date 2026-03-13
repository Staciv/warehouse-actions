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
import { normalizeTaskAfterProgress, reconcileTaskStatus } from '../../entities/action-task';
import { calculateDurationMinutes, validateSessionInput } from '../../entities/work-session';
import { toIsoNow } from '../../shared/utils/date';
import { sha256 } from '../../shared/utils/hash';
import { createId } from '../../shared/utils/id';
import type {
  ActionTask,
  ActionTaskFilters,
  ActionType,
  AuditLog,
  Carrier,
  User,
  WorkSession
} from '../../types/domain';
import { seedActionTasks, seedActionTypes, seedCarriers, seedUsers, seedWorkSessions } from '../seed/seedData';
import {
  applyTaskFilters,
  normalizeTaskRow,
  sanitizeUserForClient,
  withTimestamps
} from '../repositories/helpers';
import {
  assertAdmin,
  assertCanManageUserRole,
  assertCanRecordWorkSession,
  assertTaskAcceptsWorkSession
} from '../repositories/permissions';
import type {
  CreateActionTaskPayload,
  CreateUserPayload,
  CreateWorkSessionPayload,
  Repository,
  UpdateActionTaskPayload,
  UpdateUserPayload
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

    return createdSession.session;
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
