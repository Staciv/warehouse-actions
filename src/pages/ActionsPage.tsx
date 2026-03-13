import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, Loader } from '../components/ui/States';
import { isAdminRole } from '../features/auth/guards';
import { ActionFilters } from '../features/actions/ActionFilters';
import { ActionTaskForm } from '../features/actions/ActionTaskForm';
import { ActionTaskTable } from '../features/actions/ActionTaskTable';
import { useAuth } from '../features/auth/AuthContext';
import { useReferenceData } from '../hooks/useReferenceData';
import { useTasks } from '../hooks/useTasks';
import { getRepository } from '../services/repositories';
import { useI18n } from '../shared/i18n/I18nContext';
import type { CreateActionTaskPayload } from '../services/repositories/types';
import { isTaskAvailableForWorkers } from '../entities/action-task';
import type { ActionTaskFilters } from '../types/domain';
import styles from './page.module.css';

const defaultFilters: ActionTaskFilters = {
  status: 'all',
  priority: 'all',
  carrierId: 'all',
  actionTypeId: 'all',
  onlyActive: 'all',
  vehicleQuery: ''
};

const taskStatuses: Array<Exclude<ActionTaskFilters['status'], 'all' | undefined>> = [
  'planned',
  'executing',
  'cancelled',
  'draft',
  'inactive',
  'active',
  'in_progress',
  'partial',
  'completed',
  'deferred',
  'archived'
];

export const ActionsPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const { carriers, actionTypes, loading: refsLoading, reload: reloadRefs } = useReferenceData();
  const initialFilters = useMemo<ActionTaskFilters>(() => {
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const onlyActiveParam = searchParams.get('onlyActive');
    const vehicleQueryParam = searchParams.get('vehicleQuery');

    const status = taskStatuses.includes(statusParam as Exclude<ActionTaskFilters['status'], 'all' | undefined>)
      ? (statusParam as Exclude<ActionTaskFilters['status'], 'all' | undefined>)
      : 'all';

    const priority = priorityParam && ['1', '2', '3', '4'].includes(priorityParam)
      ? (Number(priorityParam) as 1 | 2 | 3 | 4)
      : 'all';

    const onlyActive = onlyActiveParam === 'active' || onlyActiveParam === 'inactive' ? onlyActiveParam : 'all';

    return {
      ...defaultFilters,
      status,
      priority,
      onlyActive,
      vehicleQuery: vehicleQueryParam ?? ''
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<ActionTaskFilters>(initialFilters);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const { tasks, loading, error, reload } = useTasks(filters);
  const canManage = user ? isAdminRole(user.role) : false;

  const workerTasks = useMemo(() => tasks.filter((task) => isTaskAvailableForWorkers(task)), [tasks]);

  if (!user) return null;

  const createTask = async (payload: CreateActionTaskPayload) => {
    await getRepository().createActionTask(payload, user);
    await Promise.all([reload(filters), reloadRefs()]);
    setShowCreate(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{t('page.actions.title')}</h1>
          <div className={styles.subtitle}>{t('page.actions.subtitle')}</div>
        </div>
        {canManage ? (
          <Button variant="primary" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? t('page.actions.hideForm') : t('page.actions.create')}
          </Button>
        ) : null}
      </div>

      {showCreate && canManage ? (
        <ActionTaskForm
          mode="create"
          carriers={carriers}
          actionTypes={actionTypes}
          onSubmit={createTask}
          submitLabel={t('page.actions.create')}
        />
      ) : null}

      <ActionFilters filters={filters} carriers={carriers} actionTypes={actionTypes} onChange={setFilters} />

      <Card>
        {loading || refsLoading ? <Loader /> : null}
        {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
        {!loading && !refsLoading ? (
          (canManage ? tasks : workerTasks).length === 0 ? (
            <EmptyState text="Brak zadań dla bieżących filtrów" />
          ) : (
            <ActionTaskTable tasks={canManage ? tasks : workerTasks} />
          )
        ) : null}
      </Card>
    </div>
  );
};
