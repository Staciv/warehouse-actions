import styles from './ui.module.css';
import { useI18n } from '../../shared/i18n/I18nContext';

export const Loader = ({ text }: { text?: string }) => {
  const { t } = useI18n();
  return <div className={styles.loader}>{text ?? t('common.loading')}</div>;
};

export const EmptyState = ({ text }: { text: string }) => {
  return <div className={styles.empty}>{text}</div>;
};

export const ErrorState = ({ text }: { text: string }) => {
  return <div className={styles.error}>{text}</div>;
};
