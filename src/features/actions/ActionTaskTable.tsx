import { Link } from 'react-router-dom';
import { Table } from '../../components/ui/Table';
import { formatDate } from '../../shared/utils/date';
import type { ActionTask } from '../../types/domain';
import { PriorityBadge, StatusBadge } from './badges';
import styles from './ActionTaskTable.module.css';

interface Props {
  tasks: ActionTask[];
}

export const ActionTaskTable = ({ tasks }: Props) => {
  return (
    <Table>
      <thead>
        <tr>
          <th>Машина</th>
          <th>Перевозчик</th>
          <th>Тип акции</th>
          <th>Дата</th>
          <th>Приоритет</th>
          <th>Статус</th>
          <th>Сейчас выполняет</th>
          <th>Палеты</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td data-label="Машина">
              <Link to={`/actions/${task.id}`} className={styles.truncate}>
                {task.vehicleCode}
              </Link>
            </td>
            <td data-label="Перевозчик">
              <span className={styles.truncate}>{task.carrierName}</span>
            </td>
            <td data-label="Тип акции">
              <span className={styles.truncate}>{task.actionTypeName}</span>
            </td>
            <td data-label="Дата">
              <div className={styles.centerCell}>{formatDate(task.arrivalDate)}</div>
            </td>
            <td data-label="Приоритет">
              <div className={styles.centerCell}>
                <PriorityBadge priority={task.priority} />
              </div>
            </td>
            <td data-label="Статус">
              <div className={styles.centerCell}>
                <StatusBadge status={task.status} />
              </div>
            </td>
            <td data-label="Сейчас выполняет">
              <span className={styles.truncate}>
                {task.participantWorkerNames.length > 0 ? task.participantWorkerNames.join(', ') : '—'}
              </span>
            </td>
            <td data-label="Палеты">
              {task.completedPallets}/{task.totalPallets ?? '—'} (остаток: {task.remainingPallets})
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
