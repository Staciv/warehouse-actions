import { AppBootstrap } from './app/providers/AppBootstrap';
import { AppRouter } from './app/AppRouter';
import { AuthProvider } from './features/auth/AuthContext';
import { I18nProvider } from './shared/i18n/I18nContext';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppBootstrap>
          <AppRouter />
        </AppBootstrap>
      </AuthProvider>
    </I18nProvider>
  );
}
