import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRepository } from '../services/repositories';
import type { ActionTask, ActionTaskFilters } from '../types/domain';

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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить акции');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(initialFiltersRef.current);
  }, [filtersKey, load]);

  return { tasks, loading, error, reload: load, setTasks };
};
