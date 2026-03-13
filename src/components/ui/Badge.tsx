import styles from './ui.module.css';

type Tone = 'default' | 'success' | 'warning' | 'danger';

interface Props {
  text: string;
  tone?: Tone;
}

const toneMap: Record<Tone, string> = {
  default: styles.badgeDefault,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger
};

export const Badge = ({ text, tone = 'default' }: Props) => {
  return <span className={`${styles.badge} ${toneMap[tone]}`}>{text}</span>;
};
