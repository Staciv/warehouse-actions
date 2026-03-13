export type WorkerStatus = 'available' | 'in_action' | 'paused' | 'offline' | 'completed';

export type ActionStatus = 'planned' | 'in_progress' | 'completed';

export type Worker = {
  id: string;
  name: string;
  role: string;
  status: WorkerStatus;
  currentActionId?: string | null;
  startedAt?: string | null;
};

export type ActionExecution = {
  workerId: string;
  palletsDone: number;
  startedAt: string;
  endedAt?: string | null;
  comment?: string;
};

export type Action = {
  id: string;
  truckId: string;
  carrier: string;
  actionType: string;
  totalPallets: number;
  completedPallets: number;
  status: ActionStatus;
  startTime?: string | null;
  endTime?: string | null;
  assignedWorkers: string[];
  executions: ActionExecution[];
};

export type LiveAction = Action & {
  assignedWorkerNames: string[];
  remainingPallets: number;
  progressPercent: number;
};

export type LiveWorker = Worker & {
  currentActionName?: string;
  workedMinutes?: number;
};
