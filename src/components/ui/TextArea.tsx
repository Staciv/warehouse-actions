import type { TextareaHTMLAttributes } from 'react';
import styles from './ui.module.css';

export const TextArea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  return <textarea className={styles.textarea} {...props} />;
};
