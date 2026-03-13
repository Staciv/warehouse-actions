import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/States';
import { SummaryCards } from '../features/actions/SummaryCards';
import { useAsync } from '../hooks/useAsync';
import { getRepository } from '../services/repositories';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatMinutes } from '../shared/utils/date';
import styles from './page.module.css';

export const ReportsPage = () => {
  const { t } = useI18n();
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const loader = useAsync(async () => {
    const repository = getRepository();
    const [sessions, tasks] = await Promise.all([
      repository.getWorkSessions({ fromDate, toDate }),
      repository.getActionTasks({ status: 'all', fromDate, toDate })
    ]);

    const workers = new Set(sessions.map((item) => item.workerId)).size;
    const vehicles = new Set(tasks.map((item) => item.vehicleCode)).size;
    const totalPallets = sessions.reduce((sum, item) => sum + item.palletsCompletedInSession, 0);
    const totalMinutes = sessions.reduce((sum, item) => sum + item.durationMinutes, 0);

    return { workers, vehicles, totalPallets, totalMinutes, sessions, tasks };
  });

  useEffect(() => {
    void loader.execute();
  }, [fromDate, toDate]);

  const byWorker = useMemo(() => {
    if (!loader.data) return [];
    const map = new Map<string, { pallets: number; minutes: number; name: string }>();
    for (const session of loader.data.sessions) {
      const current = map.get(session.workerId) ?? { pallets: 0, minutes: 0, name: session.workerName };
      current.pallets += session.palletsCompletedInSession;
      current.minutes += session.durationMinutes;
      map.set(session.workerId, current);
    }
    return Array.from(map.values()).sort((a, b) => b.pallets - a.pallets);
  }, [loader.data]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('page.reports.title')}</h1>

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

      {loader.loading ? <Loader /> : null}

      {loader.data ? (
        <>
          <SummaryCards
            items={[
              { label: 'Pracowników w raporcie', value: loader.data.workers },
              { label: 'Pojazdów', value: loader.data.vehicles },
              { label: 'Wykonane palety', value: loader.data.totalPallets },
              { label: 'Akcji', value: loader.data.tasks.length }
            ]}
          />

          <Card>
            <h3 style={{ marginBottom: 8 }}>Czas pracy</h3>
            <div className="kpi">Łącznie: {formatMinutes(loader.data.totalMinutes)}</div>
          </Card>

          <Card>
            <h3 style={{ marginBottom: 8 }}>Według pracowników</h3>
            <div className="stack">
              {byWorker.map((item) => (
                <div key={item.name}>
                  <strong>{item.name}</strong>
                  <div className="kpi">
                    {item.pallets} palet, {formatMinutes(item.minutes)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};
