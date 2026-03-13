import type { ActionTask, ActionType, AuditLog, Carrier, User, WorkSession } from '../../types/domain';

export interface MockDb {
  users: User[];
  carriers: Carrier[];
  actionTypes: ActionType[];
  actionTasks: ActionTask[];
  workSessions: WorkSession[];
  auditLogs: AuditLog[];
}
