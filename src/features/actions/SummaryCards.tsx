import { Card } from '../../components/ui/Card';
import { Link } from 'react-router-dom';
import styles from '../../components/ui/ui.module.css';

interface SummaryItem {
  label: string;
  value: number;
  to?: string;
}

export const SummaryCards = ({ items, compact = false }: { items: SummaryItem[]; compact?: boolean }) => {
  const gridClass = compact ? `${styles.summaryGrid} ${styles.summaryGridCompact}` : styles.summaryGrid;
  const valueClass = compact ? `${styles.summaryValue} ${styles.summaryValueCompact}` : styles.summaryValue;
  const cardClass = compact ? `${styles.summaryLinkCard} ${styles.summaryLinkCardCompact}` : styles.summaryLinkCard;
  const cardBodyClass = compact ? styles.cardCompact : undefined;
  return (
    <div className={gridClass}>
      {items.map((item) => (
        item.to ? (
          <Link key={item.label} to={item.to} className={cardClass}>
            <Card className={cardBodyClass}>
              <div className="kpi">{item.label}</div>
              <div className={valueClass}>{item.value}</div>
            </Card>
          </Link>
        ) : (
          <Card key={item.label} className={cardBodyClass}>
            <div className="kpi">{item.label}</div>
            <div className={valueClass}>{item.value}</div>
          </Card>
        )
      ))}
    </div>
  );
};
