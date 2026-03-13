import { AppBootstrap } from './app/providers/AppBootstrap';
import { AppRouter } from './app/AppRouter';
import { AuthProvider } from './features/auth/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <AppBootstrap>
        <AppRouter />
      </AppBootstrap>
    </AuthProvider>
  );
}
