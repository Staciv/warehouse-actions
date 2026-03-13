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
import type { ActionTask } from '../types/domain';
import styles from './page.module.css';

interface VehicleGroup {
  vehicleCode: string;
  arrivalDate: string;
  arrivalTime?: string;
  carrierId: string;
  carrierName: string;
  tasks: ActionTask[];
}

export const VehiclesPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [carrierId, setCarrierId] = useState('all');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const debouncedVehicleQuery = useDebouncedValue(vehicleQuery, 350);

  const { carriers } = useReferenceData();
  const filters = useMemo(
    () => ({ status: 'all' as const, fromDate, toDate, carrierId, vehicleQuery: debouncedVehicleQuery }),
    [carrierId, debouncedVehicleQuery, fromDate, toDate]
  );
  const { tasks, loading, error, reload } = useTasks(filters);

  const grouped = useMemo<VehicleGroup[]>(() => {
    const map = new Map<string, ActionTask[]>();
    for (const task of tasks) {
      const prev = map.get(task.vehicleCode) ?? [];
      map.set(task.vehicleCode, [...prev, task]);
    }

    return Array.from(map.entries()).map(([vehicleCode, rows]) => ({
      vehicleCode,
      arrivalDate: rows[0].arrivalDate,
      arrivalTime: rows[0].arrivalTime,
      carrierId: rows[0].carrierId,
      carrierName: rows[0].carrierName,
      tasks: rows
    }));
  }, [tasks]);

  const [editingVehicleCode, setEditingVehicleCode] = useState<string | null>(null);
  const editingGroup = grouped.find((group) => group.vehicleCode === editingVehicleCode) ?? null;

  const [editVehicleCode, setEditVehicleCode] = useState('');
  const [editCarrierId, setEditCarrierId] = useState('');
  const [editArrivalDate, setEditArrivalDate] = useState('');
  const [editArrivalTime, setEditArrivalTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const openEdit = (group: VehicleGroup) => {
    setEditingVehicleCode(group.vehicleCode);
    setEditVehicleCode(group.vehicleCode);
    setEditCarrierId(group.carrierId);
    setEditArrivalDate(group.arrivalDate.slice(0, 10));
    setEditArrivalTime(group.arrivalTime ?? '');
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

      await Promise.all(
        editingGroup.tasks.map((task) =>
          repository.updateActionTask(
            task.id,
            {
              vehicleCode: editVehicleCode.trim(),
              carrierId: editCarrierId,
              arrivalDate: arrivalDateIso,
              arrivalTime: editArrivalTime
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
                <th>Akcje</th>
                <th></th>
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
                  <td data-label="Akcje">
                    <div className={`stack ${styles.mobileActionList}`}>
                      {row.tasks.map((task) => (
                        <div key={task.id} className={styles.mobileActionItem}>
                          <Link to={`/actions/${task.id}`} className={styles.mobileActionName}>
                            {task.actionTypeName}
                          </Link>
                          <StatusBadge status={task.status} />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td data-label="Akcje">
                    <Button variant="secondary" onClick={() => openEdit(row)}>
                      Edytuj
                    </Button>
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
