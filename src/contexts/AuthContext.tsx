import { createContext, useContext, useEffect, useState } from 'react';

interface AuthCtx {
  loading: boolean;
  authenticated: boolean;
  onLogin: () => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  loading: true,
  authenticated: false,
  onLogin: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => setAuthenticated(r.ok))
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  const onLogin = () => setAuthenticated(true);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
  };

  return (
    <Ctx.Provider value={{ loading, authenticated, onLogin, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
