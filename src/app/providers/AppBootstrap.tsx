import { useEffect, useState } from 'react';
import { getRepository } from '../../services/repositories';
import { Loader } from '../../components/ui/States';

export const AppBootstrap = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        await getRepository().seedIfEmpty();
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка bootstrap');
      }
    };

    void run();
  }, []);

  if (error) return <div style={{ color: '#c63d3d', padding: 20 }}>{error}</div>;
  if (!ready) return <Loader text="Инициализация данных..." />;

  return <>{children}</>;
};
