import { PRIORITY_I18N_KEYS, STATUS_I18N_KEYS } from '../../constants/statuses';
import { Badge } from '../../components/ui/Badge';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { TaskPriority, TaskStatus } from '../../types/domain';

export const StatusBadge = ({ status }: { status: TaskStatus }) => {
  const { t } = useI18n();
  const tone =
    status === 'completed'
      ? 'success'
      : status === 'partial' || status === 'in_progress' || status === 'executing'
        ? 'warning'
        : status === 'deferred' || status === 'archived' || status === 'cancelled'
          ? 'danger'
          : 'default';

  return <Badge text={t(STATUS_I18N_KEYS[status])} tone={tone} />;
};

export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => {
  const { t } = useI18n();
  const tone = priority === 4 ? 'danger' : priority === 3 ? 'warning' : 'default';
  return <Badge text={t(PRIORITY_I18N_KEYS[priority])} tone={tone} />;
};
