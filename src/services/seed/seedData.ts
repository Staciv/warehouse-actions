import type { ActionTask, ActionType, Carrier, ProblemReport, User, WorkDay, WorkLogEntry, WorkSession, WorkTypeDictionary } from '../../types/domain';

export interface SeedUser extends Omit<User, 'passwordHash' | 'createdAt' | 'updatedAt'> {
  plainPassword: string;
}

export const seedUsers: SeedUser[] = [
  {
    id: 'u-superadmin',
    firstName: 'Jan',
    lastName: 'Sokołow',
    displayName: 'Jan Sokołow',
    login: 'superadmin',
    plainPassword: 'superadmin123',
    role: 'superadmin',
    isActive: true,
    availabilityStatus: 'available'
  },
  {
    id: 'u-admin',
    firstName: 'Olga',
    lastName: 'Mironowa',
    displayName: 'Olga Mironowa',
    login: 'admin1',
    plainPassword: 'admin123',
    role: 'admin',
    isActive: true,
    availabilityStatus: 'available'
  },
  {
    id: 'u-worker-1',
    firstName: 'Paweł',
    lastName: 'Iwanow',
    displayName: 'Paweł Iwanow',
    login: 'worker1',
    plainPassword: 'worker123',
    role: 'worker',
    isActive: true,
    availabilityStatus: 'available'
  },
  {
    id: 'u-worker-2',
    firstName: 'Dmitrij',
    lastName: 'Kozłow',
    displayName: 'Dmitrij Kozłow',
    login: 'worker2',
    plainPassword: 'worker123',
    role: 'worker',
    isActive: true,
    availabilityStatus: 'available'
  },
  {
    id: 'u-worker-3',
    firstName: 'Marek',
    lastName: 'Nowak',
    displayName: 'Marek Nowak',
    login: 'worker3',
    plainPassword: 'worker123',
    role: 'worker',
    isActive: true,
    availabilityStatus: 'available'
  }
];

export const seedCarriers: Omit<Carrier, 'createdAt' | 'updatedAt'>[] = [
  { id: 'c-1', name: 'Baltic Freight', code: 'BF', isActive: true },
  { id: 'c-2', name: 'EuroTrans Logistic', code: 'ETL', isActive: true },
  { id: 'c-3', name: 'Nord Cargo', code: 'NC', isActive: true },
  { id: 'c-4', name: 'Vistula Transport', code: 'VT', isActive: true },
  { id: 'c-5', name: 'Mazovia Haulage', code: 'MH', isActive: true },
  { id: 'c-6', name: 'Central EU Trucking', code: 'CET', isActive: true },
  { id: 'c-7', name: 'Baltic Line Cargo', code: 'BLC', isActive: true },
  { id: 'c-8', name: 'CASTORAMA SUPPLIER', code: 'CAST', isActive: true },
  { id: 'c-9', name: 'AMICA HANDEL I MARKETING SPÓŁKA Z O.O.', code: 'AMICA', isActive: true },
  { id: 'c-10', name: 'FRANKE POLSKA SP. Z O.O.', code: 'FRANKE', isActive: true },
  { id: 'c-11', name: '3B SPA', code: '3B', isActive: true },
  { id: 'c-12', name: 'Media Profil SRL', code: 'MPSRL', isActive: true },
  { id: 'c-13', name: 'Laminex', code: 'LAM', isActive: true },
  { id: 'c-14', name: 'Firul', code: 'FIR', isActive: true },
  { id: 'c-15', name: 'SZYNAKA MEBLE SP. Z O.O.', code: 'SZYNAKA', isActive: true },
  { id: 'c-16', name: 'CT GROUP TOMASZEK SP. Z O.O.', code: 'CTGT', isActive: true },
  { id: 'c-17', name: 'TUS D.O.O. DEKANI', code: 'TUS', isActive: true },
  { id: 'c-18', name: 'VIBO', code: 'VIBO', isActive: true }
];

export const seedActionTypes: Omit<ActionType, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'at-1',
    key: 'single_to_euro',
    name: 'Przełożenie na europalety + bandowanie',
    description: 'Usunięcie pokryw/desek i zabezpieczenie ładunku na europalecie',
    isActive: true
  },
  {
    id: 'at-2',
    key: 'consolidation',
    name: 'Konsolidacja kompletów',
    description: 'Łączenie kompletów na jednej palecie',
    isActive: true
  },
  {
    id: 'at-3',
    key: 'slip_sheet',
    name: 'Slip-sheet / łapami na europaletę',
    description: 'Przełożenie po rozładunku z użyciem łap',
    isActive: true
  },
  {
    id: 'at-4',
    key: 'mix_split',
    name: 'Mix-paleta / rozdzielenie artykułów',
    description: 'Rozdzielenie artykułów na oddzielne palety i bandowanie',
    isActive: true
  }
];

export const seedActionTasks: Omit<ActionTask, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'task-1',
    carrierId: 'c-1',
    carrierName: 'Baltic Freight',
    vehicleCode: 'PL-WA-1201',
    arrivalDate: '2026-03-13T07:30:00.000Z',
    arrivalTime: '08:30',
    actionTypeId: 'at-3',
    actionTypeName: 'Slip-sheet / łapami na europaletę',
    totalPallets: 80,
    completedPallets: 30,
    remainingPallets: 50,
    status: 'executing',
    priority: 4,
    note: 'Kontener 4B',
    internalComment: 'Pilnie zamknąć do 15:00',
    workerComment: 'Sprawdzić mocowania',
    labels: ['container', 'priority'],
    canBeSplit: true,
    participantWorkerIds: ['u-worker-1'],
    participantWorkerNames: ['Paweł Iwanow'],
    createdByUserId: 'u-admin',
    createdByUserName: 'Olga Mironowa',
    updatedByUserId: 'u-admin',
    updatedByUserName: 'Olga Mironowa',
    archived: false
  },
  {
    id: 'task-2',
    carrierId: 'c-2',
    carrierName: 'EuroTrans Logistic',
    vehicleCode: 'PL-GD-5320',
    arrivalDate: '2026-03-13T06:20:00.000Z',
    arrivalTime: '07:20',
    actionTypeId: 'at-1',
    actionTypeName: 'Przełożenie na europalety + bandowanie',
    totalPallets: null,
    completedPallets: 0,
    remainingPallets: 0,
    status: 'planned',
    priority: 2,
    note: 'Oczekiwana awizacja',
    internalComment: '',
    workerComment: '',
    labels: ['waiting-docs'],
    canBeSplit: true,
    participantWorkerIds: [],
    participantWorkerNames: [],
    createdByUserId: 'u-admin',
    createdByUserName: 'Olga Mironowa',
    updatedByUserId: 'u-admin',
    updatedByUserName: 'Olga Mironowa',
    archived: false
  },
  {
    id: 'task-3',
    carrierId: 'c-3',
    carrierName: 'Nord Cargo',
    vehicleCode: 'DE-B-9021',
    arrivalDate: '2026-03-12T11:00:00.000Z',
    arrivalTime: '12:00',
    actionTypeId: 'at-2',
    actionTypeName: 'Konsolidacja kompletów',
    totalPallets: 24,
    completedPallets: 24,
    remainingPallets: 0,
    status: 'completed',
    priority: 3,
    note: 'Szafy seria A11',
    internalComment: '',
    workerComment: '',
    labels: ['furniture'],
    canBeSplit: true,
    participantWorkerIds: ['u-worker-2'],
    participantWorkerNames: ['Dmitrij Kozłow'],
    createdByUserId: 'u-superadmin',
    createdByUserName: 'Jan Sokołow',
    updatedByUserId: 'u-superadmin',
    updatedByUserName: 'Jan Sokołow',
    archived: false
  },
  {
    id: 'task-4',
    carrierId: 'c-1',
    carrierName: 'Baltic Freight',
    vehicleCode: 'LT-KA-4477',
    arrivalDate: '2026-03-13T09:00:00.000Z',
    arrivalTime: '10:00',
    actionTypeId: 'at-4',
    actionTypeName: 'Mix-paleta / rozdzielenie artykułów',
    totalPallets: 36,
    completedPallets: 0,
    remainingPallets: 36,
    status: 'planned',
    priority: 3,
    note: 'Wymagana strefa B2',
    internalComment: '',
    workerComment: '',
    labels: ['mixed-sku'],
    canBeSplit: true,
    participantWorkerIds: [],
    participantWorkerNames: [],
    createdByUserId: 'u-admin',
    createdByUserName: 'Olga Mironowa',
    updatedByUserId: 'u-admin',
    updatedByUserName: 'Olga Mironowa',
    archived: false
  }
];

export const seedWorkSessions: Omit<WorkSession, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'ws-1',
    actionTaskId: 'task-1',
    workerId: 'u-worker-1',
    workerName: 'Paweł Iwanow',
    rampNumber: 'R-03',
    startedAt: '2026-03-13T08:45:00.000Z',
    endedAt: '2026-03-13T10:15:00.000Z',
    startManualDateTime: '2026-03-13T08:45',
    endManualDateTime: '2026-03-13T10:15',
    palletsCompletedInSession: 30,
    durationMinutes: 90,
    comment: 'Wykonano pierwszy odcinek'
  },
  {
    id: 'ws-2',
    actionTaskId: 'task-3',
    workerId: 'u-worker-2',
    workerName: 'Dmitrij Kozłow',
    rampNumber: 'R-07',
    startedAt: '2026-03-12T12:20:00.000Z',
    endedAt: '2026-03-12T14:00:00.000Z',
    startManualDateTime: '2026-03-12T12:20',
    endManualDateTime: '2026-03-12T14:00',
    palletsCompletedInSession: 24,
    durationMinutes: 100,
    comment: 'Komplety złożone'
  }
];

export const seedProblemReports: Omit<ProblemReport, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'pr-1',
    actionTaskId: 'task-1',
    vehicleCode: 'PL-WA-1201',
    issueType: 'missing_label',
    rampNumber: 'R-05',
    shortDescription: 'Paleta bez etykiety, brak numeru referencyjnego.',
    message:
      'Problem: Paleta bez etykiety\nMaszyna: PL-WA-1201\nRampa: R-05\nCzas: 2026-03-13 09:10\nZgłosił: Paweł Iwanow',
    status: 'new',
    createdByUserId: 'u-worker-1',
    createdByUserName: 'Paweł Iwanow',
    createdByUserRole: 'worker',
    updatedByUserId: 'u-worker-1',
    updatedByUserName: 'Paweł Iwanow'
  }
];

export const seedWorkTypes: Omit<WorkTypeDictionary, 'createdAt' | 'updatedAt'>[] = [
  { id: 'wt-przyjecia', name: 'Przyjęcia', category: 'manual', isActive: true },
  { id: 'wt-preparacja', name: 'Preparacja', category: 'manual', isActive: true },
  { id: 'wt-retrak', name: 'Retrak', category: 'manual', isActive: true },
  { id: 'wt-ks', name: 'Kontrola stoku (K-S)', category: 'manual', isActive: true },
  { id: 'wt-cleaning', name: 'Sprzątanie', category: 'manual', isActive: true },
  { id: 'wt-help', name: 'Pomoc / inne zadanie', category: 'manual', isActive: true },
  { id: 'wt-other', name: 'Inna praca', category: 'manual', isActive: true },
  { id: 'wt-euro', name: 'EURO', category: 'manual', isActive: true },
  { id: 'wt-box-palet', name: 'BOX / PALET', category: 'manual', isActive: true },
  { id: 'wt-slip-manual', name: 'SLIP', category: 'manual', isActive: true },
  { id: 'wt-putaway', name: 'Wstawianie palet', category: 'manual', isActive: true },
  { id: 'wt-wata', name: 'Wata', category: 'manual', isActive: true },
  { id: 'wt-unload', name: 'Rozładunek auta', category: 'pre_shift', isActive: true },
  { id: 'wt-container', name: 'Kontener', category: 'pre_shift', isActive: true },
  { id: 'wt-break', name: 'Przerwa', category: 'gap_fill', isActive: true },
  { id: 'wt-waiting', name: 'Oczekiwanie pracy', category: 'gap_fill', isActive: true },
  { id: 'wt-action', name: 'Akcja magazynowa', category: 'system', isActive: true }
];

export const seedWorkDays: Omit<WorkDay, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'wd-u-worker-1-2026-03-13',
    workerId: 'u-worker-1',
    workerName: 'Paweł Iwanow',
    date: '2026-03-13',
    actualStart: '2026-03-13T06:00:00.000Z',
    plannedEnd: '2026-03-13T14:00:00.000Z',
    status: 'active',
    totalPresenceMinutes: 0,
    totalWorkedMinutes: 0,
    totalGapMinutes: 0
  }
];

export const seedWorkLogEntries: Omit<WorkLogEntry, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'wle-1',
    workDayId: 'wd-u-worker-1-2026-03-13',
    workerId: 'u-worker-1',
    workerName: 'Paweł Iwanow',
    source: 'manual',
    workTypeId: 'wt-preparacja',
    workTypeName: 'Preparacja',
    startTime: '2026-03-13T06:00:00.000Z',
    endTime: '2026-03-13T07:00:00.000Z',
    durationMinutes: 60,
    comment: 'Przygotowanie strefy',
    isAutoClosed: false
  },
  {
    id: 'wle-2',
    workDayId: 'wd-u-worker-1-2026-03-13',
    workerId: 'u-worker-1',
    workerName: 'Paweł Iwanow',
    source: 'action',
    workTypeId: 'wt-action',
    workTypeName: 'Akcja magazynowa',
    relatedActionId: 'task-1',
    relatedActionType: 'Slip-sheet / łapami na europaletę',
    relatedCarrierId: 'c-1',
    relatedCarrierName: 'Baltic Freight',
    relatedVehicleCode: 'PL-WA-1201',
    startTime: '2026-03-13T08:45:00.000Z',
    endTime: '2026-03-13T10:15:00.000Z',
    durationMinutes: 90,
    palletsCompleted: 30,
    comment: 'Auto z sesji akcji',
    isAutoClosed: false
  }
];
