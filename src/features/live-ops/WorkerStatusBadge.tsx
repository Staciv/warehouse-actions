import type { WorkerStatus } from '../../types/live-ops';
import { useI18n } from '../../shared/i18n/I18nContext';
import styles from './WorkerStatusBadge.module.css';

export const WorkerStatusBadge = ({ status }: { status: WorkerStatus }) => {
  const { t } = useI18n();
  const statusLabel: Record<WorkerStatus, string> = {
    available: t('live.status.available'),
    in_action: t('live.status.in_action'),
    paused: t('live.status.paused'),
    offline: t('live.status.offline'),
    completed: t('live.status.completed')
  };

  return <span className={`${styles.badge} ${styles[status]}`}>{statusLabel[status]}</span>;
};
