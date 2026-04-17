import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';
import { Table } from '../../components/ui/Table';
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
        <Table>
          <thead>
            <tr>
              <th>Numer pojazdu</th>
              <th>Przewoźnik</th>
              <th>Priorytet</th>
              <th>Status</th>
              <th>Pozostało</th>
            </tr>
          </thead>
          <tbody>
            {urgent.map((task) => (
              <tr key={task.id}>
                <td data-label="Numer pojazdu">
                  <Link to={`/actions/${task.id}`}>{task.vehicleCode}</Link>
                </td>
                <td data-label="Przewoźnik">{task.carrierName}</td>
                <td data-label="Priorytet">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td data-label="Status">
                  <StatusBadge status={task.status} />
                </td>
                <td data-label="Pozostało">{task.remainingPallets}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
};
