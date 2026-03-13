import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { useAuth } from '../features/auth/AuthContext';
import { getRepository } from '../services/repositories';
import { seedCarriers } from '../services/seed/seedData';
import { useI18n } from '../shared/i18n/I18nContext';
import { createId } from '../shared/utils/id';
import type { Carrier } from '../types/domain';
import styles from './page.module.css';

export const CarriersPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const rows = await getRepository().getCarriers();
    setCarriers(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (!user) return null;

  const addCarrier = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await getRepository().upsertCarrier(
        {
          id: createId(),
          name,
          code,
          isActive: true
        },
        user
      );
      setName('');
      setCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać przewoźnika');
    }
  };

  const deleteCarrier = async (carrier: Carrier) => {
    setError('');
    const confirmed = window.confirm(`Usunąć przewoźnika "${carrier.name}"?`);
    if (!confirmed) return;
    try {
      await getRepository().deleteCarrier(carrier.id, user);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć przewoźnika');
    }
  };

  const importStandardCarriers = async () => {
    setError('');
    try {
      const repository = getRepository();
      const existing = await repository.getCarriers();
      const existingNames = new Set(existing.map((carrier) => carrier.name.trim().toLowerCase()));

      const missing = seedCarriers.filter((carrier) => !existingNames.has(carrier.name.trim().toLowerCase()));
      for (const carrier of missing) {
        await repository.upsertCarrier(
          {
            id: createId(),
            name: carrier.name,
            code: carrier.code,
            isActive: true
          },
          user
        );
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać standardowych przewoźników');
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('page.carriers.title')}</h1>
      <Card>
        <form onSubmit={addCarrier} className="formGrid">
          <Field label="Nazwa">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Kod">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit">Dodaj</Button>
        </form>
        <div style={{ marginTop: 10 }}>
          <Button type="button" variant="secondary" onClick={importStandardCarriers}>
            Dodaj standardową listę
          </Button>
        </div>
        {error ? <div style={{ color: '#c63d3d', marginTop: 8 }}>{error}</div> : null}
      </Card>

      <Card>
        {loading ? <Loader /> : null}
        {!loading ? (
          <Table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Kod</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((carrier) => (
                <tr key={carrier.id}>
                  <td data-label="Nazwa">
                    <span className="truncateText">{carrier.name}</span>
                  </td>
                  <td data-label="Kod">
                    <span className="truncateText">{carrier.code || '—'}</span>
                  </td>
                  <td data-label="Akcje">
                    <Button variant="danger" onClick={() => deleteCarrier(carrier)}>
                      Usuń
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>
    </div>
  );
};
