import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRepository } from '../services/repositories';
import type { ActionTask, ActionTaskFilters } from '../types/domain';
import { subscribeDataSync } from '../shared/utils/dataSync';

export const useTasks = (initialFilters?: ActionTaskFilters) => {
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(initialFilters ?? {}), [initialFilters]);
  const initialFiltersRef = useRef<ActionTaskFilters | undefined>(initialFilters);

  useEffect(() => {
    initialFiltersRef.current = initialFilters;
  }, [filtersKey, initialFilters]);

  const load = useCallback(async (filters?: ActionTaskFilters) => {
    setLoading(true);
    setError(null);
    try {
      const repository = getRepository();
      const rows = await repository.getActionTasks(filters ?? initialFiltersRef.current);
      setTasks(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się załadować akcji');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(initialFiltersRef.current);
  }, [filtersKey, load]);

  useEffect(() => {
    return subscribeDataSync(['tasks', 'sessions'], () => {
      void load(initialFiltersRef.current);
    });
  }, [load]);

  return { tasks, loading, error, reload: load, setTasks };
};
