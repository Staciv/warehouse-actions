import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PRIORITY_I18N_KEYS, STATUS_I18N_KEYS } from '../../constants/statuses';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { ActionTaskFilters, ActionType, Carrier } from '../../types/domain';

interface Props {
  filters: ActionTaskFilters;
  carriers: Carrier[];
  actionTypes: ActionType[];
  onChange: (next: ActionTaskFilters) => void;
}

export const ActionFilters = ({ filters, carriers, actionTypes, onChange }: Props) => {
  const { t } = useI18n();
  return (
    <Card>
      <div className="formGrid">
        <Field label={t('filters.status')}>
          <Select
            value={filters.status ?? 'all'}
            onChange={(event) => onChange({ ...filters, status: event.target.value as ActionTaskFilters['status'] })}
          >
            <option value="all">{t('filters.all')}</option>
            <option value="planned">{t(STATUS_I18N_KEYS.planned)}</option>
            <option value="executing">{t(STATUS_I18N_KEYS.executing)}</option>
            <option value="cancelled">{t(STATUS_I18N_KEYS.cancelled)}</option>
            <option value="draft">{t(STATUS_I18N_KEYS.draft)}</option>
            <option value="inactive">{t(STATUS_I18N_KEYS.inactive)}</option>
            <option value="active">{t(STATUS_I18N_KEYS.active)}</option>
            <option value="in_progress">{t(STATUS_I18N_KEYS.in_progress)}</option>
            <option value="partial">{t(STATUS_I18N_KEYS.partial)}</option>
            <option value="completed">{t(STATUS_I18N_KEYS.completed)}</option>
            <option value="deferred">{t(STATUS_I18N_KEYS.deferred)}</option>
            <option value="archived">{t(STATUS_I18N_KEYS.archived)}</option>
          </Select>
        </Field>

        <Field label={t('filters.priority')}>
          <Select
            value={filters.priority ?? 'all'}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ ...filters, priority: value === 'all' ? 'all' : Number(value) as 1 | 2 | 3 | 4 });
            }}
          >
            <option value="all">{t('filters.all')}</option>
            <option value="4">{t(PRIORITY_I18N_KEYS[4])}</option>
            <option value="3">{t(PRIORITY_I18N_KEYS[3])}</option>
            <option value="2">{t(PRIORITY_I18N_KEYS[2])}</option>
            <option value="1">{t(PRIORITY_I18N_KEYS[1])}</option>
          </Select>
        </Field>

        <Field label={t('filters.carrier')}>
          <Select
            value={filters.carrierId ?? 'all'}
            onChange={(event) => onChange({ ...filters, carrierId: event.target.value as ActionTaskFilters['carrierId'] })}
          >
            <option value="all">{t('filters.all')}</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('filters.actionType')}>
          <Select
            value={filters.actionTypeId ?? 'all'}
            onChange={(event) =>
              onChange({ ...filters, actionTypeId: event.target.value as ActionTaskFilters['actionTypeId'] })
            }
          >
            <option value="all">{t('filters.all')}</option>
            {actionTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('filters.activity')}>
          <Select
            value={filters.onlyActive ?? 'all'}
            onChange={(event) =>
              onChange({ ...filters, onlyActive: event.target.value as ActionTaskFilters['onlyActive'] })
            }
          >
            <option value="all">{t('filters.all')}</option>
            <option value="active">{t('filters.activeOnly')}</option>
            <option value="inactive">{t('filters.inactiveOnly')}</option>
          </Select>
        </Field>

        <Field label={t('filters.vehicleCode')}>
          <Input
            value={filters.vehicleQuery ?? ''}
            onChange={(event) => onChange({ ...filters, vehicleQuery: event.target.value })}
            placeholder={t('filters.searchByVehicle')}
          />
        </Field>

        <Field label={t('filters.fromDate')}>
          <Input
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(event) => onChange({ ...filters, fromDate: event.target.value || undefined })}
          />
        </Field>

        <Field label={t('filters.toDate')}>
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
