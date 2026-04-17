import type { ProblemIssueType } from '../types/domain';

export const validateProblemReportInput = (
  issueType: ProblemIssueType,
  rampNumber: string,
  shortDescription: string,
  vehicleCode: string
): string | null => {
  if (!issueType) return 'Wybierz typ problemu.';
  if (!vehicleCode.trim()) return 'Podaj numer maszyny / pojazdu.';
  if (!rampNumber.trim()) return 'Podaj numer rampy.';
  if (rampNumber.trim().length > 24) return 'Numer rampy jest za długi.';
  if (!shortDescription.trim()) return 'Dodaj krótki opis problemu.';
  if (shortDescription.trim().length < 5) return 'Opis problemu jest zbyt krótki.';
  if (shortDescription.trim().length > 500) return 'Opis problemu jest za długi.';
  return null;
};
