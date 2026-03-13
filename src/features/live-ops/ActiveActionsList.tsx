import { Card } from '../../components/ui/Card';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { LiveAction } from '../../types/live-ops';
import { ActionCard } from './ActionCard';
import styles from './LivePanels.module.css';

export const ActiveActionsList = ({ actions }: { actions: LiveAction[] }) => {
  const { t } = useI18n();

  return (
    <Card>
      <div className={styles.panel}>
        <h3>{t('live.actionsTitle')}</h3>
        {actions.length === 0 ? (
          <div className={styles.empty}>{t('live.noActions')}</div>
        ) : (
          <div className={styles.list}>
            {actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
