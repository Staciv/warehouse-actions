import type { LiveWorker } from '../../types/live-ops';
import { useI18n } from '../../shared/i18n/I18nContext';
import { formatDurationWords } from './time';
import { WorkerStatusBadge } from './WorkerStatusBadge';
import styles from './WorkerLiveCard.module.css';

export const WorkerLiveCard = ({ worker }: { worker: LiveWorker }) => {
  const { t } = useI18n();

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.name}>{worker.name}</div>
          <div className={styles.role}>{worker.role}</div>
        </div>
        <WorkerStatusBadge status={worker.status} />
      </div>

      {worker.currentActionName ? <div className={styles.action}>{worker.currentActionName}</div> : null}
      {(worker.status === 'in_action' || worker.status === 'paused') && worker.workedMinutes ? (
        <div className={styles.meta}>{t('live.workTime')}: {formatDurationWords(worker.workedMinutes)}</div>
      ) : null}
    </article>
  );
};
