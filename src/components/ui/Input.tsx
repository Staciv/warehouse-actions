import type { InputHTMLAttributes } from 'react';
import styles from './ui.module.css';

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => {
  return <input className={styles.input} {...props} />;
};
