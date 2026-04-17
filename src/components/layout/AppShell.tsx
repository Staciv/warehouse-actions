import { NavLink, Outlet } from 'react-router-dom';
import { APP_TITLE } from '../../constants/app';
import { ROUTES } from '../../constants/routes';
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
    { to: ROUTES.dashboard, label: t('nav.dashboard') },
    { to: ROUTES.actions, label: t('nav.actions') },
    { to: ROUTES.completed, label: t('nav.completed') },
    { to: ROUTES.adminWorkCards, label: t('nav.workCards', 'Karty pracy') },
    { to: ROUTES.vehicles, label: t('nav.vehicles') },
    { to: ROUTES.workers, label: t('nav.workers') },
    { to: ROUTES.problems, label: t('nav.problems') },
    { to: ROUTES.carriers, label: t('nav.carriers') },
    { to: ROUTES.actionTypes, label: t('nav.actionTypes') },
    { to: ROUTES.reports, label: t('nav.reports') }
  ];
  const workerLinks = [
    { to: ROUTES.dashboard, label: t('nav.myTasks') },
    { to: ROUTES.workerWorkCard, label: t('nav.myWorkCard', 'Moja karta pracy') },
    { to: ROUTES.workerCompleted, label: t('nav.workerCompleted') },
    { to: ROUTES.workerReportProblem, label: t('nav.reportProblem') }
  ];

  const isRootRoute = (to: string) => to === ROUTES.dashboard;

  if (!isAdminRole(user.role)) {
    return (
      <div className={styles.workerShell}>
        <header className={styles.workerTop}>
          <NavLink to={ROUTES.dashboard} end className={styles.brandLink}>
            <strong className={styles.appTitle}>{APP_TITLE}</strong>
          </NavLink>
          <div className={styles.workerNav}>
            {workerLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={isRootRoute(link.to)}
                className={({ isActive }) => (isActive ? styles.workerLinkActive : styles.workerLink)}
              >
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
      <header className={styles.desktopHeader}>
        <div className={styles.desktopBrand}>
          <NavLink to={ROUTES.dashboard} end className={styles.brandLink}>
            <div className={styles.brand}>{APP_TITLE}</div>
          </NavLink>
          <div className={styles.userMeta}>{user.displayName}</div>
        </div>
        <nav className={styles.desktopNav}>
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={isRootRoute(link.to)}
              className={({ isActive }) => (isActive ? styles.desktopNavActive : styles.desktopNavLink)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.topControls}>
          <div className={styles.langControl}>
            <LanguageSwitcher />
          </div>
          <Button variant="secondary" onClick={logout}>
            {t('nav.logout')}
          </Button>
        </div>
      </header>
      <main className={styles.main}>
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
