import type { SelectHTMLAttributes } from 'react';
import styles from './ui.module.css';

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => {
  return <select className={styles.select} {...props} />;
};
