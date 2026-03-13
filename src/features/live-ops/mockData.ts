import type { LiveAction, LiveWorker } from '../../types/live-ops';

export const mockLiveWorkers: LiveWorker[] = [
  {
    id: 'w-1',
    name: 'Paweł Iwanow',
    role: 'worker',
    status: 'in_action',
    currentActionId: 'a-1',
    currentActionName: 'Slip-sheet / łapami na europaletę',
    startedAt: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
    workedMinutes: 72
  },
  {
    id: 'w-2',
    name: 'Marek Nowak',
    role: 'worker',
    status: 'available',
    currentActionId: null,
    startedAt: null,
    workedMinutes: 0
  }
];

export const mockLiveActions: LiveAction[] = [
  {
    id: 'a-1',
    truckId: 'PL-WA-1201',
    carrier: 'Baltic Freight',
    actionType: 'Slip-sheet / łapami na europaletę',
    totalPallets: 50,
    completedPallets: 30,
    remainingPallets: 20,
    progressPercent: 60,
    status: 'in_progress',
    startTime: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
    endTime: null,
    assignedWorkers: ['w-1'],
    assignedWorkerNames: ['Paweł Iwanow'],
    executions: [
      {
        workerId: 'w-1',
        palletsDone: 30,
        startedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        endedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        comment: 'Częściowe wykonanie'
      }
    ]
  }
];
