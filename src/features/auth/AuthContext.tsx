import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SESSION_STORAGE_KEY } from '../../constants/app';
import type { AuthSession, User } from '../../types/domain';
import { getRepository } from '../../services/repositories';
import { toIsoNow } from '../../shared/utils/date';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseSession = (): AuthSession | null => {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession> & { user?: User };
    if (parsed.userId && parsed.loginAt) {
      return { userId: parsed.userId, loginAt: parsed.loginAt };
    }
    // Legacy migration path: previous session format had full user object.
    if (parsed.user?.id && parsed.loginAt) {
      return { userId: parsed.user.id, loginAt: parsed.loginAt };
    }
    return null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      const session = parseSession();
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const repository = getRepository();
        const freshUser = await repository.getUserById(session.userId);
        if (!freshUser || !freshUser.isActive) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setUser(null);
        } else {
          setUser(freshUser);
        }
      } finally {
        setLoading(false);
      }
    };

    void hydrate();
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    const repository = getRepository();
    const signedInUser = await repository.login({ login: loginValue, password });
    const session: AuthSession = {
      userId: signedInUser.id,
      loginAt: toIsoNow()
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    setUser(signedInUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = parseSession();
    if (!session?.userId) return;

    const repository = getRepository();
    const freshUser = await repository.getUserById(session.userId);
    if (!freshUser || !freshUser.isActive) {
      logout();
      return;
    }

    const nextSession: AuthSession = {
      userId: freshUser.id,
      loginAt: session.loginAt
    };

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setUser(freshUser);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser
    }),
    [loading, login, logout, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
