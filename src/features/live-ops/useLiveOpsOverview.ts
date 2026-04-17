import { useEffect, useState } from 'react';
import { getRepository } from '../../services/repositories';
import type { LiveAction, LiveWorker } from '../../types/live-ops';
import type { User } from '../../types/domain';
import { buildLiveActions, buildLiveWorkers } from './model';
import { subscribeDataSync } from '../../shared/utils/dataSync';

interface LiveOpsOverview {
  workers: LiveWorker[];
  actions: LiveAction[];
}

interface UseLiveOpsOptions {
  includeWorkers?: boolean;
}

export const useLiveOpsOverview = (actor: User | null, options?: UseLiveOpsOptions) => {
  const [data, setData] = useState<LiveOpsOverview>({ workers: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const includeWorkers = options?.includeWorkers ?? true;

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!actor) {
        setData({ workers: [], actions: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const repository = getRepository();
        const sessionsFromDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [tasks, users, sessions] = await Promise.all([
          repository.getActionTasks({ status: 'all' }),
          actor.role === 'worker' || !includeWorkers ? Promise.resolve([]) : repository.getUsers(actor),
          repository.getWorkSessions({ fromDate: sessionsFromDate })
        ]);

        if (!active) return;
        const actions = buildLiveActions(tasks, sessions);
        const workers = includeWorkers ? buildLiveWorkers(users, actions, sessions) : [];
        setData({ workers, actions });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Nie udało się załadować danych live');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const poll = window.setInterval(() => {
      void load();
    }, 15000);

    const unsubscribe = subscribeDataSync(['tasks', 'sessions', 'users'], () => {
      void load();
    });

    return () => {
      active = false;
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [actor, includeWorkers]);

  return { ...data, loading, error };
};
