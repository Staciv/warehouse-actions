import type {
  ActionTask,
  ActionTaskFilters,
  ActionType,
  AuditLog,
  Carrier,
  User,
  WorkSession
} from '../../types/domain';

export interface CreateActionTaskPayload {
  carrierId: string;
  vehicleCode: string;
  arrivalDate: string;
  arrivalTime?: string;
  actionTypeId: string;
  totalPallets: number | null;
  priority: 1 | 2 | 3 | 4;
  note?: string;
  internalComment?: string;
  workerComment?: string;
  labels?: string[];
  canBeSplit?: boolean;
}

export interface UpdateActionTaskPayload extends Partial<CreateActionTaskPayload> {
  status?: ActionTask['status'];
  archived?: boolean;
}

export interface CreateWorkSessionPayload {
  actionTaskId: string;
  workerId: string;
  startedAt: string;
  endedAt: string;
  palletsCompletedInSession: number;
  comment?: string;
}

export interface AuthLoginPayload {
  login: string;
  password: string;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  role: User['role'];
  isActive: boolean;
}

export interface UpdateUserPayload extends Partial<Omit<CreateUserPayload, 'password'>> {
  password?: string;
}

export interface QueryOptions {
  fromDate?: string;
  toDate?: string;
}

export interface Repository {
  mode: 'mock' | 'firebase';
  seedIfEmpty: () => Promise<void>;

  login: (payload: AuthLoginPayload) => Promise<User>;

  getUsers: () => Promise<User[]>;
  createUser: (payload: CreateUserPayload, actor: User) => Promise<User>;
  updateUser: (id: string, payload: UpdateUserPayload, actor: User) => Promise<User>;

  getCarriers: () => Promise<Carrier[]>;
  upsertCarrier: (carrier: Omit<Carrier, 'createdAt' | 'updatedAt'>, actor: User) => Promise<Carrier>;
  deleteCarrier: (id: string, actor: User) => Promise<void>;

  getActionTypes: () => Promise<ActionType[]>;
  upsertActionType: (actionType: Omit<ActionType, 'createdAt' | 'updatedAt'>, actor: User) => Promise<ActionType>;

  getActionTasks: (filters?: ActionTaskFilters) => Promise<ActionTask[]>;
  getActionTaskById: (id: string) => Promise<ActionTask | null>;
  createActionTask: (payload: CreateActionTaskPayload, actor: User) => Promise<ActionTask>;
  updateActionTask: (id: string, payload: UpdateActionTaskPayload, actor: User) => Promise<ActionTask>;
  startActionExecution: (taskId: string, workerId: string, actor: User) => Promise<ActionTask>;
  stopActionExecution: (taskId: string, workerId: string, actor: User) => Promise<ActionTask>;

  getWorkSessionsByTask: (taskId: string) => Promise<WorkSession[]>;
  getWorkSessions: (options?: QueryOptions) => Promise<WorkSession[]>;
  createWorkSession: (payload: CreateWorkSessionPayload, actor: User) => Promise<WorkSession>;

  getAuditLogs: (entityType?: AuditLog['entityType'], entityId?: string) => Promise<AuditLog[]>;
}
