import { useAuth } from '../features/auth/AuthContext';
import { hasAccess } from '../features/auth/guards';
import type { UserRole } from '../types/domain';

export const useAuthorization = (allowed: UserRole[]) => {
  const { user } = useAuth();
  if (!user) return false;
  return hasAccess(user.role, allowed);
};
