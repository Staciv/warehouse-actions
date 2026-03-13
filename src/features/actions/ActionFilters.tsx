import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { ActionTaskFilters, ActionType, Carrier } from '../../types/domain';

interface Props {
  filters: ActionTaskFilters;
  carriers: Carrier[];
  actionTypes: ActionType[];
  onChange: (next: ActionTaskFilters) => void;
}

export const ActionFilters = ({ filters, carriers, actionTypes, onChange }: Props) => {
  return (
    <Card>
      <div className="formGrid">
        <Field label="Статус">
          <Select
            value={filters.status ?? 'all'}
            onChange={(event) => onChange({ ...filters, status: event.target.value as ActionTaskFilters['status'] })}
          >
            <option value="all">Все</option>
            <option value="planned">Запланировано</option>
            <option value="executing">Выполняется</option>
            <option value="cancelled">Отменено</option>
            <option value="draft">Черновик</option>
            <option value="inactive">Неактивно</option>
            <option value="active">Активно</option>
            <option value="in_progress">В процессе</option>
            <option value="partial">Частично выполнено</option>
            <option value="completed">Завершено</option>
            <option value="deferred">Отложено</option>
            <option value="archived">Архив</option>
          </Select>
        </Field>

        <Field label="Приоритет">
          <Select
            value={filters.priority ?? 'all'}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ ...filters, priority: value === 'all' ? 'all' : Number(value) as 1 | 2 | 3 | 4 });
            }}
          >
            <option value="all">Все</option>
            <option value="4">Срочно</option>
            <option value="3">Высокий</option>
            <option value="2">Обычный</option>
            <option value="1">Низкий</option>
          </Select>
        </Field>

        <Field label="Перевозчик">
          <Select
            value={filters.carrierId ?? 'all'}
            onChange={(event) => onChange({ ...filters, carrierId: event.target.value as ActionTaskFilters['carrierId'] })}
          >
            <option value="all">Все</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Тип акции">
          <Select
            value={filters.actionTypeId ?? 'all'}
            onChange={(event) =>
              onChange({ ...filters, actionTypeId: event.target.value as ActionTaskFilters['actionTypeId'] })
            }
          >
            <option value="all">Все</option>
            {actionTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Активность">
          <Select
            value={filters.onlyActive ?? 'all'}
            onChange={(event) =>
              onChange({ ...filters, onlyActive: event.target.value as ActionTaskFilters['onlyActive'] })
            }
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
          </Select>
        </Field>

        <Field label="Номер машины">
          <Input
            value={filters.vehicleQuery ?? ''}
            onChange={(event) => onChange({ ...filters, vehicleQuery: event.target.value })}
            placeholder="Поиск по номеру"
          />
        </Field>

        <Field label="Дата с">
          <Input
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(event) => onChange({ ...filters, fromDate: event.target.value || undefined })}
          />
        </Field>

        <Field label="Дата по">
          <Input
            type="date"
            value={filters.toDate ?? ''}
            onChange={(event) => onChange({ ...filters, toDate: event.target.value || undefined })}
          />
        </Field>
      </div>
    </Card>
  );
};
