import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';
import { PriorityBadge, StatusBadge } from './badges';
import type { ActionTask } from '../../types/domain';
import { Link } from 'react-router-dom';

export const AttentionList = ({ tasks }: { tasks: ActionTask[] }) => {
  const urgent = tasks.filter((task) => task.priority === 4 || task.status === 'executing').slice(0, 6);

  return (
    <Card>
      <h3 style={{ marginBottom: 10 }}>Wymagają uwagi</h3>
      {urgent.length === 0 ? (
        <EmptyState text="Brak krytycznych akcji" />
      ) : (
        <div className="stack">
          {urgent.map((task) => (
            <div key={task.id} style={{ borderBottom: '1px solid #e5ebf3', paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link to={`/actions/${task.id}`}>{task.vehicleCode}</Link>
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
              </div>
              <div className="kpi">{task.carrierName} · pozostało {task.remainingPallets}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
