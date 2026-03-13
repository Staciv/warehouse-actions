import { useNavigate } from 'react-router-dom';
import { Table } from '../../components/ui/Table';
import { formatDate } from '../../shared/utils/date';
import type { ActionTask } from '../../types/domain';
import { PriorityBadge, StatusBadge } from './badges';
import styles from './ActionTaskTable.module.css';

interface Props {
  tasks: ActionTask[];
  rowClickable?: boolean;
}

export const ActionTaskTable = ({ tasks, rowClickable = false }: Props) => {
  const navigate = useNavigate();

  const openTask = (taskId: string) => {
    navigate(`/actions/${taskId}`);
  };

  return (
    <Table>
      <thead>
        <tr>
          <th>Pojazd</th>
          <th>Przewoźnik</th>
          <th>Typ akcji</th>
          <th>Data</th>
          <th>Priorytet</th>
          <th>Status</th>
          <th>Wykonuje teraz</th>
          <th>Palety</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr
            key={task.id}
            className={rowClickable ? styles.clickableRow : undefined}
            onClick={rowClickable ? () => openTask(task.id) : undefined}
            onKeyDown={rowClickable ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openTask(task.id);
              }
            } : undefined}
            tabIndex={rowClickable ? 0 : undefined}
            role={rowClickable ? 'button' : undefined}
            aria-label={rowClickable ? `Otwórz akcję ${task.vehicleCode}` : undefined}
          >
            <td data-label="Pojazd">
              <span className={styles.truncate}>{task.vehicleCode}</span>
            </td>
            <td data-label="Przewoźnik">
              <span className={styles.truncate}>{task.carrierName}</span>
            </td>
            <td data-label="Typ akcji">
              <span className={styles.truncate}>{task.actionTypeName}</span>
            </td>
            <td data-label="Data">
              <div className={styles.centerCell}>{formatDate(task.arrivalDate)}</div>
            </td>
            <td data-label="Priorytet">
              <div className={styles.centerCell}>
                <PriorityBadge priority={task.priority} />
              </div>
            </td>
            <td data-label="Status">
              <div className={styles.centerCell}>
                <StatusBadge status={task.status} />
              </div>
            </td>
            <td data-label="Wykonuje teraz">
              <span className={styles.truncate}>
                {task.participantWorkerNames.length > 0 ? task.participantWorkerNames.join(', ') : '—'}
              </span>
            </td>
            <td data-label="Palety">
              {task.completedPallets}/{task.totalPallets ?? '—'} (pozostało: {task.remainingPallets})
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
