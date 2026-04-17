import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState, Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { StatusBadge } from '../features/actions/badges';
import { useAuth } from '../features/auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useReferenceData } from '../hooks/useReferenceData';
import { useTasks } from '../hooks/useTasks';
import { getRepository } from '../services/repositories';
import { useI18n } from '../shared/i18n/I18nContext';
import { formatDate } from '../shared/utils/date';
import type { ActionTask, TaskStatus } from '../types/domain';
import { STATUS_I18N_KEYS } from '../constants/statuses';
import styles from './page.module.css';

interface VehicleGroup {
  vehicleCode: string;
  arrivalDate: string;
  arrivalTime?: string;
  sortTimestamp: number;
  carrierId: string;
  carrierName: string;
  remainingPallets: number;
  totalPallets: number;
  primaryStatus: TaskStatus;
  tasks: ActionTask[];
}

const statusPriority: TaskStatus[] = [
  'executing',
  'in_progress',
  'partial',
  'planned',
  'active',
  'draft',
  'inactive',
  'deferred',
  'cancelled',
  'completed',
  'archived'
];

const deriveVehicleStatus = (tasks: ActionTask[]): TaskStatus => {
  for (const status of statusPriority) {
    if (tasks.some((task) => task.status === status)) return status;
  }
  return tasks[0]?.status ?? 'planned';
};

export const VehiclesPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [carrierId, setCarrierId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const debouncedVehicleQuery = useDebouncedValue(vehicleQuery, 350);

  const { carriers } = useReferenceData();
  const filters = useMemo(
    () => ({ status: 'all' as const, fromDate, toDate, carrierId, vehicleQuery: debouncedVehicleQuery }),
    [carrierId, debouncedVehicleQuery, fromDate, toDate]
  );
  const { tasks, loading, error, reload } = useTasks(filters);

  const groupedAll = useMemo<VehicleGroup[]>(() => {
    const map = new Map<string, ActionTask[]>();
    for (const task of tasks) {
      const prev = map.get(task.vehicleCode) ?? [];
      map.set(task.vehicleCode, [...prev, task]);
    }

    return Array.from(map.entries())
      .map(([vehicleCode, rows]) => {
        const arrivalDate = rows[0].arrivalDate;
        const arrivalTime = rows[0].arrivalTime;
        const datePart = arrivalDate.slice(0, 10);
        const datetime = `${datePart}T${arrivalTime || '00:00'}:00`;

        return {
          vehicleCode,
          arrivalDate,
          arrivalTime,
          sortTimestamp: new Date(datetime).getTime(),
          carrierId: rows[0].carrierId,
          carrierName: rows[0].carrierName,
          remainingPallets: rows.reduce((sum, task) => sum + task.remainingPallets, 0),
          totalPallets: rows.reduce((sum, task) => sum + (task.totalPallets ?? 0), 0),
          primaryStatus: deriveVehicleStatus(rows),
          tasks: rows
        };
      })
      .sort((a, b) => b.sortTimestamp - a.sortTimestamp);
  }, [tasks]);

  const grouped = useMemo(
    () => groupedAll.filter((group) => (statusFilter === 'all' ? true : group.primaryStatus === statusFilter)),
    [groupedAll, statusFilter]
  );

  const [editingVehicleCode, setEditingVehicleCode] = useState<string | null>(null);
  const editingGroup = groupedAll.find((group) => group.vehicleCode === editingVehicleCode) ?? null;

  const [editVehicleCode, setEditVehicleCode] = useState('');
  const [editCarrierId, setEditCarrierId] = useState('');
  const [editArrivalDate, setEditArrivalDate] = useState('');
  const [editArrivalTime, setEditArrivalTime] = useState('');
  const [editTaskTotals, setEditTaskTotals] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const openEdit = (group: VehicleGroup) => {
    setEditingVehicleCode(group.vehicleCode);
    setEditVehicleCode(group.vehicleCode);
    setEditCarrierId(group.carrierId);
    setEditArrivalDate(group.arrivalDate.slice(0, 10));
    setEditArrivalTime(group.arrivalTime ?? '');
    setEditTaskTotals(
      group.tasks.reduce<Record<string, string>>((acc, task) => {
        acc[task.id] = task.totalPallets === null ? '' : String(task.totalPallets);
        return acc;
      }, {})
    );
    setEditError('');
  };

  const saveVehicleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !editingGroup) return;

    if (!editVehicleCode.trim() || !editArrivalDate || !editCarrierId) {
      setEditError('Uzupełnij wymagane pola, aby zaktualizować pojazd.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const repository = getRepository();
      const arrivalDateIso = new Date(`${editArrivalDate}T00:00:00`).toISOString();

      const taskTotalsPayload = editingGroup.tasks.reduce<Record<string, number | null>>((acc, task) => {
        const raw = (editTaskTotals[task.id] ?? '').trim();
        if (raw === '') {
          acc[task.id] = null;
          return acc;
        }

        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(`Liczba palet musi być większa od 0 dla akcji: ${task.actionTypeName}`);
        }

        if (parsed < task.completedPallets) {
          throw new Error(`Palety dla akcji "${task.actionTypeName}" nie mogą być mniejsze niż wykonane (${task.completedPallets}).`);
        }

        acc[task.id] = Math.floor(parsed);
        return acc;
      }, {});

      await Promise.all(
        editingGroup.tasks.map((task) =>
          repository.updateActionTask(
            task.id,
            {
              vehicleCode: editVehicleCode.trim(),
              carrierId: editCarrierId,
              arrivalDate: arrivalDateIso,
              arrivalTime: editArrivalTime,
              totalPallets: taskTotalsPayload[task.id]
            },
            user
          )
        )
      );

      setEditingVehicleCode(null);
      await reload(filters);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Nie udało się zaktualizować pojazdu');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('page.vehicles.title')}</h1>
      <Card>
        <div className="formGrid">
          <Field label="Data od">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="Data do">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label="Przewoźnik">
            <Select value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
              <option value="all">Wszystkie</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pojazd">
            <Input value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} placeholder="Numer/kod" />
          </Field>
          <Field label="Status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}>
              <option value="all">Wszystkie</option>
              {statusPriority.map((status) => (
                <option key={status} value={status}>
                  {t(STATUS_I18N_KEYS[status])}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {editingGroup ? (
        <Card>
          <form onSubmit={saveVehicleEdit} className="stack">
            <h3>Edycja pojazdu: {editingGroup.vehicleCode}</h3>
            <div className="formGrid">
              <Field label="Numer / kod pojazdu">
                <Input value={editVehicleCode} onChange={(e) => setEditVehicleCode(e.target.value)} required />
              </Field>
              <Field label="Przewoźnik">
                <Select value={editCarrierId} onChange={(e) => setEditCarrierId(e.target.value)}>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data przyjazdu">
                <Input type="date" value={editArrivalDate} onChange={(e) => setEditArrivalDate(e.target.value)} required />
              </Field>
              <Field label="Godzina przyjazdu">
                <Input type="time" value={editArrivalTime} onChange={(e) => setEditArrivalTime(e.target.value)} />
              </Field>
            </div>
            <div className="stack">
              <h4>Ilość palet dla akcji</h4>
              <div className={styles.editTaskTotalsGrid}>
                {editingGroup.tasks.map((task) => (
                  <Field
                    key={task.id}
                    label={`${task.actionTypeName} (wykonano: ${task.completedPallets}, zostało: ${task.remainingPallets})`}
                  >
                    <Input
                      type="number"
                      min={task.completedPallets}
                      step={1}
                      value={editTaskTotals[task.id] ?? ''}
                      onChange={(e) =>
                        setEditTaskTotals((prev) => ({
                          ...prev,
                          [task.id]: e.target.value
                        }))
                      }
                      placeholder="np. 80"
                    />
                  </Field>
                ))}
              </div>
            </div>

            {editError ? <div style={{ color: '#c63d3d' }}>{editError}</div> : null}
            <div className="inlineActions">
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingVehicleCode(null)}>
                Anuluj
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        {loading ? <Loader /> : null}
        {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
        {!loading && grouped.length === 0 ? <EmptyState text="Nie znaleziono pojazdów dla wybranych filtrów" /> : null}
        {!loading && grouped.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <th>Pojazd</th>
                <th>Przewoźnik</th>
                <th>Data</th>
                <th>Godzina</th>
                <th>Palety do zrobienia</th>
                <th>Akcje</th>
                <th>Status</th>
                <th>Edycja</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((row) => (
                <tr key={row.vehicleCode}>
                  <td data-label="Pojazd">
                    <span className="truncateText">{row.vehicleCode}</span>
                  </td>
                  <td data-label="Przewoźnik">
                    <span className="truncateText">{row.carrierName}</span>
                  </td>
                  <td data-label="Data">{formatDate(row.arrivalDate)}</td>
                  <td data-label="Godzina">{row.arrivalTime || '—'}</td>
                  <td data-label="Palety do zrobienia">
                    {row.remainingPallets}
                    <span className="kpi"> / {row.totalPallets}</span>
                  </td>
                  <td data-label="Akcje">
                    <div className={`stack ${styles.mobileActionList}`}>
                      {row.tasks.map((task) => (
                        <div key={task.id} className={styles.mobileActionItem}>
                          <Link to={`/actions/${task.id}`} className={styles.mobileActionName}>
                            {task.actionTypeName}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td data-label="Status" className={styles.statusCell}>
                    <div className={`${styles.mobileActionList} ${styles.statusList}`}>
                      {row.tasks.map((task) => (
                        <div key={`${task.id}-status`} className={styles.statusItem}>
                          <StatusBadge status={task.status} />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td data-label="Edycja" className={styles.editCell}>
                    <div className={styles.editCellInner}>
                      <Button variant="secondary" onClick={() => openEdit(row)}>
                        Edytuj
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>
    </div>
  );
};
