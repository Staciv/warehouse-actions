import { Card } from '../../components/ui/Card';
import { Link } from 'react-router-dom';
import styles from '../../components/ui/ui.module.css';

interface SummaryItem {
  label: string;
  value: number;
  to?: string;
}

export const SummaryCards = ({ items }: { items: SummaryItem[] }) => {
  return (
    <div className={styles.summaryGrid}>
      {items.map((item) => (
        item.to ? (
          <Link key={item.label} to={item.to} className={styles.summaryLinkCard}>
            <Card>
              <div className="kpi">{item.label}</div>
              <div className={styles.summaryValue}>{item.value}</div>
            </Card>
          </Link>
        ) : (
          <Card key={item.label}>
            <div className="kpi">{item.label}</div>
            <div className={styles.summaryValue}>{item.value}</div>
          </Card>
        )
      ))}
    </div>
  );
};
