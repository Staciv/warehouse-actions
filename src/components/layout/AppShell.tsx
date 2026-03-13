import { NavLink, Outlet } from 'react-router-dom';
import { APP_TITLE } from '../../constants/app';
import { useAuth } from '../../features/auth/AuthContext';
import { isAdminRole } from '../../features/auth/guards';
import { useI18n } from '../../shared/i18n/I18nContext';
import { Button } from '../ui/Button';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import styles from './layout.module.css';

export const AppShell = () => {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  if (!user) return null;
  const adminLinks = [
    { to: '/', label: t('nav.dashboard') },
    { to: '/actions', label: t('nav.actions') },
    { to: '/completed', label: t('nav.completed') },
    { to: '/vehicles', label: t('nav.vehicles') },
    { to: '/workers', label: t('nav.workers') },
    { to: '/carriers', label: t('nav.carriers') },
    { to: '/action-types', label: t('nav.actionTypes') },
    { to: '/reports', label: t('nav.reports') }
  ];
  const workerLinks = [
    { to: '/', label: t('nav.myTasks') },
    { to: '/worker-completed', label: t('nav.workerCompleted') }
  ];

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
            <div className={styles.langControl}>
              <LanguageSwitcher />
            </div>
            <Button variant="secondary" onClick={logout}>
              {t('nav.logout')}
            </Button>
          </div>
          <div className={styles.mobileLang}>
            <LanguageSwitcher />
          </div>
          <Button variant="secondary" onClick={logout} className={styles.mobileLogout}>
            {t('nav.logout')}
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
            <div className={styles.pageTitle}>{user.role === 'superadmin' ? t('role.superadmin') : t('role.admin')}</div>
            <div className={styles.userMeta}>{user.displayName}</div>
          </div>
          <div className={styles.topControls}>
            <div className={styles.langControl}>
              <LanguageSwitcher />
            </div>
            <Button variant="secondary" onClick={logout}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>
        <header className={styles.mobileTop}>
          <div>
            <div className={styles.pageTitle}>{user.role === 'superadmin' ? t('role.superadmin') : t('role.admin')}</div>
            <div className={styles.userMeta}>{user.displayName}</div>
          </div>
          <div className={styles.mobileLang}>
            <LanguageSwitcher />
          </div>
          <Button variant="secondary" onClick={logout} className={styles.mobileLogout}>
            {t('nav.logout')}
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
