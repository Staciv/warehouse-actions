import styles from './ui.module.css';

export const Loader = ({ text = 'Загрузка...' }: { text?: string }) => {
  return <div className={styles.loader}>{text}</div>;
};

export const EmptyState = ({ text }: { text: string }) => {
  return <div className={styles.empty}>{text}</div>;
};

export const ErrorState = ({ text }: { text: string }) => {
  return <div className={styles.error}>{text}</div>;
};
