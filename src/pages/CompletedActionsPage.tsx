import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState, Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { useAsync } from '../hooks/useAsync';
import { useReferenceData } from '../hooks/useReferenceData';
import { getRepository } from '../services/repositories';
import { formatDateTime, formatMinutes } from '../shared/utils/date';
import type { WorkSession } from '../types/domain';
import styles from './page.module.css';

export const CompletedActionsPage = () => {
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [workerName, setWorkerName] = useState('all');
  const [carrierId, setCarrierId] = useState('all');
  const [actionTypeId, setActionTypeId] = useState('all');

  const { carriers, actionTypes } = useReferenceData();

  const loader = useAsync(async () => {
    const repository = getRepository();
    const [sessions, tasks] = await Promise.all([
      repository.getWorkSessions({ fromDate, toDate }),
      repository.getActionTasks({ status: 'all' })
    ]);

    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    return sessions
      .map((session) => ({ session, task: taskMap.get(session.actionTaskId) }))
      .filter((row): row is { session: WorkSession; task: NonNullable<typeof row.task> } => Boolean(row.task));
  });

  const load = async () => {
    await loader.execute();
  };

  useEffect(() => {
    void load();
  }, [fromDate, toDate]);

  const filtered = useMemo(() => {
    const rows = loader.data ?? [];
    return rows.filter((row) => (workerName === 'all' ? true : row.session.workerName === workerName))
      .filter((row) => (carrierId === 'all' ? true : row.task.carrierId === carrierId))
      .filter((row) => (actionTypeId === 'all' ? true : row.task.actionTypeId === actionTypeId));
  }, [actionTypeId, carrierId, loader.data, workerName]);

  const totalMinutes = filtered.reduce((sum, row) => sum + row.session.durationMinutes, 0);
  const totalPallets = filtered.reduce((sum, row) => sum + row.session.palletsCompletedInSession, 0);
  const workers = Array.from(new Set((loader.data ?? []).map((row) => row.session.workerName)));
  const workerSummary = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        workerName: string;
        totalMinutes: number;
        totalPallets: number;
        sessionsCount: number;
        actionTypes: Map<string, { pallets: number; minutes: number; sessionsCount: number }>;
      }
    >();

    for (const row of filtered) {
      const key = row.session.workerId || row.session.workerName;
      const existing = summaryMap.get(key);
      const actionTypeName = row.task.actionTypeName;

      if (!existing) {
        const actionTypes = new Map<string, { pallets: number; minutes: number; sessionsCount: number }>();
        actionTypes.set(actionTypeName, {
          pallets: row.session.palletsCompletedInSession,
          minutes: row.session.durationMinutes,
          sessionsCount: 1
        });

        summaryMap.set(key, {
          workerName: row.session.workerName,
          totalMinutes: row.session.durationMinutes,
          totalPallets: row.session.palletsCompletedInSession,
          sessionsCount: 1,
          actionTypes
        });
        continue;
      }

      existing.totalMinutes += row.session.durationMinutes;
      existing.totalPallets += row.session.palletsCompletedInSession;
      existing.sessionsCount += 1;

      const existingActionType = existing.actionTypes.get(actionTypeName);
      if (!existingActionType) {
        existing.actionTypes.set(actionTypeName, {
          pallets: row.session.palletsCompletedInSession,
          minutes: row.session.durationMinutes,
          sessionsCount: 1
        });
      } else {
        existingActionType.pallets += row.session.palletsCompletedInSession;
        existingActionType.minutes += row.session.durationMinutes;
        existingActionType.sessionsCount += 1;
      }
    }

    return Array.from(summaryMap.values())
      .map((item, index) => ({
        ...item,
        rowKey: `${item.workerName}-${index}`,
        actionTypesList: Array.from(item.actionTypes.entries())
          .map(([name, values]) => `${name} (${values.sessionsCount})`)
          .join(', ')
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filtered]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Сделанные акции</h1>
      <Card>
        <div className="formGrid">
          <Field label="Дата с">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="Дата по">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label="Работник">
            <Select value={workerName} onChange={(e) => setWorkerName(e.target.value)}>
              <option value="all">Все</option>
              {workers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Перевозчик">
            <Select value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
              <option value="all">Все</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тип акции">
            <Select value={actionTypeId} onChange={(e) => setActionTypeId(e.target.value)}>
              <option value="all">Все</option>
              {actionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <div className="formGrid">
          <div>
            <div className="kpi">Всего сессий</div>
            <strong>{filtered.length}</strong>
          </div>
          <div>
            <div className="kpi">Палет выполнено</div>
            <strong>{totalPallets}</strong>
          </div>
          <div>
            <div className="kpi">Время работ</div>
            <strong>{formatMinutes(totalMinutes)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        {loader.loading ? <Loader /> : null}
        {!loader.loading && workerSummary.length === 0 ? <EmptyState text="Нет данных по работникам за выбранный период" /> : null}
        {!loader.loading && workerSummary.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Работник</th>
                <th>Типы акций</th>
                <th>Сессии</th>
                <th>Палеты</th>
                <th>Часы</th>
              </tr>
            </thead>
            <tbody>
              {workerSummary.map((item) => (
                <tr key={item.rowKey}>
                  <td>{item.workerName}</td>
                  <td>{item.actionTypesList}</td>
                  <td>{item.sessionsCount}</td>
                  <td>{item.totalPallets}</td>
                  <td>{formatMinutes(item.totalMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>

      <Card>
        {loader.loading ? <Loader /> : null}
        {!loader.loading && filtered.length === 0 ? <EmptyState text="За выбранный период данных нет" /> : null}
        {!loader.loading && filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Работник</th>
                <th>Машина</th>
                <th>Тип акции</th>
                <th>Перевозчик</th>
                <th>Палеты</th>
                <th>Длительность</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ session, task }) => (
                <tr key={session.id}>
                  <td>{session.workerName}</td>
                  <td>{task.vehicleCode}</td>
                  <td>{task.actionTypeName}</td>
                  <td>{task.carrierName}</td>
                  <td>{session.palletsCompletedInSession}</td>
                  <td>{formatMinutes(session.durationMinutes)}</td>
                  <td>{formatDateTime(session.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>
    </div>
  );
};
