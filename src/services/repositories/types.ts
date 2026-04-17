import type {
  ActionTask,
  ActionTaskFilters,
  ActionType,
  AuditLog,
  Carrier,
  ProblemIssueType,
  ProblemReport,
  ProblemStatus,
  User,
  WorkDay,
  WorkDayExitTarget,
  WorkLogEntry,
  WorkTypeDictionary,
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
  rampNumber: string;
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

export interface CreateProblemReportPayload {
  actionTaskId?: string;
  vehicleCode?: string;
  issueType: ProblemIssueType;
  rampNumber: string;
  shortDescription: string;
  photoUrl?: string;
}

export interface ProblemReportFilters {
  status?: ProblemStatus | 'all';
  issueType?: ProblemIssueType | 'all';
  rampNumber?: string;
  actionTaskId?: string;
}

export interface WorkDayIntervalInput {
  startTime: string;
  endTime: string;
  workTypeId: string;
  comment?: string;
}

export interface StartWorkDayPayload {
  workerId: string;
  date: string;
  actualStart: string;
  plannedEnd: string;
  preShiftIntervals: WorkDayIntervalInput[];
}

export interface CloseWorkDayPayload {
  actualEnd: string;
  exitTarget?: WorkDayExitTarget;
  exitWorkTypeId?: string;
  exitComment?: string;
}

export interface AddManualWorkLogEntryPayload {
  workDayId: string;
  workerId: string;
  workTypeId: string;
  startTime: string;
  endTime: string;
  comment?: string;
}

export interface UpdateManualWorkLogEntryPayload extends Partial<Omit<AddManualWorkLogEntryPayload, 'workDayId' | 'workerId'>> {
  endTime?: string;
}

export interface WorkDaysFilters {
  date?: string;
  workerId?: string;
  status?: WorkDay['status'] | 'all';
}

export interface Repository {
  mode: 'mock' | 'firebase';
  seedIfEmpty: () => Promise<void>;

  login: (payload: AuthLoginPayload) => Promise<User>;

  getUserById: (id: string) => Promise<User | null>;
  getUsers: (actor: User) => Promise<User[]>;
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

  createProblemReport: (payload: CreateProblemReportPayload, actor: User) => Promise<ProblemReport>;
  getProblemReports: (filters: ProblemReportFilters | undefined, actor: User) => Promise<ProblemReport[]>;
  updateProblemReportStatus: (id: string, status: ProblemStatus, actor: User) => Promise<ProblemReport>;

  getWorkTypes: () => Promise<WorkTypeDictionary[]>;
  upsertWorkType: (workType: Omit<WorkTypeDictionary, 'createdAt' | 'updatedAt'>, actor: User) => Promise<WorkTypeDictionary>;
  getWorkDayByDate: (workerId: string, date: string, actor: User) => Promise<WorkDay | null>;
  getWorkDays: (filters: WorkDaysFilters | undefined, actor: User) => Promise<WorkDay[]>;
  startWorkDay: (payload: StartWorkDayPayload, actor: User) => Promise<WorkDay>;
  updateWorkDayPlannedEnd: (workDayId: string, plannedEnd: string, actor: User) => Promise<WorkDay>;
  closeWorkDay: (workDayId: string, payload: CloseWorkDayPayload, actor: User) => Promise<WorkDay>;
  getWorkLogEntries: (workDayId: string, actor: User) => Promise<WorkLogEntry[]>;
  addManualWorkLogEntry: (payload: AddManualWorkLogEntryPayload, actor: User) => Promise<WorkLogEntry>;
  updateManualWorkLogEntry: (entryId: string, payload: UpdateManualWorkLogEntryPayload, actor: User) => Promise<WorkLogEntry>;

  getAuditLogs: (entityType: AuditLog['entityType'] | undefined, entityId: string | undefined, actor: User) => Promise<AuditLog[]>;
}
