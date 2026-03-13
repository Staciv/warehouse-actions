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
import { createId } from '../shared/utils/id';
import type { User } from '../types/domain';
import styles from './page.module.css';

export const WorkersPage = () => {
  const { user } = useAuth();
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
    const rows = await getRepository().getUsers();
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

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
      setError(err instanceof Error ? err.message : 'Не удалось создать сотрудника');
    }
  };

  const toggleActive = async (target: User) => {
    if (target.id === user.id && target.isActive) {
      setError('Нельзя деактивировать текущего пользователя');
      return;
    }
    await getRepository().updateUser(target.id, { isActive: !target.isActive }, user);
    await load();
  };

  const resetPassword = async (target: User) => {
    const next = window.prompt(`Новый пароль для ${target.displayName}`, 'worker123');
    if (!next) return;
    await getRepository().updateUser(target.id, { password: next }, user);
    await load();
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Сотрудники</h1>

      <Card>
        <form onSubmit={submit} className="formGrid">
          <Field label="Имя">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Field>
          <Field label="Фамилия">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
          <Field label="Логин">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} required />
          </Field>
          <Field label="Пароль">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Роль">
            <Select value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
              <option value="worker">Работник</option>
              <option value="admin">Администратор</option>
              {canManageSuperadmin ? <option value="superadmin">Главный админ</option> : null}
            </Select>
          </Field>
          <Button type="submit">Создать сотрудника</Button>
        </form>
        {error ? <div style={{ color: '#c63d3d', marginTop: 8 }}>{error}</div> : null}
      </Card>

      <Card>
        {loading ? <Loader /> : null}
        {!loading ? (
          <Table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Занятость</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName}</td>
                  <td>{row.login}</td>
                  <td>{row.role}</td>
                  <td>{row.isActive ? 'active' : 'inactive'}</td>
                  <td>{row.availabilityStatus === 'busy' ? 'В работе' : 'Доступен'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button variant="secondary" onClick={() => toggleActive(row)}>
                        {row.isActive ? 'Деактивировать' : 'Активировать'}
                      </Button>
                      <Button variant="secondary" onClick={() => resetPassword(row)}>
                        Сбросить пароль
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
