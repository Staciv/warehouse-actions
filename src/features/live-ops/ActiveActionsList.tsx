import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { useI18n } from '../../shared/i18n/I18nContext';
import type { LiveAction } from '../../types/live-ops';
import styles from './LivePanels.module.css';

export const ActiveActionsList = ({ actions }: { actions: LiveAction[] }) => {
  const { t } = useI18n();
  const statusLabel: Record<LiveAction['status'], string> = {
    planned: t('live.action.planned'),
    in_progress: t('live.action.in_progress'),
    completed: t('live.action.completed')
  };

  return (
    <Card>
      <div className={styles.panel}>
        <h3>{t('live.actionsTitle')}</h3>
        {actions.length === 0 ? (
          <div className={styles.empty}>{t('live.noActions')}</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Typ akcji</th>
                <th>{t('live.vehicle')}</th>
                <th>{t('live.carrier')}</th>
                <th>Razem</th>
                <th>{t('live.progress.completed')}</th>
                <th>{t('live.progress.remaining')}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td data-label="Typ akcji">{action.actionType}</td>
                  <td data-label={t('live.vehicle')}>{action.truckId}</td>
                  <td data-label={t('live.carrier')}>{action.carrier}</td>
                  <td data-label="Razem">{action.totalPallets}</td>
                  <td data-label={t('live.progress.completed')}>{action.completedPallets}</td>
                  <td data-label={t('live.progress.remaining')}>{action.remainingPallets}</td>
                  <td data-label="Status">{statusLabel[action.status]}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Card>
  );
};
