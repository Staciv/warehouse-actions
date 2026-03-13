import { NavLink, Outlet } from 'react-router-dom';
import { APP_TITLE } from '../../constants/app';
import { useAuth } from '../../features/auth/AuthContext';
import { isAdminRole } from '../../features/auth/guards';
import { Button } from '../ui/Button';
import styles from './layout.module.css';

const adminLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/actions', label: 'Акции' },
  { to: '/completed', label: 'Сделанные' },
  { to: '/vehicles', label: 'Машины' },
  { to: '/workers', label: 'Сотрудники' },
  { to: '/carriers', label: 'Перевозчики' },
  { to: '/action-types', label: 'Типы акций' },
  { to: '/reports', label: 'Отчёты' }
];

const workerLinks = [
  { to: '/', label: 'Мои задачи' },
  { to: '/worker-completed', label: 'Выполненные' }
];

export const AppShell = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  if (!isAdminRole(user.role)) {
    return (
      <div className={styles.workerShell}>
        <header className={styles.workerTop}>
          <strong className={styles.appTitle}>{APP_TITLE}</strong>
          <div className={styles.workerNav}>
            {workerLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? styles.workerLinkActive : styles.workerLink)}>
                {link.label}
              </NavLink>
            ))}
            <Button variant="secondary" onClick={logout}>
              Выйти
            </Button>
          </div>
          <Button variant="secondary" onClick={logout} className={styles.mobileLogout}>
            Выйти
          </Button>
        </header>
        <main className={styles.workerMain}>
          <Outlet />
        </main>
        <nav className={`${styles.mobileBottomNav} ${styles.mobileBottomNavWorker}`}>
          {workerLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? styles.mobileNavActive : styles.mobileNavLink)}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>{APP_TITLE}</div>
        <nav className={styles.nav}>
          {adminLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        <div className={styles.top}>
          <div>
            <div className={styles.pageTitle}>{user.role === 'superadmin' ? 'Главный админ' : 'Администратор'}</div>
            <div className={styles.userMeta}>{user.displayName}</div>
          </div>
          <Button variant="secondary" onClick={logout}>
            Выйти
          </Button>
        </div>
        <header className={styles.mobileTop}>
          <div>
            <div className={styles.pageTitle}>{user.role === 'superadmin' ? 'Главный админ' : 'Администратор'}</div>
            <div className={styles.userMeta}>{user.displayName}</div>
          </div>
          <Button variant="secondary" onClick={logout} className={styles.mobileLogout}>
            Выйти
          </Button>
        </header>
        <Outlet />
      </main>
      <nav className={`${styles.mobileBottomNav} ${styles.mobileBottomNavAdmin}`}>
        {adminLinks.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? styles.mobileNavActive : styles.mobileNavLink)}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
