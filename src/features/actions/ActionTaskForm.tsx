import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TextArea } from '../../components/ui/TextArea';
import type { ActionTask, ActionType, Carrier, TaskPriority } from '../../types/domain';
import type { CreateActionTaskPayload, UpdateActionTaskPayload } from '../../services/repositories/types';

interface BaseProps {
  carriers: Carrier[];
  actionTypes: ActionType[];
  submitLabel: string;
}

type CreateProps = BaseProps & {
  mode: 'create';
  initial?: undefined;
  onSubmit: (payload: CreateActionTaskPayload) => Promise<void>;
};

type UpdateProps = BaseProps & {
  mode: 'update';
  initial: ActionTask;
  onSubmit: (payload: UpdateActionTaskPayload) => Promise<void>;
};

type Props = CreateProps | UpdateProps;

export const ActionTaskForm = ({ carriers, actionTypes, initial, onSubmit, submitLabel }: Props) => {
  const [vehicleCode, setVehicleCode] = useState(initial?.vehicleCode ?? '');
  const [carrierId, setCarrierId] = useState(initial?.carrierId ?? carriers[0]?.id ?? '');
  const [actionTypeId, setActionTypeId] = useState(initial?.actionTypeId ?? actionTypes[0]?.id ?? '');
  const [arrivalDate, setArrivalDate] = useState(initial?.arrivalDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [arrivalTime, setArrivalTime] = useState(initial?.arrivalTime ?? '');
  const [totalPallets, setTotalPallets] = useState<string>(
    initial?.totalPallets !== null && initial?.totalPallets !== undefined ? String(initial.totalPallets) : ''
  );
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 2);
  const [note, setNote] = useState(initial?.note ?? '');
  const [internalComment, setInternalComment] = useState(initial?.internalComment ?? '');
  const [workerComment, setWorkerComment] = useState(initial?.workerComment ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => vehicleCode.trim() && carrierId && actionTypeId && arrivalDate, [
    actionTypeId,
    arrivalDate,
    carrierId,
    vehicleCode
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!canSubmit) {
      setError('Заполните обязательные поля.');
      return;
    }

    const parsedPallets = totalPallets ? Number(totalPallets) : null;
    if (parsedPallets !== null && (Number.isNaN(parsedPallets) || parsedPallets < 0)) {
      setError('Количество палет должно быть числом 0 или больше.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicleCode: vehicleCode.trim(),
        carrierId,
        actionTypeId,
        arrivalDate: new Date(`${arrivalDate}T00:00:00`).toISOString(),
        arrivalTime,
        totalPallets: parsedPallets,
        priority,
        note,
        internalComment,
        workerComment
      };
      await onSubmit(payload);

      if (!initial) {
        setVehicleCode('');
        setTotalPallets('');
        setNote('');
        setInternalComment('');
        setWorkerComment('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить акцию');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="formGrid">
          <Field label="Перевозчик">
            <Select value={carrierId} onChange={(event) => setCarrierId(event.target.value)}>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Тип акции">
            <Select value={actionTypeId} onChange={(event) => setActionTypeId(event.target.value)}>
              {actionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Машина / код">
            <Input value={vehicleCode} onChange={(event) => setVehicleCode(event.target.value)} required />
          </Field>

          <Field label="Дата приезда">
            <Input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} required />
          </Field>

          <Field label="Время приезда">
            <Input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} />
          </Field>

          <Field label="Общее количество палет">
            <Input
              type="number"
              min={0}
              value={totalPallets}
              onChange={(event) => setTotalPallets(event.target.value)}
              placeholder="Пока неизвестно"
            />
          </Field>

          <Field label="Приоритет">
            <Select
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value) as TaskPriority)}
            >
              <option value={1}>Низкий</option>
              <option value={2}>Обычный</option>
              <option value={3}>Высокий</option>
              <option value={4}>Срочно</option>
            </Select>
          </Field>
        </div>

        <Field label="Комментарий администрации">
          <TextArea value={internalComment} onChange={(event) => setInternalComment(event.target.value)} rows={2} />
        </Field>

        <Field label="Комментарий для работника">
          <TextArea value={workerComment} onChange={(event) => setWorkerComment(event.target.value)} rows={2} />
        </Field>

        <Field label="Примечание">
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        </Field>

        {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Сохранение...' : submitLabel}
        </Button>
      </form>
    </Card>
  );
};
