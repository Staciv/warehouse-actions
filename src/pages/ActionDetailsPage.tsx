import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, Loader } from '../components/ui/States';
import { formatDateTime, formatMinutes } from '../shared/utils/date';
import { getRepository } from '../services/repositories';
import type { UpdateActionTaskPayload } from '../services/repositories/types';
import type { ActionTask, AuditLog, WorkSession } from '../types/domain';
import styles from './page.module.css';
import { useAuth } from '../features/auth/AuthContext';
import { isAdminRole } from '../features/auth/guards';
import { ActionTaskForm } from '../features/actions/ActionTaskForm';
import { useReferenceData } from '../hooks/useReferenceData';
import { PriorityBadge, StatusBadge } from '../features/actions/badges';
import { WorkSessionForm } from '../features/work/WorkSessionForm';
import { Table } from '../components/ui/Table';

export const ActionDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { carriers, actionTypes } = useReferenceData();

  const [task, setTask] = useState<ActionTask | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);

  const canManage = user ? isAdminRole(user.role) : false;
  const isWorkerParticipant = task && user ? task.participantWorkerIds.includes(user.id) : false;
  const canJoinOperation = user?.role === 'worker';

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const repository = getRepository();
      const [taskRow, sessionsRows, auditRows] = await Promise.all([
        repository.getActionTaskById(id),
        repository.getWorkSessionsByTask(id),
        canManage ? repository.getAuditLogs('actionTask', id) : Promise.resolve([])
      ]);
      setTask(taskRow);
      setSessions(sessionsRows);
      setAuditLogs(auditRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, canManage]);

  const totalDuration = useMemo(
    () => sessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    [sessions]
  );

  if (!user) return null;
  if (loading) return <Loader />;
  if (error) return <div style={{ color: '#c63d3d' }}>{error}</div>;
  if (!task) return <EmptyState text="Акция не найдена" />;

  const saveEdit = async (payload: UpdateActionTaskPayload) => {
    if (!canManage) return;
    await getRepository().updateActionTask(task.id, payload, user);
    setEditMode(false);
    await load();
  };

  const saveWorkSession = async (payload: { pallets: number; startedAt: string; endedAt: string; comment?: string }) => {
    await getRepository().createWorkSession(
      {
        actionTaskId: task.id,
        workerId: user.id,
        palletsCompletedInSession: payload.pallets,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        comment: payload.comment
      },
      user
    );
    await load();
  };

  const startExecution = async () => {
    await getRepository().startActionExecution(task.id, user.id, user);
    await load();
  };

  const stopExecution = async () => {
    const confirmed = window.confirm('Отменить выполнение этой акции для вас?');
    if (!confirmed) return;
    await getRepository().stopActionExecution(task.id, user.id, user);
    await load();
  };

  const archiveTask = async () => {
    if (!canManage) return;
    const confirmed = window.confirm('Архивировать эту акцию?');
    if (!confirmed) return;
    await getRepository().updateActionTask(task.id, { archived: true, status: 'archived' }, user);
    navigate('/actions');
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Акция {task.vehicleCode}</h1>
          <div className={styles.subtitle}>{task.actionTypeName}</div>
        </div>
        {canManage ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setEditMode((value) => !value)}>
              {editMode ? 'Скрыть редактирование' : 'Редактировать'}
            </Button>
            <Button variant="danger" onClick={archiveTask}>
              Архивировать
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <div className="formGrid">
          <div>
            <div className="kpi">Перевозчик</div>
            <div>{task.carrierName}</div>
          </div>
          <div>
            <div className="kpi">Дата приезда</div>
            <div>{formatDateTime(task.arrivalDate)}</div>
          </div>
          <div>
            <div className="kpi">Приоритет</div>
            <PriorityBadge priority={task.priority} />
          </div>
          <div>
            <div className="kpi">Статус</div>
            <StatusBadge status={task.status} />
          </div>
          <div>
            <div className="kpi">Объём</div>
            <div>
              {task.completedPallets}/{task.totalPallets ?? '—'}, осталось {task.remainingPallets}
            </div>
          </div>
          <div>
            <div className="kpi">Всего времени</div>
            <div>{formatMinutes(totalDuration)}</div>
          </div>
          <div>
            <div className="kpi">Участники</div>
            <div>{task.participantWorkerNames.length > 0 ? task.participantWorkerNames.join(', ') : 'Пока нет'}</div>
          </div>
        </div>
      </Card>

      {editMode && canManage ? (
        <ActionTaskForm
          mode="update"
          carriers={carriers}
          actionTypes={actionTypes}
          initial={task}
          onSubmit={saveEdit}
          submitLabel="Сохранить изменения"
        />
      ) : null}

      {!isWorkerParticipant && task.remainingPallets > 0 && canJoinOperation ? (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi">Следующий шаг: перевести операцию в статус «Выполняется»</div>
            <Button onClick={startExecution}>Начать выполнение</Button>
          </div>
        </Card>
      ) : null}

      {isWorkerParticipant && task.remainingPallets > 0 && canJoinOperation ? (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi">Вы участвуете в выполнении этой акции</div>
            <Button variant="secondary" onClick={stopExecution}>
              Отменить выполнение
            </Button>
          </div>
        </Card>
      ) : null}

      {task.remainingPallets > 0 && isWorkerParticipant && task.status === 'executing' ? (
        <WorkSessionForm task={task} onSubmit={saveWorkSession} />
      ) : null}

      <Card>
        <h3 style={{ marginBottom: 8 }}>История выполнения</h3>
        {sessions.length === 0 ? (
          <EmptyState text="Пока нет сессий выполнения" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Работник</th>
                <th>Время</th>
                <th>Палеты</th>
                <th>Длительность</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td data-label="Работник">{session.workerName}</td>
                  <td data-label="Время">
                    {formatDateTime(session.startedAt)} - {formatDateTime(session.endedAt)}
                  </td>
                  <td data-label="Палеты">{session.palletsCompletedInSession}</td>
                  <td data-label="Длительность">{formatMinutes(session.durationMinutes)}</td>
                  <td data-label="Комментарий">{session.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {canManage ? (
        <Card>
          <h3 style={{ marginBottom: 8 }}>Audit log</h3>
          {auditLogs.length === 0 ? (
            <EmptyState text="История изменений пуста" />
          ) : (
            <div className="stack">
              {auditLogs.slice(0, 12).map((log) => (
                <div key={log.id}>
                  <div>{log.action}</div>
                  <div className="kpi">{log.performedByUserName} · {formatDateTime(log.performedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
};
