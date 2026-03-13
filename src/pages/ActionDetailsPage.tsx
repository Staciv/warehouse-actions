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
import { ActionProgressBar } from '../features/live-ops/ActionProgressBar';

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
  const [workerEnteredAt, setWorkerEnteredAt] = useState<string | null>(null);

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
        canManage && user ? repository.getAuditLogs('actionTask', id, user) : Promise.resolve([])
      ]);
      setTask(taskRow);
      setSessions(sessionsRows);
      setAuditLogs(auditRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania');
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
  useEffect(() => {
    if (!user || user.role !== 'worker' || !task) {
      setWorkerEnteredAt(null);
      return;
    }

    const key = `wms_worker_action_entered_at_${user.id}_${task.id}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setWorkerEnteredAt(stored);
      return;
    }

    const nowIso = new Date().toISOString();
    sessionStorage.setItem(key, nowIso);
    setWorkerEnteredAt(nowIso);
  }, [task, user]);

  if (!user) return null;
  if (loading) return <Loader />;
  if (error) return <div style={{ color: '#c63d3d' }}>{error}</div>;
  if (!task) return <EmptyState text="Nie znaleziono akcji" />;

  const saveEdit = async (payload: UpdateActionTaskPayload) => {
    if (!canManage) return;
    await getRepository().updateActionTask(task.id, payload, user);
    setEditMode(false);
    await load();
  };

  const saveWorkSession = async (payload: {
    pallets: number;
    rampNumber: string;
    startedAt: string;
    endedAt: string;
    comment?: string;
  }) => {
    await getRepository().createWorkSession(
      {
        actionTaskId: task.id,
        workerId: user.id,
        rampNumber: payload.rampNumber,
        palletsCompletedInSession: payload.pallets,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        comment: payload.comment
      },
      user
    );
    const key = `wms_worker_action_entered_at_${user.id}_${task.id}`;
    const nextStart = new Date().toISOString();
    sessionStorage.setItem(key, nextStart);
    setWorkerEnteredAt(nextStart);
    await load();
  };

  const startExecution = async () => {
    await getRepository().startActionExecution(task.id, user.id, user);
    await load();
  };

  const stopExecution = async () => {
    const confirmed = window.confirm('Anulować wykonywanie tej akcji dla Ciebie?');
    if (!confirmed) return;
    await getRepository().stopActionExecution(task.id, user.id, user);
    const key = `wms_worker_action_entered_at_${user.id}_${task.id}`;
    sessionStorage.removeItem(key);
    setWorkerEnteredAt(null);
    await load();
  };

  const archiveTask = async () => {
    if (!canManage) return;
    const confirmed = window.confirm('Zarchiwizować tę akcję?');
    if (!confirmed) return;
    await getRepository().updateActionTask(task.id, { archived: true, status: 'archived' }, user);
    navigate('/actions');
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Akcja {task.vehicleCode}</h1>
          <div className={styles.subtitle}>{task.actionTypeName}</div>
        </div>
        {canManage ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setEditMode((value) => !value)}>
              {editMode ? 'Ukryj edycję' : 'Edytuj'}
            </Button>
            <Button variant="danger" onClick={archiveTask}>
              Archiwizuj
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <div className="formGrid">
          <div>
            <div className="kpi">Przewoźnik</div>
            <div>{task.carrierName}</div>
          </div>
          <div>
            <div className="kpi">Data przyjazdu</div>
            <div>{formatDateTime(task.arrivalDate)}</div>
          </div>
          <div>
            <div className="kpi">Priorytet</div>
            <PriorityBadge priority={task.priority} />
          </div>
          <div>
            <div className="kpi">Status</div>
            <StatusBadge status={task.status} />
          </div>
          <div>
            <div className="kpi">Wolumen</div>
            <div>
              {task.completedPallets}/{task.totalPallets ?? '—'}, pozostało {task.remainingPallets}
            </div>
          </div>
          <div>
            <div className="kpi">Łączny czas</div>
            <div>{formatMinutes(totalDuration)}</div>
          </div>
          <div>
            <div className="kpi">Uczestnicy</div>
            <div>{task.participantWorkerNames.length > 0 ? task.participantWorkerNames.join(', ') : 'Brak'}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }} className="stack">
          <ActionProgressBar totalPallets={task.totalPallets ?? 0} completedPallets={task.completedPallets} />
        </div>
      </Card>

      {editMode && canManage ? (
        <ActionTaskForm
          mode="update"
          carriers={carriers}
          actionTypes={actionTypes}
          initial={task}
          onSubmit={saveEdit}
          submitLabel="Zapisz zmiany"
        />
      ) : null}

      {!isWorkerParticipant && task.remainingPallets > 0 && canJoinOperation ? (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi">Następny krok: ustaw operację na status „W realizacji”</div>
            <Button onClick={startExecution}>Rozpocznij wykonanie</Button>
          </div>
        </Card>
      ) : null}

      {isWorkerParticipant && task.remainingPallets > 0 && canJoinOperation ? (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kpi">Uczestniczysz w realizacji tej akcji</div>
            <Button variant="secondary" onClick={stopExecution}>
              Anuluj wykonanie
            </Button>
          </div>
        </Card>
      ) : null}

      {task.remainingPallets > 0 && isWorkerParticipant && task.status === 'executing' ? (
        <WorkSessionForm task={task} fixedStartedAt={workerEnteredAt ?? new Date().toISOString()} onSubmit={saveWorkSession} />
      ) : null}

      <Card>
        <h3 style={{ marginBottom: 8 }}>Historia wykonania</h3>
        {sessions.length === 0 ? (
          <EmptyState text="Brak sesji wykonania" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Pracownik</th>
                <th>Rampa</th>
                <th>Czas</th>
                <th>Palety</th>
                <th>Czas trwania</th>
                <th>Komentarz</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td data-label="Pracownik">{session.workerName}</td>
                  <td data-label="Rampa">{session.rampNumber}</td>
                  <td data-label="Czas">
                    {formatDateTime(session.startedAt)} - {formatDateTime(session.endedAt)}
                  </td>
                  <td data-label="Palety">{session.palletsCompletedInSession}</td>
                  <td data-label="Czas trwania">{formatMinutes(session.durationMinutes)}</td>
                  <td data-label="Komentarz">{session.comment || '—'}</td>
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
            <EmptyState text="Historia zmian jest pusta" />
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
