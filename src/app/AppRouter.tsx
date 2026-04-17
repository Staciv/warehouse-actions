import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../features/auth/AuthContext';
import { RoleRoute } from './routes/RoleRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ActionsPage } from '../pages/ActionsPage';
import { ActionDetailsPage } from '../pages/ActionDetailsPage';
import { CompletedActionsPage } from '../pages/CompletedActionsPage';
import { VehiclesPage } from '../pages/VehiclesPage';
import { WorkersPage } from '../pages/WorkersPage';
import { CarriersPage } from '../pages/CarriersPage';
import { ActionTypesPage } from '../pages/ActionTypesPage';
import { ReportsPage } from '../pages/ReportsPage';
import { WorkerCompletedPage } from '../pages/WorkerCompletedPage';
import { WorkerReportProblemPage } from '../pages/WorkerReportProblemPage';
import { ProblemsPage } from '../pages/ProblemsPage';
import { WorkerWorkCardPage } from '../pages/WorkerWorkCardPage';
import { AdminWorkCardsPage } from '../pages/AdminWorkCardsPage';

export const AppRouter = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />

      <Route element={<RoleRoute allowedRoles={['worker', 'admin', 'superadmin']} />}>
        <Route element={<AppShell />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route element={<RoleRoute allowedRoles={['worker']} />}>
            <Route path={ROUTES.workerWorkCard} element={<WorkerWorkCardPage />} />
            <Route path={ROUTES.workerCompleted} element={<WorkerCompletedPage />} />
            <Route path={ROUTES.workerReportProblem} element={<WorkerReportProblemPage />} />
          </Route>
          <Route path={ROUTES.actions} element={<ActionsPage />} />
          <Route path={ROUTES.actionDetails} element={<ActionDetailsPage />} />

          <Route element={<RoleRoute allowedRoles={['admin', 'superadmin']} />}>
            <Route path={ROUTES.completed} element={<CompletedActionsPage />} />
            <Route path={ROUTES.vehicles} element={<VehiclesPage />} />
            <Route path={ROUTES.workers} element={<WorkersPage />} />
            <Route path={ROUTES.problems} element={<ProblemsPage />} />
            <Route path={ROUTES.carriers} element={<CarriersPage />} />
            <Route path={ROUTES.actionTypes} element={<ActionTypesPage />} />
            <Route path={ROUTES.reports} element={<ReportsPage />} />
            <Route path={ROUTES.adminWorkCards} element={<AdminWorkCardsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={user ? ROUTES.dashboard : ROUTES.login} replace />} />
    </Routes>
  );
};
