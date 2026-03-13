import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Loader } from '../components/ui/States';
import { Table } from '../components/ui/Table';
import { useAuth } from '../features/auth/AuthContext';
import { isSuperAdmin } from '../features/auth/guards';
import { getRepository } from '../services/repositories';
import { useI18n } from '../shared/i18n/I18nContext';
import { createId } from '../shared/utils/id';
import type { User } from '../types/domain';
import styles from './page.module.css';

export const WorkersPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<User['role']>('worker');
  const [error, setError] = useState('');
  const canManageSuperadmin = user ? isSuperAdmin(user.role) : false;

  const load = async () => {
    if (!user) return;
    const rows = await getRepository().getUsers(user);
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  if (!user) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await getRepository().createUser(
        {
          firstName,
          lastName,
          login: login.trim() || `worker-${createId().slice(0, 4)}`,
          password,
          role,
          isActive: true
        },
        user
      );
      setFirstName('');
      setLastName('');
      setLogin('');
      setPassword('');
      setRole('worker');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć pracownika');
    }
  };

  const toggleActive = async (target: User) => {
    if (target.id === user.id && target.isActive) {
      setError('Nie można dezaktywować aktualnie zalogowanego użytkownika');
      return;
    }
    await getRepository().updateUser(target.id, { isActive: !target.isActive }, user);
    await load();
  };

  const resetPassword = async (target: User) => {
    const next = window.prompt(`Nowe hasło dla ${target.displayName}`, 'worker123');
    if (!next) return;
    await getRepository().updateUser(target.id, { password: next }, user);
    await load();
  };

  const workerAvailabilityLabel = (status: User['availabilityStatus']) => {
    if (status === 'in_action' || status === 'busy') return 'W pracy';
    if (status === 'paused') return 'Pauza';
    if (status === 'offline') return 'Offline';
    if (status === 'completed') return 'Zakończył';
    return 'Dostępny';
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('page.workers.title')}</h1>

      <Card>
        <form onSubmit={submit} className="formGrid">
          <Field label="Imię">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Field>
          <Field label="Nazwisko">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
          <Field label="Login">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} required />
          </Field>
          <Field label="Hasło">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Rola">
            <Select value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
              <option value="worker">Pracownik</option>
              <option value="admin">Administrator</option>
              {canManageSuperadmin ? <option value="superadmin">Superadministrator</option> : null}
            </Select>
          </Field>
          <Button type="submit">Utwórz pracownika</Button>
        </form>
        {error ? <div style={{ color: '#c63d3d', marginTop: 8 }}>{error}</div> : null}
      </Card>

      <Card>
        {loading ? <Loader /> : null}
        {!loading ? (
          <Table>
            <thead>
              <tr>
                <th>Pracownik</th>
                <th>Login</th>
                <th>Rola</th>
                <th>Status</th>
                <th>Dostępność</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td data-label="Pracownik">
                    <span className="truncateText">{row.displayName}</span>
                  </td>
                  <td data-label="Login">
                    <span className="truncateText">{row.login}</span>
                  </td>
                  <td data-label="Rola">{row.role}</td>
                  <td data-label="Status">{row.isActive ? 'active' : 'inactive'}</td>
                  <td data-label="Dostępność">{workerAvailabilityLabel(row.availabilityStatus)}</td>
                  <td data-label="Akcje">
                    <div className="inlineActions">
                      <Button variant="secondary" onClick={() => toggleActive(row)}>
                        {row.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                      </Button>
                      <Button variant="secondary" onClick={() => resetPassword(row)}>
                        Zresetuj hasło
                      </Button>
                    </div>
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
