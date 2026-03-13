import { useCallback, useState } from 'react';

export const useAsync = <T,>(fn: () => Promise<T>, immediate = true) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fn();
      setData(response);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nieznany błąd';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { data, loading, error, execute, setData };
};
