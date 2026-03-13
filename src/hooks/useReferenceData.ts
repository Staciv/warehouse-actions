import { useCallback, useEffect, useState } from 'react';
import { getRepository } from '../services/repositories';
import type { ActionType, Carrier } from '../types/domain';

export const useReferenceData = () => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const repository = getRepository();
    const [carrierRows, typeRows] = await Promise.all([repository.getCarriers(), repository.getActionTypes()]);
    setCarriers(carrierRows);
    setActionTypes(typeRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { carriers, actionTypes, loading, reload };
};
