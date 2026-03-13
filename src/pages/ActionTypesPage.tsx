import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { TextArea } from '../components/ui/TextArea';
import { Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { useAuth } from '../features/auth/AuthContext';
import { getRepository } from '../services/repositories';
import { createId } from '../shared/utils/id';
import type { ActionType } from '../types/domain';
import styles from './page.module.css';

export const ActionTypesPage = () => {
  const { user } = useAuth();
  const [types, setTypes] = useState<ActionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    setLoading(true);
    setTypes(await getRepository().getActionTypes());
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (!user) return null;

  const addType = async (event: React.FormEvent) => {
    event.preventDefault();
    await getRepository().upsertActionType(
      {
        id: createId(),
        key,
        name,
        description,
        isActive: true
      },
      user
    );
    setName('');
    setKey('');
    setDescription('');
    await load();
  };

  const toggleType = async (type: ActionType) => {
    await getRepository().upsertActionType({ ...type, isActive: !type.isActive }, user);
    await load();
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Типы акций</h1>
      <Card>
        <form onSubmit={addType} className="stack">
          <div className="formGrid">
            <Field label="Ключ">
              <Input value={key} onChange={(e) => setKey(e.target.value)} required />
            </Field>
            <Field label="Название">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>
          <Field label="Описание">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} required />
          </Field>
          <Button type="submit">Добавить тип</Button>
        </form>
      </Card>

      <Card>
        {loading ? <Loader /> : null}
        {!loading ? (
          <Table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Ключ</th>
                <th>Описание</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  <td data-label="Название">
                    <span className="truncateText">{type.name}</span>
                  </td>
                  <td data-label="Ключ">
                    <span className="truncateText">{type.key}</span>
                  </td>
                  <td data-label="Описание">{type.description}</td>
                  <td data-label="Статус">{type.isActive ? 'active' : 'archived'}</td>
                  <td data-label="Действия">
                    <Button variant="secondary" onClick={() => toggleType(type)}>
                      {type.isActive ? 'Архивировать' : 'Восстановить'}
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
