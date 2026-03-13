export type UserRole = 'superadmin' | 'admin' | 'worker';
export type WorkerAvailabilityStatus = 'available' | 'busy';

export type TaskStatus =
  | 'planned'
  | 'executing'
  | 'cancelled'
  | 'draft'
  | 'inactive'
  | 'active'
  | 'in_progress'
  | 'partial'
  | 'completed'
  | 'deferred'
  | 'archived';

export type TaskPriority = 1 | 2 | 3 | 4;

export type DataMode = 'firebase' | 'mock';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseEntity {
  firstName: string;
  lastName: string;
  displayName: string;
  login: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  availabilityStatus: WorkerAvailabilityStatus;
}

export interface Carrier extends BaseEntity {
  name: string;
  code?: string;
  isActive: boolean;
}

export interface ActionType extends BaseEntity {
  key: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface ActionTask extends BaseEntity {
  carrierId: string;
  carrierName: string;
  vehicleCode: string;
  arrivalDate: string;
  arrivalTime?: string;
  actionTypeId: string;
  actionTypeName: string;
  totalPallets: number | null;
  completedPallets: number;
  remainingPallets: number;
  status: TaskStatus;
  priority: TaskPriority;
  note?: string;
  internalComment?: string;
  workerComment?: string;
  labels: string[];
  canBeSplit: boolean;
  participantWorkerIds: string[];
  participantWorkerNames: string[];
  createdByUserId: string;
  createdByUserName: string;
  updatedByUserId: string;
  updatedByUserName: string;
  archived: boolean;
}

export interface WorkSession extends BaseEntity {
  actionTaskId: string;
  workerId: string;
  workerName: string;
  startedAt: string;
  endedAt: string;
  startManualDateTime?: string;
  endManualDateTime?: string;
  palletsCompletedInSession: number;
  durationMinutes: number;
  comment?: string;
}

export interface AuditLog extends BaseEntity {
  entityType: 'user' | 'carrier' | 'actionType' | 'actionTask' | 'workSession';
  entityId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  performedByUserId: string;
  performedByUserName: string;
  performedAt: string;
}

export interface AuthSession {
  user: User;
  loginAt: string;
}

export interface ActionTaskFilters {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  carrierId?: string | 'all';
  actionTypeId?: string | 'all';
  vehicleQuery?: string;
  fromDate?: string;
  toDate?: string;
  onlyActive?: 'all' | 'active' | 'inactive';
}
