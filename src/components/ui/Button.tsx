import type { ButtonHTMLAttributes } from 'react';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = ({ variant = 'primary', className = '', ...props }: Props) => {
  return <button className={`${styles.button} ${styles[variant]} ${className}`} {...props} />;
};
