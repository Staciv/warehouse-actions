import type { ProblemIssueType, ProblemStatus } from '../types/domain';

export const PROBLEM_ISSUE_LABELS: Record<ProblemIssueType, string> = {
  missing_label: 'Paleta bez etykiety',
  damaged_pallet: 'Uszkodzona paleta / towar',
  missing_documents: 'Brak dokumentów',
  quantity_mismatch: 'Nie zgadza się ilość',
  ramp_busy: 'Rampa zajęta',
  no_equipment: 'Brak sprzętu',
  other: 'Inne'
};

export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  new: 'Nowa',
  in_progress: 'W pracy',
  resolved: 'Rozwiązana',
  rejected: 'Odrzucona'
};
