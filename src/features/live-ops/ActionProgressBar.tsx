import styles from './ActionProgressBar.module.css';
import { useI18n } from '../../shared/i18n/I18nContext';

interface Props {
  totalPallets: number;
  completedPallets: number;
}

export const ActionProgressBar = ({ totalPallets, completedPallets }: Props) => {
  const { t } = useI18n();
  const safeTotal = Math.max(0, totalPallets);
  const safeCompleted = Math.max(0, Math.min(completedPallets, safeTotal));
  const remaining = Math.max(0, safeTotal - safeCompleted);
  const percent = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
  const isDone = percent >= 100;

  return (
    <div className={styles.root}>
      <div className={styles.barWrap}>
        <div className={`${styles.bar} ${isDone ? styles.barDone : ''}`} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.meta}>
        <span className={styles.percent}>{percent}%</span>
        <span>{t('live.progress.completed')}: {safeCompleted}</span>
        <span>{t('live.progress.remaining')}: {remaining}</span>
      </div>
    </div>
  );
};
