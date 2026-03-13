import { PRIORITY_LABELS, STATUS_LABELS } from '../../constants/statuses';
import { Badge } from '../../components/ui/Badge';
import type { TaskPriority, TaskStatus } from '../../types/domain';

export const StatusBadge = ({ status }: { status: TaskStatus }) => {
  const tone =
    status === 'completed'
      ? 'success'
      : status === 'partial' || status === 'in_progress' || status === 'executing'
        ? 'warning'
        : status === 'deferred' || status === 'archived' || status === 'cancelled'
          ? 'danger'
          : 'default';

  return <Badge text={STATUS_LABELS[status]} tone={tone} />;
};

export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => {
  const tone = priority === 4 ? 'danger' : priority === 3 ? 'warning' : 'default';
  return <Badge text={PRIORITY_LABELS[priority]} tone={tone} />;
};
