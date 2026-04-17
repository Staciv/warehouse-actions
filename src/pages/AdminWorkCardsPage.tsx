import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState, Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { detectGaps, detectOverlaps } from '../entities/workday';
import { useAuth } from '../features/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDate, formatDateTime, formatMinutes } from '../shared/utils/date';
import { createId } from '../shared/utils/id';
import { getRepository } from '../services/repositories';
import type { User, WorkDay, WorkLogEntry, WorkTypeCategory, WorkTypeDictionary } from '../types/domain';
import styles from './workCard.module.css';

const workTypeCategories: Array<{ value: WorkTypeCategory; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'pre_shift', label: 'Pre-shift' },
  { value: 'gap_fill', label: 'Gap fill' },
  { value: 'system', label: 'System' }
];

export const AdminWorkCardsPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [workers, setWorkers] = useState<User[]>([]);
  const [days, setDays] = useState<WorkDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeDictionary[]>([]);

  const [workerId, setWorkerId] = useState('all');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<WorkDay['status'] | 'all'>('all');

  const [newWorkTypeName, setNewWorkTypeName] = useState('');
  const [newWorkTypeCategory, setNewWorkTypeCategory] = useState<WorkTypeCategory>('manual');

  const selectedDay = useMemo(() => days.find((day) => day.id === selectedDayId) ?? null, [days, selectedDayId]);
  const overlaps = useMemo(() => detectOverlaps(entries), [entries]);
  const gaps = useMemo(() => detectGaps(entries), [entries]);

  const loadBase = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const repository = getRepository();
      const [usersRows, daysRows, typesRows] = await Promise.all([
        repository.getUsers(user),
        repository.getWorkDays(
          {
            workerId: workerId === 'all' ? undefined : workerId,
            date: date || undefined,
            status
          },
          user
        ),
        repository.getWorkTypes()
      ]);
      setWorkers(usersRows.filter((entry) => entry.role === 'worker'));
      setDays(daysRows);
      setWorkTypes(typesRows);
      if (!selectedDayId && daysRows[0]) {
        setSelectedDayId(daysRows[0].id);
      } else if (selectedDayId && !daysRows.some((entry) => entry.id === selectedDayId)) {
        setSelectedDayId(daysRows[0]?.id ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać kart pracy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBase();
  }, [user?.id, workerId, date, status]);

  useEffect(() => {
    if (!selectedDayId || !user) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const rows = await getRepository().getWorkLogEntries(selectedDayId, user);
        if (!cancelled) setEntries(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nie udało się pobrać wpisów dnia');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedDayId, user?.id]);

  if (!user) return null;
  if (loading) return <Loader text={t('common.loading')} />;

  const createWorkType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newWorkTypeName.trim()) return;
    setError('');
    try {
      await getRepository().upsertWorkType(
        {
          id: createId(),
          name: newWorkTypeName.trim(),
          category: newWorkTypeCategory,
          isActive: true
        },
        user
      );
      setNewWorkTypeName('');
      setNotice('Typ pracy dodany');
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać typu pracy');
    }
  };

  const toggleWorkType = async (entry: WorkTypeDictionary) => {
    setError('');
    try {
      await getRepository().upsertWorkType(
        {
          id: entry.id,
          name: entry.name,
          category: entry.category,
          isActive: !entry.isActive
        },
        user
      );
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić statusu typu pracy');
    }
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Karty pracy pracowników</h1>
        <div className={styles.subtitle}>Podgląd dnia, oś czasu, luki i konflikty</div>
      </div>

      {notice ? (
        <Card compact>
          <div className={styles.notice}>{notice}</div>
        </Card>
      ) : null}
      {error ? (
        <Card compact>
          <div className={styles.error}>{error}</div>
        </Card>
      ) : null}

      <Card>
        <div className="formGrid">
          <Field label="Pracownik">
            <Select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="all">Wszyscy</option>
              {workers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Status dnia">
            <Select value={status} onChange={(event) => setStatus(event.target.value as WorkDay['status'] | 'all')}>
              <option value="all">Wszystkie</option>
              <option value="active">Aktywne</option>
              <option value="closed">Zamknięte</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="sectionTitle">Lista dni</h3>
        {days.length === 0 ? (
          <EmptyState text="Brak kart pracy dla filtrów" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Pracownik</th>
                <th>Status</th>
                <th>Praca</th>
                <th>Luki</th>
                <th>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {days.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Data">{formatDate(`${entry.date}T00:00:00.000Z`)}</td>
                  <td data-label="Pracownik">{entry.workerName}</td>
                  <td data-label="Status">
                    <Badge tone={entry.status === 'active' ? 'warning' : 'success'} text={entry.status === 'active' ? 'Aktywny' : 'Zamknięty'} />
                  </td>
                  <td data-label="Praca">{formatMinutes(entry.totalWorkedMinutes)}</td>
                  <td data-label="Luki">{formatMinutes(entry.totalGapMinutes)}</td>
                  <td data-label="Akcja">
                    <Button variant="secondary" onClick={() => setSelectedDayId(entry.id)}>
                      Otwórz
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {selectedDay ? (
        <Card>
          <h3 className="sectionTitle">
            Dzień: {selectedDay.workerName} · {formatDate(`${selectedDay.date}T00:00:00.000Z`)}
          </h3>
          <div className="formGrid">
            <div>
              <div className="kpi">Start</div>
              <div>{formatDateTime(selectedDay.actualStart)}</div>
            </div>
            <div>
              <div className="kpi">Plan koniec</div>
              <div>{formatDateTime(selectedDay.plannedEnd)}</div>
            </div>
            <div>
              <div className="kpi">Faktyczny koniec</div>
              <div>{selectedDay.actualEnd ? formatDateTime(selectedDay.actualEnd) : '—'}</div>
            </div>
            <div>
              <div className="kpi">Presence</div>
              <div>{formatMinutes(selectedDay.totalPresenceMinutes)}</div>
            </div>
            <div>
              <div className="kpi">Po przyjęciach</div>
              <div>
                {selectedDay.exitTarget === 'home'
                  ? 'Dom'
                  : selectedDay.exitTarget === 'other_process'
                    ? selectedDay.exitWorkTypeName ?? 'Inny proces'
                    : '—'}
              </div>
            </div>
            <div>
              <div className="kpi">Komentarz / powód</div>
              <div>{selectedDay.exitComment || '—'}</div>
            </div>
          </div>
          <div className={styles.warningGrid}>
            {overlaps.length > 0 ? <div className={styles.error}>Konflikty: {overlaps.length}</div> : null}
            {gaps.length > 0 ? <div className={styles.warning}>Luki: {gaps.length}</div> : null}
          </div>
          {entries.length === 0 ? (
            <EmptyState text="Brak wpisów dla wybranego dnia" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Od</th>
                  <th>Do</th>
                  <th>Typ pracy</th>
                  <th>Źródło</th>
                  <th>Akcja</th>
                  <th>Pojazd</th>
                  <th>Palety</th>
                  <th>Czas</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Od">{formatDateTime(entry.startTime)}</td>
                    <td data-label="Do">{entry.endTime ? formatDateTime(entry.endTime) : '—'}</td>
                    <td data-label="Typ pracy">{entry.workTypeName}</td>
                    <td data-label="Źródło">
                      <Badge tone={entry.source === 'action' ? 'warning' : 'default'} text={entry.source === 'action' ? 'Akcja' : 'Manual'} />
                    </td>
                    <td data-label="Akcja">{entry.relatedActionType ?? '—'}</td>
                    <td data-label="Pojazd">{entry.relatedVehicleCode ?? '—'}</td>
                    <td data-label="Palety">{entry.palletsCompleted ?? '—'}</td>
                    <td data-label="Czas">{formatMinutes(entry.durationMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      <Card>
        <h3 className="sectionTitle">Słownik typów pracy</h3>
        <form className="inlineActions rowActions" onSubmit={createWorkType}>
          <Field label="Nazwa">
            <Input value={newWorkTypeName} onChange={(event) => setNewWorkTypeName(event.target.value)} />
          </Field>
          <Field label="Kategoria">
            <Select value={newWorkTypeCategory} onChange={(event) => setNewWorkTypeCategory(event.target.value as WorkTypeCategory)}>
              {workTypeCategories.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Dodaj</Button>
        </form>
        <div className={styles.typesList}>
          {workTypes.map((entry) => (
            <Card key={entry.id} compact>
              <div className={styles.typeRow}>
                <div>
                  <strong>{entry.name}</strong>
                  <div className="kpi">{entry.category}</div>
                </div>
                <Button variant="secondary" onClick={() => void toggleWorkType(entry)}>
                  {entry.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
