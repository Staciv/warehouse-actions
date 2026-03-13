import type { ActionTask, User, WorkSession } from '../../types/domain';
import type { LiveAction, LiveWorker, WorkerStatus } from '../../types/live-ops';

const toActionStatus = (status: ActionTask['status']): LiveAction['status'] => {
  if (status === 'completed') return 'completed';
  if (status === 'executing' || status === 'in_progress' || status === 'partial') return 'in_progress';
  return 'planned';
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

const isUserStatus = (status: User['availabilityStatus']): status is WorkerStatus =>
  status === 'available' ||
  status === 'in_action' ||
  status === 'paused' ||
  status === 'offline' ||
  status === 'completed';

const minutesDiff = (fromIso?: string | null, toIso = new Date().toISOString()) => {
  if (!fromIso) return 0;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.floor((to - from) / 60000);
};

export const buildLiveActions = (tasks: ActionTask[], sessions: WorkSession[]): LiveAction[] => {
  const sessionsByTask = new Map<string, WorkSession[]>();
  for (const session of sessions) {
    const existing = sessionsByTask.get(session.actionTaskId) ?? [];
    existing.push(session);
    sessionsByTask.set(session.actionTaskId, existing);
  }

  return tasks
    .map((task) => {
      const executions = (sessionsByTask.get(task.id) ?? [])
        .slice()
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

      const startTime = executions[0]?.startedAt ?? (task.status === 'executing' ? task.updatedAt : null);
      const endTime =
        task.status === 'completed' ? executions[executions.length - 1]?.endedAt ?? task.updatedAt : null;
      const total = task.totalPallets ?? 0;
      const progressPercent = total > 0 ? clampPercent((task.completedPallets / total) * 100) : 0;

      return {
        id: task.id,
        truckId: task.vehicleCode,
        carrier: task.carrierName,
        actionType: task.actionTypeName,
        totalPallets: total,
        completedPallets: task.completedPallets,
        status: toActionStatus(task.status),
        startTime,
        endTime,
        assignedWorkers: task.participantWorkerIds,
        assignedWorkerNames: task.participantWorkerNames,
        remainingPallets: task.remainingPallets,
        progressPercent,
        executions: executions.map((session) => ({
          workerId: session.workerId,
          palletsDone: session.palletsCompletedInSession,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          comment: session.comment
        }))
      } satisfies LiveAction;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1;
      return new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime();
    });
};

export const buildLiveWorkers = (users: User[], actions: LiveAction[], sessions: WorkSession[]): LiveWorker[] => {
  const sessionsByWorker = new Map<string, WorkSession[]>();
  for (const session of sessions) {
    const existing = sessionsByWorker.get(session.workerId) ?? [];
    existing.push(session);
    sessionsByWorker.set(session.workerId, existing);
  }

  return users
    .filter((user) => user.role === 'worker')
    .map((user) => {
      const currentAction = actions.find((action) => action.status === 'in_progress' && action.assignedWorkers.includes(user.id));
      const workerSessions = (sessionsByWorker.get(user.id) ?? [])
        .slice()
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      const lastSession = workerSessions[0];

      let status: WorkerStatus;
      if (!user.isActive || user.availabilityStatus === 'offline') {
        status = 'offline';
      } else if (currentAction) {
        status = user.availabilityStatus === 'paused' ? 'paused' : 'in_action';
      } else if (isUserStatus(user.availabilityStatus) && user.availabilityStatus !== 'in_action') {
        status = user.availabilityStatus;
      } else if (lastSession) {
        status = 'completed';
      } else {
        status = 'available';
      }

      const startedAt =
        status === 'in_action' || status === 'paused'
          ? currentAction?.startTime ?? lastSession?.startedAt ?? null
          : null;

      return {
        id: user.id,
        name: user.displayName,
        role: user.role,
        status,
        currentActionId: currentAction?.id ?? null,
        currentActionName: currentAction?.actionType,
        startedAt,
        workedMinutes: status === 'in_action' || status === 'paused' ? minutesDiff(startedAt) : 0
      } satisfies LiveWorker;
    })
    .sort((a, b) => {
      const priority: Record<WorkerStatus, number> = {
        in_action: 0,
        paused: 1,
        available: 2,
        completed: 3,
        offline: 4
      };

      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      return a.name.localeCompare(b.name, 'ru');
    });
};
