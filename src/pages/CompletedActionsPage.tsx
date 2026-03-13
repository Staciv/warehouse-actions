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
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDateTime, formatMinutes } from '../shared/utils/date';
import type { WorkSession } from '../types/domain';
import styles from './page.module.css';

export const CompletedActionsPage = () => {
  const { t } = useI18n();
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
      <h1 className={styles.title}>{t('page.completed.title')}</h1>
      <Card>
        <div className="formGrid">
          <Field label="Data od">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="Data do">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label="Pracownik">
            <Select value={workerName} onChange={(e) => setWorkerName(e.target.value)}>
              <option value="all">Wszyscy</option>
              {workers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Przewoźnik">
            <Select value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
              <option value="all">Wszyscy</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Typ akcji">
            <Select value={actionTypeId} onChange={(e) => setActionTypeId(e.target.value)}>
              <option value="all">Wszystkie</option>
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
            <div className="kpi">Łącznie sesji</div>
            <strong>{filtered.length}</strong>
          </div>
          <div>
            <div className="kpi">Wykonane palety</div>
            <strong>{totalPallets}</strong>
          </div>
          <div>
            <div className="kpi">Czas pracy</div>
            <strong>{formatMinutes(totalMinutes)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        {loader.loading ? <Loader /> : null}
        {!loader.loading && workerSummary.length === 0 ? <EmptyState text="Brak danych pracowników dla wybranego okresu" /> : null}
        {!loader.loading && workerSummary.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Pracownik</th>
                <th>Typy akcji</th>
                <th>Sesje</th>
                <th>Palety</th>
                <th>Godziny</th>
              </tr>
            </thead>
            <tbody>
              {workerSummary.map((item) => (
                <tr key={item.rowKey}>
                  <td data-label="Pracownik">{item.workerName}</td>
                  <td data-label="Typy akcji">{item.actionTypesList}</td>
                  <td data-label="Sesje">{item.sessionsCount}</td>
                  <td data-label="Palety">{item.totalPallets}</td>
                  <td data-label="Godziny">{formatMinutes(item.totalMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>

      <Card>
        {loader.loading ? <Loader /> : null}
        {!loader.loading && filtered.length === 0 ? <EmptyState text="Brak danych dla wybranego okresu" /> : null}
        {!loader.loading && filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Pracownik</th>
                <th>Rampa</th>
                <th>Pojazd</th>
                <th>Typ akcji</th>
                <th>Przewoźnik</th>
                <th>Palety</th>
                <th>Czas trwania</th>
                <th>Czas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ session, task }) => (
                <tr key={session.id}>
                  <td data-label="Pracownik">{session.workerName}</td>
                  <td data-label="Rampa">{session.rampNumber}</td>
                  <td data-label="Pojazd">{task.vehicleCode}</td>
                  <td data-label="Typ akcji">{task.actionTypeName}</td>
                  <td data-label="Przewoźnik">{task.carrierName}</td>
                  <td data-label="Palety">{session.palletsCompletedInSession}</td>
                  <td data-label="Czas trwania">{formatMinutes(session.durationMinutes)}</td>
                  <td data-label="Czas">{formatDateTime(session.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>
    </div>
  );
};
