import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../features/auth/AuthContext';
import { useI18n } from '../shared/i18n/I18nContext';
import styles from './page.module.css';

export const LoginPage = () => {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginValue.trim(), password);
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.page} ${styles.loginPage}`}>
      <Card>
        <form onSubmit={submit} className="stack">
          <div>
            <h1 className={styles.title}>{t('login.title')}</h1>
            <div className={styles.subtitle}>{t('login.subtitle')}</div>
          </div>

          <Field label={t('login.login')}>
            <Input
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field label={t('login.password')}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>

          {error ? <div style={{ color: '#c63d3d' }}>{error}</div> : null}
          <Button type="submit" disabled={loading}>
            {loading ? t('login.submitting') : t('login.submit')}
          </Button>

          <div className="kpi">{t('login.demo')}</div>
        </form>
      </Card>
    </div>
  );
};
