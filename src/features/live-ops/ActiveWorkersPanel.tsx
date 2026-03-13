import { Card } from '../../components/ui/Card';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { LiveWorker } from '../../types/live-ops';
import { WorkerLiveCard } from './WorkerLiveCard';
import styles from './LivePanels.module.css';

export const ActiveWorkersPanel = ({ workers }: { workers: LiveWorker[] }) => {
  const { t } = useI18n();

  return (
    <Card>
      <div className={styles.panel}>
        <h3>{t('live.workersTitle')}</h3>
        {workers.length === 0 ? (
          <div className={styles.empty}>{t('live.noWorkers')}</div>
        ) : (
          <div className={styles.list}>
            {workers.map((worker) => (
              <WorkerLiveCard key={worker.id} worker={worker} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
