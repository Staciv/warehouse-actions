import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { EmptyState, Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { getRepository } from '../services/repositories';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDateTime, formatMinutes } from '../shared/utils/date';
import type { WorkSession } from '../types/domain';
import styles from './page.module.css';

export const WorkerCompletedPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const loader = useAsync(async () => {
    if (!user) return [] as Array<{ session: WorkSession; vehicleCode: string; actionTypeName: string; carrierName: string }>;

    const repository = getRepository();
    const [sessions, tasks] = await Promise.all([
      repository.getWorkSessions({ fromDate, toDate }),
      repository.getActionTasks({ status: 'all' })
    ]);

    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    return sessions
      .filter((session) => session.workerId === user.id)
      .map((session) => {
        const task = taskMap.get(session.actionTaskId);
        return {
          session,
          vehicleCode: task?.vehicleCode ?? '—',
          actionTypeName: task?.actionTypeName ?? '—',
          carrierName: task?.carrierName ?? '—'
        };
      });
  }, false);

  useEffect(() => {
    void loader.execute();
  }, [fromDate, toDate, user?.id]);

  const totalPallets = useMemo(
    () => (loader.data ?? []).reduce((sum, row) => sum + row.session.palletsCompletedInSession, 0),
    [loader.data]
  );

  const totalMinutes = useMemo(
    () => (loader.data ?? []).reduce((sum, row) => sum + row.session.durationMinutes, 0),
    [loader.data]
  );

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{t('page.workerCompleted.title')}</h1>
        <div className={styles.subtitle}>{t('page.workerCompleted.subtitle')}</div>
      </div>

      <Card>
        <div className="formGrid">
          <Field label="Data od">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="Data do">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="formGrid">
          <div>
            <div className="kpi">Wykonane sesje</div>
            <strong>{loader.data?.length ?? 0}</strong>
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
        {!loader.loading && (loader.data?.length ?? 0) === 0 ? <EmptyState text="Brak wykonań w wybranym okresie" /> : null}
        {!loader.loading && (loader.data?.length ?? 0) > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Rampa</th>
                <th>Pojazd</th>
                <th>Typ akcji</th>
                <th>Przewoźnik</th>
                <th>Palety</th>
                <th>Czas trwania</th>
              </tr>
            </thead>
            <tbody>
              {(loader.data ?? []).map((row) => (
                <tr key={row.session.id}>
                  <td data-label="Data">{formatDateTime(row.session.startedAt)}</td>
                  <td data-label="Rampa">{row.session.rampNumber}</td>
                  <td data-label="Pojazd">{row.vehicleCode}</td>
                  <td data-label="Typ akcji">{row.actionTypeName}</td>
                  <td data-label="Przewoźnik">{row.carrierName}</td>
                  <td data-label="Palety">{row.session.palletsCompletedInSession}</td>
                  <td data-label="Czas trwania">{formatMinutes(row.session.durationMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>
    </div>
  );
};
