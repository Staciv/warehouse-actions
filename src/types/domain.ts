export type UserRole = 'superadmin' | 'admin' | 'worker';
export type WorkerAvailabilityStatus = 'available' | 'busy' | 'in_action' | 'paused' | 'offline' | 'completed';

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
export type ProblemIssueType =
  | 'missing_label'
  | 'damaged_pallet'
  | 'missing_documents'
  | 'quantity_mismatch'
  | 'ramp_busy'
  | 'no_equipment'
  | 'other';
export type ProblemStatus = 'new' | 'in_progress' | 'resolved' | 'rejected';
export type WorkDayStatus = 'active' | 'closed';
export type WorkLogSource = 'manual' | 'action';
export type WorkTypeCategory = 'manual' | 'pre_shift' | 'gap_fill' | 'system';

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
  rampNumber: string;
  startedAt: string;
  endedAt: string;
  startManualDateTime?: string;
  endManualDateTime?: string;
  palletsCompletedInSession: number;
  durationMinutes: number;
  comment?: string;
}

export interface AuditLog extends BaseEntity {
  entityType: 'user' | 'carrier' | 'actionType' | 'actionTask' | 'workSession' | 'problemReport' | 'workDay' | 'workLogEntry' | 'workType';
  entityId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  performedByUserId: string;
  performedByUserName: string;
  performedAt: string;
}

export interface ProblemReport extends BaseEntity {
  actionTaskId?: string;
  vehicleCode: string;
  issueType: ProblemIssueType;
  rampNumber: string;
  shortDescription: string;
  photoUrl?: string;
  message: string;
  status: ProblemStatus;
  createdByUserId: string;
  createdByUserName: string;
  createdByUserRole: UserRole;
  updatedByUserId: string;
  updatedByUserName: string;
  resolvedAt?: string;
}

export interface WorkTypeDictionary extends BaseEntity {
  name: string;
  category: WorkTypeCategory;
  isActive: boolean;
}

export interface WorkDay extends BaseEntity {
  workerId: string;
  workerName: string;
  date: string;
  actualStart: string;
  actualEnd?: string;
  countedEnd?: string;
  plannedEnd: string;
  status: WorkDayStatus;
  totalPresenceMinutes: number;
  totalWorkedMinutes: number;
  totalGapMinutes: number;
}

export interface WorkLogEntry extends BaseEntity {
  workDayId: string;
  workerId: string;
  workerName: string;
  source: WorkLogSource;
  workTypeId: string;
  workTypeName: string;
  relatedActionId?: string;
  relatedActionType?: string;
  relatedCarrierId?: string;
  relatedCarrierName?: string;
  relatedVehicleCode?: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  palletsCompleted?: number;
  comment?: string;
  isAutoClosed: boolean;
}

export interface AuthSession {
  userId: string;
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
