import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { useAuth } from '../features/auth/AuthContext';
import { isAdminRole } from '../features/auth/guards';
import { AttentionList } from '../features/actions/AttentionList';
import { SummaryCards } from '../features/actions/SummaryCards';
import { useLiveOpsOverview } from '../features/live-ops/useLiveOpsOverview';
import { useTasks } from '../hooks/useTasks';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDate, formatMinutes } from '../shared/utils/date';
import { getRepository } from '../services/repositories';
import type { ActionTask, ProblemReport, ProblemStatus } from '../types/domain';
import { PROBLEM_ISSUE_LABELS, PROBLEM_STATUS_LABELS } from '../constants/problem-reports';
import { ROUTES } from '../constants/routes';
import { isTaskAvailableForWorkers, sortTasksByPriorityAndDate } from '../entities/action-task';
import { PriorityBadge, StatusBadge } from '../features/actions/badges';
import { subscribeDataSync } from '../shared/utils/dataSync';
import styles from './page.module.css';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { tasks, loading, error } = useTasks();
  const isAdmin = user ? isAdminRole(user.role) : false;
  const [showAllDates, setShowAllDates] = useState(false);
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemError, setProblemError] = useState('');
  const live = useLiveOpsOverview(isAdmin ? user : null, { includeWorkers: false });

  const loadProblemReports = async () => {
    if (!user || !isAdmin) return;
    setProblemLoading(true);
    setProblemError('');
    try {
      const rows = await getRepository().getProblemReports(
        undefined,
        user
      );
      setProblemReports(rows);
    } catch (err) {
      setProblemError(err instanceof Error ? err.message : 'Nie udało się pobrać zgłoszeń');
    } finally {
      setProblemLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadProblemReports();
  }, [isAdmin, user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeDataSync(['problems'], () => {
      void loadProblemReports();
    });
  }, [isAdmin, user?.id]);

  const getSlaLabel = (createdAt: string, status: ProblemReport['status']) => {
    if (status === 'resolved' || status === 'rejected') return 'zamknięte';
    const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    if (ageMinutes >= 120) return `SLA: ${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m (krytyczne)`;
    if (ageMinutes >= 60) return `SLA: ${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`;
    return `SLA: ${ageMinutes} min`;
  };

  const openProblems = useMemo(
    () => problemReports.filter((item) => item.status === 'new' || item.status === 'in_progress').length,
    [problemReports]
  );

  const updateProblemStatus = async (id: string, status: ProblemStatus) => {
    if (!user || !isAdmin) return;
    await getRepository().updateProblemReportStatus(id, status, user);
    await loadProblemReports();
  };

  const visibleProblemReports = problemReports.slice(0, 3);

  const getArrivalTimestamp = (task: ActionTask) => {
    const datePart = task.arrivalDate.slice(0, 10);
    return new Date(`${datePart}T${task.arrivalTime || '00:00'}:00`).getTime();
  };

  const getRampWaitingLabel = (task: ActionTask) => {
    const waitingMinutes = Math.max(0, Math.floor((Date.now() - getArrivalTimestamp(task)) / 60000));
    return formatMinutes(waitingMinutes);
  };

  if (!user) return null;

  if (loading) return <Loader />;
  if (error) return <div style={{ color: '#c63d3d' }}>{error}</div>;

  if (!isAdmin) {
    const available = sortTasksByPriorityAndDate(tasks.filter((task) => isTaskAvailableForWorkers(task)));
    return (
      <div className={styles.page}>
        <div className={styles.title}>{t('dashboard.workerPanel')}</div>
        <Card>
          <h3 style={{ marginBottom: 10 }}>{t('dashboard.activeActions')}</h3>
          {available.length === 0 ? (
            <EmptyState text={t('dashboard.noActiveTasks')} />
          ) : (
            <div className={styles.workerTaskList}>
              {available.map((task) => (
                <Link key={task.id} to={`/actions/${task.id}`} className={styles.workerTaskLink}>
                  <Card className={styles.workerTaskCard}>
                    <div className={styles.workerTaskHead}>
                      <strong className="truncateText">{task.actionTypeName}</strong>
                      <div className={styles.workerTaskBadges}>
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                    <div className="kpi">
                      {task.vehicleCode} · {task.carrierName}
                    </div>
                    <div className={styles.workerTaskMeta}>
                      <span>Razem: {task.totalPallets ?? 0}</span>
                      <span>Wykonano: {task.completedPallets}</span>
                      <span>Pozostało: {task.remainingPallets}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const tasksInRange = tasks;
  const unfinishedMachinesCount = new Set(
    tasksInRange
      .filter((task) => task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'archived')
      .map((task) => task.vehicleCode)
  ).size;
  const todayIso = new Date().toISOString().slice(0, 10);
  const items = [
    {
      label: t('dashboard.planned'),
      value: tasksInRange.filter((task) => task.status === 'planned').length,
      to: `${ROUTES.actions}?status=planned`
    },
    {
      label: t('dashboard.executing'),
      value: tasksInRange.filter((task) => task.status === 'executing').length,
      to: `${ROUTES.actions}?status=executing&onlyActive=active`
    },
    {
      label: t('dashboard.cancelled'),
      value: tasksInRange.filter((task) => task.status === 'cancelled').length,
      to: `${ROUTES.actions}?status=cancelled`
    },
    {
      label: t('dashboard.drafts'),
      value: tasksInRange.filter((task) => task.status === 'draft' || task.status === 'inactive').length,
      to: `${ROUTES.actions}?status=all&onlyActive=inactive`
    },
    {
      label: t('common.todayCompleted'),
      value: tasks.filter((task) => task.status === 'completed' && task.updatedAt.slice(0, 10) === todayIso).length,
      to: ROUTES.completed
    },
    { label: t('dashboard.unfinishedVehicles'), value: unfinishedMachinesCount, to: ROUTES.vehicles },
    { label: 'Otwarte zgłoszenia problemów', value: openProblems, to: `${ROUTES.dashboard}#problem-reports` }
  ];
  const unfinishedByDateMap = new Map<string, number>();
  tasksInRange
    .filter((task) => task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'archived')
    .forEach((task) => {
      const dayKey = task.arrivalDate.slice(0, 10);
      unfinishedByDateMap.set(dayKey, (unfinishedByDateMap.get(dayKey) ?? 0) + 1);
    });
  const unfinishedByDate = Array.from(unfinishedByDateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const visibleUnfinishedByDate = showAllDates ? unfinishedByDate : unfinishedByDate.slice(0, 6);
  const pendingTasks = tasksInRange
    .filter(
      (task) =>
        task.totalPallets !== null &&
        task.totalPallets > 0 &&
        task.status !== 'completed' &&
        task.status !== 'cancelled' &&
        task.status !== 'archived'
    )
    .sort((a, b) => getArrivalTimestamp(a) - getArrivalTimestamp(b));

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{t('dashboard.title')}</h1>
        <div className={styles.subtitle}>{t('dashboard.subtitle')}</div>
      </div>

      <SummaryCards items={items} compact />
      <div className={styles.split}>
        <AttentionList tasks={tasks} />
        <Card>
          <h3 style={{ marginBottom: 10 }}>{t('dashboard.unfinishedByDate')}</h3>
          {unfinishedByDate.length === 0 ? (
            <EmptyState text={t('dashboard.noUnfinished')} />
          ) : (
            <div className="stack">
              {visibleUnfinishedByDate.map((row) => (
                <div key={row.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{formatDate(`${row.date}T00:00:00.000Z`)}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
              {unfinishedByDate.length > 6 ? (
                <div>
                  <Button variant="secondary" onClick={() => setShowAllDates((value) => !value)}>
                    {showAllDates ? t('common.collapse') : t('common.showMore')}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      {live.loading ? <Loader text={t('live.refresh')} /> : null}
      {live.error ? <div style={{ color: '#c63d3d' }}>{live.error}</div> : null}
      {!live.loading && !live.error ? (
        <Card>
          <h3 style={{ marginBottom: 10 }}>Akcje do wykonania</h3>
          {pendingTasks.length === 0 ? (
            <EmptyState text="Brak akcji do wykonania" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Typ akcji</th>
                  <th>Numer pojazdu</th>
                  <th>Przewoźnik</th>
                  <th>Data przyjazdu</th>
                  <th>Stoi na rampie</th>
                  <th>Razem</th>
                  <th>Wykonano</th>
                  <th>Pozostało</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingTasks.map((task) => (
                  <tr key={task.id}>
                    <td data-label="Typ akcji">
                      <Link to={`/actions/${task.id}`}>{task.actionTypeName}</Link>
                    </td>
                    <td data-label="Numer pojazdu">{task.vehicleCode}</td>
                    <td data-label="Przewoźnik">{task.carrierName}</td>
                    <td data-label="Data przyjazdu">{formatDate(task.arrivalDate)} {task.arrivalTime || '—'}</td>
                    <td data-label="Stoi na rampie">{getRampWaitingLabel(task)}</td>
                    <td data-label="Razem">{task.totalPallets}</td>
                    <td data-label="Wykonano">{task.completedPallets}</td>
                    <td data-label="Pozostało">{task.remainingPallets}</td>
                    <td data-label="Status">
                      <StatusBadge status={task.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      <Card className={styles.problemSection}>
        <h3 style={{ marginBottom: 10 }}>Problemy z ramp / akcji</h3>
        <div id="problem-reports" />

        {problemLoading ? <Loader /> : null}
        {problemError ? <div style={{ color: '#c63d3d' }}>{problemError}</div> : null}
        {!problemLoading && problemReports.length === 0 ? <EmptyState text="Brak zgłoszeń dla bieżących filtrów" /> : null}
        {!problemLoading && problemReports.length > 0 ? (
          <div className={`stack ${styles.problemList}`}>
            <Table>
              <thead>
                <tr>
                  <th>Typ problemu</th>
                  <th>Maszyna</th>
                  <th>Rampa</th>
                  <th>Zgłosił</th>
                  <th>Opis</th>
                  <th>SLA</th>
                  <th>Status</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {visibleProblemReports.map((report) => (
                  <tr key={report.id}>
                    <td data-label="Typ problemu">{PROBLEM_ISSUE_LABELS[report.issueType]}</td>
                    <td data-label="Maszyna">{report.vehicleCode}</td>
                    <td data-label="Rampa">{report.rampNumber}</td>
                    <td data-label="Zgłosił">{report.createdByUserName}</td>
                    <td data-label="Opis">{report.shortDescription}</td>
                    <td data-label="SLA">{getSlaLabel(report.createdAt, report.status)}</td>
                    <td data-label="Status">{PROBLEM_STATUS_LABELS[report.status]}</td>
                    <td data-label="Akcje">
                      {report.status === 'new' || report.status === 'in_progress' ? (
                        <div className={styles.problemActionsInline}>
                          {report.status === 'new' ? (
                            <Button variant="secondary" onClick={() => void updateProblemStatus(report.id, 'in_progress')}>
                              Weź do pracy
                            </Button>
                          ) : null}
                          <Button variant="secondary" onClick={() => void updateProblemStatus(report.id, 'resolved')}>
                            Rozwiąż
                          </Button>
                          <Button variant="danger" onClick={() => void updateProblemStatus(report.id, 'rejected')}>
                            Odrzuć
                          </Button>
                        </div>
                      ) : (
                        <span className="kpi">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {problemReports.length > 3 ? (
              <div>
                <Button variant="secondary" onClick={() => navigate(ROUTES.problems)}>
                  {t('common.showMore')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
};
