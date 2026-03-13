import type { UserRole } from '../../types/domain';

export const hasAccess = (role: UserRole, allowed: UserRole[]) => allowed.includes(role);

export const isAdminRole = (role: UserRole) => role === 'admin' || role === 'superadmin';
export const isSuperAdmin = (role: UserRole) => role === 'superadmin';
