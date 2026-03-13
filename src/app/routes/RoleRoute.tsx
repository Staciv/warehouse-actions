import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../features/auth/AuthContext';
import { hasAccess } from '../../features/auth/guards';
import type { UserRole } from '../../types/domain';

export const RoleRoute = ({ allowedRoles }: { allowedRoles: UserRole[] }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;
  if (!hasAccess(user.role, allowedRoles)) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
};
