import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Table } from '../components/ui/Table';
import { EmptyState } from '../components/ui/States';
import { Loader } from '../components/ui/States';
import { SummaryCards } from '../features/actions/SummaryCards';
import { useAsync } from '../hooks/useAsync';
import { getRepository } from '../services/repositories';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDateTime, formatMinutes } from '../shared/utils/date';
import styles from './page.module.css';

export const ReportsPage = () => {
  const { t } = useI18n();
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWorkerId, setSelectedWorkerId] = useState('all');

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

  const efficiency = useMemo(() => {
    if (!loader.data) return { palletsPerHour: 0, palletsPerHourLabel: '0.00' };
    const pallets = loader.data.totalPallets;
    const minutes = loader.data.totalMinutes;
    const perHour = minutes > 0 ? pallets / (minutes / 60) : 0;
    return {
      palletsPerHour: perHour,
      palletsPerHourLabel: perHour.toFixed(2)
    };
  }, [loader.data]);

  const avgByActionType = useMemo(() => {
    if (!loader.data) return [] as Array<{
      actionTypeName: string;
      sessions: number;
      totalPallets: number;
      averageMinutes: number;
      palletsPerHour: number;
    }>;

    const taskMap = new Map(loader.data.tasks.map((task) => [task.id, task]));
    const map = new Map<string, { sessions: number; totalMinutes: number; totalPallets: number }>();

    for (const session of loader.data.sessions) {
      const task = taskMap.get(session.actionTaskId);
      const actionTypeName = task?.actionTypeName ?? '—';
      const current = map.get(actionTypeName) ?? { sessions: 0, totalMinutes: 0, totalPallets: 0 };
      current.sessions += 1;
      current.totalMinutes += session.durationMinutes;
      current.totalPallets += session.palletsCompletedInSession;
      map.set(actionTypeName, current);
    }

    return Array.from(map.entries())
      .map(([actionTypeName, values]) => ({
        actionTypeName,
        sessions: values.sessions,
        totalPallets: values.totalPallets,
        averageMinutes: values.sessions > 0 ? values.totalMinutes / values.sessions : 0,
        palletsPerHour: values.totalMinutes > 0 ? values.totalPallets / (values.totalMinutes / 60) : 0
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [loader.data]);

  const topDelays = useMemo(() => {
    if (!loader.data) return [] as Array<{
      id: string;
      workerName: string;
      vehicleCode: string;
      actionTypeName: string;
      startedAt: string;
      durationMinutes: number;
      pallets: number;
      rampNumber: string;
    }>;

    const taskMap = new Map(loader.data.tasks.map((task) => [task.id, task]));
    return loader.data.sessions
      .map((session) => {
        const task = taskMap.get(session.actionTaskId);
        return {
          id: session.id,
          workerName: session.workerName,
          vehicleCode: task?.vehicleCode ?? '—',
          actionTypeName: task?.actionTypeName ?? '—',
          startedAt: session.startedAt,
          durationMinutes: session.durationMinutes,
          pallets: session.palletsCompletedInSession,
          rampNumber: session.rampNumber
        };
      })
      .sort((a, b) => b.durationMinutes - a.durationMinutes)
      .slice(0, 10);
  }, [loader.data]);

  const workerDetails = useMemo(() => {
    if (!loader.data) return [];

    const taskMap = new Map(loader.data.tasks.map((task) => [task.id, task]));
    const grouped = new Map<
      string,
      {
        workerId: string;
        workerName: string;
        totalPallets: number;
        totalMinutes: number;
        sessions: Array<{
          id: string;
          startedAt: string;
          rampNumber: string;
          pallets: number;
          durationMinutes: number;
          vehicleCode: string;
          carrierName: string;
          actionTypeName: string;
          comment: string;
        }>;
      }
    >();

    for (const session of loader.data.sessions) {
      const task = taskMap.get(session.actionTaskId);
      const key = session.workerId || session.workerName;
      const existing = grouped.get(key) ?? {
        workerId: session.workerId,
        workerName: session.workerName,
        totalPallets: 0,
        totalMinutes: 0,
        sessions: []
      };

      existing.totalPallets += session.palletsCompletedInSession;
      existing.totalMinutes += session.durationMinutes;
      existing.sessions.push({
        id: session.id,
        startedAt: session.startedAt,
        rampNumber: session.rampNumber,
        pallets: session.palletsCompletedInSession,
        durationMinutes: session.durationMinutes,
        vehicleCode: task?.vehicleCode ?? '—',
        carrierName: task?.carrierName ?? '—',
        actionTypeName: task?.actionTypeName ?? '—',
        comment: session.comment || '—'
      });

      grouped.set(key, existing);
    }

    return Array.from(grouped.values())
      .map((worker) => ({
        ...worker,
        sessions: worker.sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [loader.data]);

  const selectedWorkerDetails = useMemo(
    () => (selectedWorkerId === 'all' ? workerDetails : workerDetails.filter((item) => item.workerId === selectedWorkerId)),
    [selectedWorkerId, workerDetails]
  );

  const workerFilterOptions = useMemo(
    () =>
      workerDetails.map((worker) => ({
        id: worker.workerId,
        label: worker.workerName
      })),
    [workerDetails]
  );

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const exportPdf = () => {
    if (!loader.data) return;

    const rows = workerDetails
      .map((worker) => {
        const sessionsRows = worker.sessions
          .map(
            (session) => `
              <tr>
                <td>${escapeHtml(formatDateTime(session.startedAt))}</td>
                <td>${escapeHtml(session.vehicleCode)}</td>
                <td>${escapeHtml(session.carrierName)}</td>
                <td>${escapeHtml(session.actionTypeName)}</td>
                <td>${escapeHtml(session.rampNumber)}</td>
                <td>${session.pallets}</td>
                <td>${escapeHtml(formatMinutes(session.durationMinutes))}</td>
                <td>${escapeHtml(session.comment)}</td>
              </tr>
            `
          )
          .join('');

        return `
          <section class="worker">
            <h3>${escapeHtml(worker.workerName)}</h3>
            <p>${worker.sessions.length} sesji, ${worker.totalPallets} palet, ${escapeHtml(formatMinutes(worker.totalMinutes))}</p>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pojazd</th>
                  <th>Przewoźnik</th>
                  <th>Typ akcji</th>
                  <th>Rampa</th>
                  <th>Palety</th>
                  <th>Czas</th>
                  <th>Komentarz</th>
                </tr>
              </thead>
              <tbody>${sessionsRows}</tbody>
            </table>
          </section>
        `;
      })
      .join('');

    const html = `
      <!doctype html>
      <html lang="pl">
        <head>
          <meta charset="utf-8" />
          <title>Raport ${fromDate} - ${toDate}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Inter, Arial, sans-serif; color: #0f172a; }
            h1 { margin: 0 0 8px; font-size: 22px; }
            .meta { margin-bottom: 12px; font-size: 13px; color: #334155; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
            .summary div { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; }
            .summary b { display: block; font-size: 20px; margin-top: 3px; }
            .worker { margin: 14px 0; page-break-inside: avoid; }
            .worker h3 { margin: 0 0 3px; font-size: 16px; }
            .worker p { margin: 0 0 8px; color: #475569; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: top; word-break: break-word; }
            th { background: #eef2f7; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Raport operacyjny</h1>
          <div class="meta">Zakres: ${escapeHtml(fromDate)} - ${escapeHtml(toDate)}</div>
          <div class="summary">
            <div>Pracowników<b>${loader.data.workers}</b></div>
            <div>Pojazdów<b>${loader.data.vehicles}</b></div>
            <div>Palety<b>${loader.data.totalPallets}</b></div>
            <div>Czas pracy<b>${escapeHtml(formatMinutes(loader.data.totalMinutes))}</b></div>
          </div>
          ${rows || '<p>Brak danych do wydruku.</p>'}
        </body>
      </html>
    `;

    try {
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.style.right = '0';
      frame.style.bottom = '0';
      document.body.appendChild(frame);

      const printDoc = frame.contentWindow?.document;
      if (!printDoc || !frame.contentWindow) {
        frame.remove();
        throw new Error('Brak dostępu do modułu wydruku');
      }

      printDoc.open();
      printDoc.write(html);
      printDoc.close();

      const runPrint = () => {
        const win = frame.contentWindow;
        if (!win) return;
        const cleanup = () => frame.remove();
        win.onafterprint = cleanup;
        win.focus();
        win.print();
        setTimeout(cleanup, 10000);
      };

      // Safari/iOS needs delay before print to avoid blank/black document.
      setTimeout(runPrint, 250);
    } catch {
      window.alert('Nie udało się wygenerować PDF. Spróbuj ponownie lub użyj desktopowej przeglądarki.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('page.reports.title')}</h1>
        <Button variant="secondary" onClick={exportPdf} disabled={!loader.data || loader.loading}>
          Pobierz PDF
        </Button>
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

      {loader.loading ? <Loader /> : null}

      {loader.data ? (
        <>
          <SummaryCards
            items={[
              { label: 'Pracowników w raporcie', value: loader.data.workers },
              { label: 'Pojazdów', value: loader.data.vehicles },
              { label: 'Wykonane palety', value: loader.data.totalPallets },
              { label: 'Akcji', value: loader.data.tasks.length },
              { label: 'Palety / godz.', value: Number(efficiency.palletsPerHourLabel) }
            ]}
          />

          <Card>
            <h3 style={{ marginBottom: 8 }}>Czas pracy</h3>
            <div className="kpi">Łącznie: {formatMinutes(loader.data.totalMinutes)}</div>
          </Card>

          <Card>
            <h3 style={{ marginBottom: 8 }}>Średni czas na typ akcji</h3>
            {avgByActionType.length === 0 ? <EmptyState text="Brak danych typów akcji dla tego okresu" /> : null}
            {avgByActionType.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Typ akcji</th>
                    <th>Sesje</th>
                    <th>Palety</th>
                    <th>Średnio / sesję</th>
                    <th>Palety / godz.</th>
                  </tr>
                </thead>
                <tbody>
                  {avgByActionType.map((row) => (
                    <tr key={row.actionTypeName}>
                      <td data-label="Typ akcji">{row.actionTypeName}</td>
                      <td data-label="Sesje">{row.sessions}</td>
                      <td data-label="Palety">{row.totalPallets}</td>
                      <td data-label="Średnio / sesję">{formatMinutes(Math.round(row.averageMinutes))}</td>
                      <td data-label="Palety / godz.">{row.palletsPerHour.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </Card>

          <Card>
            <h3 style={{ marginBottom: 8 }}>Top opóźnień (najdłuższe sesje)</h3>
            {topDelays.length === 0 ? <EmptyState text="Brak opóźnień do analizy" /> : null}
            {topDelays.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Pracownik</th>
                    <th>Pojazd</th>
                    <th>Typ akcji</th>
                    <th>Rampa</th>
                    <th>Palety</th>
                    <th>Czas</th>
                  </tr>
                </thead>
                <tbody>
                  {topDelays.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Data">{formatDateTime(row.startedAt)}</td>
                      <td data-label="Pracownik">{row.workerName}</td>
                      <td data-label="Pojazd">{row.vehicleCode}</td>
                      <td data-label="Typ akcji">{row.actionTypeName}</td>
                      <td data-label="Rampa">{row.rampNumber}</td>
                      <td data-label="Palety">{row.pallets}</td>
                      <td data-label="Czas">{formatMinutes(row.durationMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </Card>

          <Card>
            <h3 style={{ marginBottom: 8 }}>Według pracowników</h3>
            {byWorker.length === 0 ? <EmptyState text="Brak danych pracowników w tym okresie" /> : null}
            {byWorker.length > 0 ? (
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
            ) : null}
          </Card>

          <Card>
            <h3 style={{ marginBottom: 8 }}>Szczegóły pracy pracowników</h3>
            <div className="formGrid">
              <Field label="Drill-down: pracownik">
                <Select value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)}>
                  <option value="all">Wszyscy</option>
                  {workerFilterOptions.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {selectedWorkerDetails.length === 0 ? <EmptyState text="Brak szczegółowych danych dla wybranego okresu" /> : null}
            {selectedWorkerDetails.length > 0 ? (
              <div className="stack">
                {selectedWorkerDetails.map((worker) => (
                  <Card key={`${worker.workerId}-${worker.workerName}`}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong>{worker.workerName}</strong>
                      <span className="kpi">
                        {worker.sessions.length} sesji, {worker.totalPallets} palet, {formatMinutes(worker.totalMinutes)}
                      </span>
                    </div>
                    <Table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Pojazd</th>
                          <th>Przewoźnik</th>
                          <th>Typ akcji</th>
                          <th>Rampa</th>
                          <th>Palety</th>
                          <th>Czas</th>
                          <th>Komentarz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {worker.sessions.map((session) => (
                          <tr key={session.id}>
                            <td data-label="Data">{formatDateTime(session.startedAt)}</td>
                            <td data-label="Pojazd">{session.vehicleCode}</td>
                            <td data-label="Przewoźnik">{session.carrierName}</td>
                            <td data-label="Typ akcji">{session.actionTypeName}</td>
                            <td data-label="Rampa">{session.rampNumber}</td>
                            <td data-label="Palety">{session.pallets}</td>
                            <td data-label="Czas">{formatMinutes(session.durationMinutes)}</td>
                            <td data-label="Komentarz">{session.comment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card>
                ))}
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
};
