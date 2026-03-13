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
import { useI18n } from '../shared/i18n/I18nContext';
import { createId } from '../shared/utils/id';
import type { ActionType } from '../types/domain';
import styles from './page.module.css';

export const ActionTypesPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
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
      <h1 className={styles.title}>{t('page.actionTypes.title')}</h1>
      <Card>
        <form onSubmit={addType} className="stack">
          <div className="formGrid">
            <Field label="Klucz">
              <Input value={key} onChange={(e) => setKey(e.target.value)} required />
            </Field>
            <Field label="Nazwa">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          </div>
          <Field label="Opis">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} required />
          </Field>
          <Button type="submit">Dodaj typ</Button>
        </form>
      </Card>

      <Card>
        {loading ? <Loader /> : null}
        {!loading ? (
          <Table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Klucz</th>
                <th>Opis</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id}>
                  <td data-label="Nazwa">
                    <span className="truncateText">{type.name}</span>
                  </td>
                  <td data-label="Klucz">
                    <span className="truncateText">{type.key}</span>
                  </td>
                  <td data-label="Opis">{type.description}</td>
                  <td data-label="Status">{type.isActive ? 'active' : 'archived'}</td>
                  <td data-label="Akcje">
                    <Button variant="secondary" onClick={() => toggleType(type)}>
                      {type.isActive ? 'Archiwizuj' : 'Przywróć'}
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
