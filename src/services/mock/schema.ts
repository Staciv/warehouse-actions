import type { ActionTask, ActionType, AuditLog, Carrier, ProblemReport, User, WorkDay, WorkLogEntry, WorkSession, WorkTypeDictionary } from '../../types/domain';

export interface MockDb {
  users: User[];
  carriers: Carrier[];
  actionTypes: ActionType[];
  actionTasks: ActionTask[];
  workSessions: WorkSession[];
  workDays: WorkDay[];
  workLogEntries: WorkLogEntry[];
  workTypes: WorkTypeDictionary[];
  problemReports: ProblemReport[];
  auditLogs: AuditLog[];
}
