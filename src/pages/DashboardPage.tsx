import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, Loader } from '../components/ui/States';
import { useAuth } from '../features/auth/AuthContext';
import { isAdminRole } from '../features/auth/guards';
import { AttentionList } from '../features/actions/AttentionList';
import { SummaryCards } from '../features/actions/SummaryCards';
import { ActiveActionsList } from '../features/live-ops/ActiveActionsList';
import { ActiveWorkersPanel } from '../features/live-ops/ActiveWorkersPanel';
import panelStyles from '../features/live-ops/LivePanels.module.css';
import { useLiveOpsOverview } from '../features/live-ops/useLiveOpsOverview';
import { useTasks } from '../hooks/useTasks';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDate } from '../shared/utils/date';
import styles from './page.module.css';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { tasks, loading, error } = useTasks();
  const [showAllDates, setShowAllDates] = useState(false);
  const live = useLiveOpsOverview(user);

  if (!user) return null;

  if (loading) return <Loader />;
  if (error) return <div style={{ color: '#c63d3d' }}>{error}</div>;

  if (!isAdminRole(user.role)) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const available = tasks.filter((task) => task.totalPallets !== null && task.remainingPallets > 0);
    const workerActions = live.actions.filter((action) => action.status !== 'completed').slice(0, 6);
    return (
      <div className={styles.page}>
        <div className={styles.title}>{t('dashboard.workerPanel')}</div>
        <SummaryCards
          items={[
            {
              label: t('dashboard.availableActions'),
              value: available.length,
              to: '/actions?status=all&onlyActive=active'
            },
            {
              label: t('dashboard.executing'),
              value: tasks.filter((task) => task.status === 'executing').length,
              to: '/actions?status=executing&onlyActive=active'
            },
            {
              label: t('common.todayCompleted'),
              value: tasks.filter((task) => task.status === 'completed' && task.updatedAt.slice(0, 10) === todayIso).length,
              to: `/actions?status=completed&fromDate=${todayIso}&toDate=${todayIso}`
            }
          ]}
        />
        {available.length === 0 ? <EmptyState text={t('dashboard.noActiveTasks')} /> : <ActiveActionsList actions={workerActions} />}
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
    { label: t('dashboard.planned'), value: tasksInRange.filter((task) => task.status === 'planned').length },
    { label: t('dashboard.executing'), value: tasksInRange.filter((task) => task.status === 'executing').length },
    { label: t('dashboard.cancelled'), value: tasksInRange.filter((task) => task.status === 'cancelled').length },
    {
      label: t('dashboard.drafts'),
      value: tasksInRange.filter((task) => task.status === 'draft' || task.status === 'inactive').length
    },
    {
      label: t('common.todayCompleted'),
      value: tasks.filter((task) => task.status === 'completed' && task.updatedAt.slice(0, 10) === todayIso).length
    },
    { label: t('dashboard.unfinishedVehicles'), value: unfinishedMachinesCount }
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

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{t('dashboard.title')}</h1>
        <div className={styles.subtitle}>{t('dashboard.subtitle')}</div>
      </div>

      <SummaryCards items={items} />
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

      <div className={panelStyles.grid}>
        {live.loading ? <Loader text={t('live.refresh')} /> : null}
        {live.error ? <div style={{ color: '#c63d3d' }}>{live.error}</div> : null}
        {!live.loading && !live.error ? (
          <>
            <ActiveWorkersPanel workers={live.workers} />
            <ActiveActionsList actions={live.actions.filter((action) => action.status === 'in_progress')} />
          </>
        ) : null}
      </div>
    </div>
  );
};
