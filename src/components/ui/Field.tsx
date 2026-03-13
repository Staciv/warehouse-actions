import type { ReactNode } from 'react';
import styles from './ui.module.css';

interface Props {
  label: string;
  error?: string;
  children: ReactNode;
}

export const Field = ({ label, error, children }: Props) => {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  );
};
