import type { ReactNode } from 'react';
import styles from './ui.module.css';

export const Card = ({
  children,
  className,
  compact
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) => {
  const classes = [styles.card];
  if (compact) classes.push(styles.cardCompact);
  if (className) classes.push(className);
  return <section className={classes.join(' ')}>{children}</section>;
};
