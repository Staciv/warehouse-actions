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
import { createId } from '../shared/utils/id';
import type { Carrier } from '../types/domain';
import styles from './page.module.css';

export const CarriersPage = () => {
  const { user } = useAuth();
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
      setError(err instanceof Error ? err.message : 'Не удалось добавить перевозчика');
    }
  };

  const deleteCarrier = async (carrier: Carrier) => {
    setError('');
    const confirmed = window.confirm(`Удалить перевозчика "${carrier.name}"?`);
    if (!confirmed) return;
    try {
      await getRepository().deleteCarrier(carrier.id, user);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить перевозчика');
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
      setError(err instanceof Error ? err.message : 'Не удалось добавить стандартных перевозчиков');
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Перевозчики</h1>
      <Card>
        <form onSubmit={addCarrier} className="formGrid">
          <Field label="Название">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Код">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit">Добавить</Button>
        </form>
        <div style={{ marginTop: 10 }}>
          <Button type="button" variant="secondary" onClick={importStandardCarriers}>
            Добавить стандартный список
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
                <th>Название</th>
                <th>Код</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((carrier) => (
                <tr key={carrier.id}>
                  <td>{carrier.name}</td>
                  <td>{carrier.code || '—'}</td>
                  <td>
                    <Button variant="danger" onClick={() => deleteCarrier(carrier)}>
                      Удалить
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
