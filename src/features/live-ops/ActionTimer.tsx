import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext';
import { formatHhMmSs, toDurationSeconds } from './time';
import styles from './ActionTimer.module.css';

interface Props {
  startedAt?: string | null;
  endedAt?: string | null;
  prefix?: string;
}

export const ActionTimer = ({ startedAt, endedAt, prefix }: Props) => {
  const { t } = useI18n();
  const [tick, setTick] = useState(0);
  const isLive = Boolean(startedAt && !endedAt);

  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [isLive]);

  const value = useMemo(() => {
    void tick;
    return formatHhMmSs(toDurationSeconds(startedAt, endedAt));
  }, [endedAt, startedAt, tick]);

  return (
    <span className={styles.timer}>
      {(prefix || t('live.timer'))}: {value}
    </span>
  );
};
