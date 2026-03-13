import type { LiveAction } from '../../types/live-ops';
import { useI18n } from '../../shared/i18n/I18nContext';
import { ActionProgressBar } from './ActionProgressBar';
import styles from './ActionCard.module.css';

export const ActionCard = ({ action }: { action: LiveAction }) => {
  const { t } = useI18n();
  const statusLabel: Record<LiveAction['status'], string> = {
    planned: t('live.action.planned'),
    in_progress: t('live.action.in_progress'),
    completed: t('live.action.completed')
  };

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{action.actionType}</h3>
          <span className={`${styles.badge} ${action.status === 'completed' ? styles.completed : action.status === 'in_progress' ? styles.inProgress : styles.planned}`}>
            {statusLabel[action.status]}
          </span>
        </div>
        <div className={styles.sub}>
          <span>{t('live.vehicle')}: {action.truckId}</span>
          <span>{t('live.carrier')}: {action.carrier}</span>
        </div>
      </div>

      <ActionProgressBar totalPallets={action.totalPallets} completedPallets={action.completedPallets} />

      {action.assignedWorkerNames.length > 0 ? (
        <div className={styles.workers}>
          {action.assignedWorkerNames.map((name) => (
            <span className={styles.worker} key={`${action.id}-${name}`}>
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
};
