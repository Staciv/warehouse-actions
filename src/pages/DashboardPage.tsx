import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, Loader } from '../components/ui/States';
import { useAuth } from '../features/auth/AuthContext';
import { isAdminRole } from '../features/auth/guards';
import { AttentionList } from '../features/actions/AttentionList';
import { SummaryCards } from '../features/actions/SummaryCards';
import { useTasks } from '../hooks/useTasks';
import { formatDate } from '../shared/utils/date';
import styles from './page.module.css';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { tasks, loading, error } = useTasks();
  const [showAllDates, setShowAllDates] = useState(false);

  if (!user) return null;
  if (loading) return <Loader />;
  if (error) return <div style={{ color: '#c63d3d' }}>{error}</div>;

  if (!isAdminRole(user.role)) {
    const available = tasks.filter((task) => task.totalPallets !== null && task.remainingPallets > 0);
    return (
      <div className={styles.page}>
        <div className={styles.title}>Панель работника</div>
        <SummaryCards
          items={[
            { label: 'Доступные акции', value: available.length },
            {
              label: 'Выполняются',
              value: tasks.filter((task) => task.status === 'executing').length,
              to: '/actions?status=executing&onlyActive=active'
            },
            { label: 'Завершённые сегодня', value: tasks.filter((task) => task.status === 'completed').length }
          ]}
        />
        <Card>
          <h3 style={{ marginBottom: 8 }}>Активные акции</h3>
          {available.length === 0 ? (
            <EmptyState text="Сейчас нет активных задач" />
          ) : (
            <div className="stack">
              {available.slice(0, 8).map((task) => (
                <div key={task.id}>
                  <Link to={`/actions/${task.id}`}>{task.vehicleCode}</Link>
                  <div className="kpi">
                    {task.actionTypeName} · {task.carrierName} · осталось {task.remainingPallets}
                  </div>
                </div>
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
    { label: 'Запланировано', value: tasksInRange.filter((task) => task.status === 'planned').length },
    { label: 'Выполняется', value: tasksInRange.filter((task) => task.status === 'executing').length },
    { label: 'Отменено', value: tasksInRange.filter((task) => task.status === 'cancelled').length },
    {
      label: 'Черновики',
      value: tasksInRange.filter((task) => task.status === 'draft' || task.status === 'inactive').length
    },
    {
      label: 'Завершено сегодня',
      value: tasks.filter((task) => task.status === 'completed' && task.updatedAt.slice(0, 10) === todayIso).length
    },
    { label: 'Незавершённые машины', value: unfinishedMachinesCount }
  ];
  const executingNow = tasksInRange.filter((task) => task.status === 'executing' && task.participantWorkerNames.length > 0);
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
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.subtitle}>Сводка по складу и индикаторы внимания</div>
      </div>

      <SummaryCards items={items} />
      <div className={styles.split}>
        <AttentionList tasks={tasks} />
        <Card>
          <h3 style={{ marginBottom: 10 }}>Дата и количество незавершённых акций</h3>
          {unfinishedByDate.length === 0 ? (
            <EmptyState text="Нет незавершённых акций за выбранный период" />
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
                    {showAllDates ? 'Свернуть' : 'Показать больше'}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 style={{ marginBottom: 10 }}>Кто сейчас выполняет какую акцию</h3>
        {executingNow.length === 0 ? (
          <EmptyState text="Сейчас нет активных исполнителей" />
        ) : (
          <div className="stack">
            {executingNow.map((task) => (
              <div key={task.id}>
                <Link to={`/actions/${task.id}`}>{task.vehicleCode}</Link>
                <div className="kpi">
                  {task.actionTypeName} · {task.participantWorkerNames.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
