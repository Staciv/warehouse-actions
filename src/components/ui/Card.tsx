import type { ReactNode } from 'react';
import styles from './ui.module.css';

export const Card = ({ children }: { children: ReactNode }) => {
  return <section className={styles.card}>{children}</section>;
};
