import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getToken, getRefreshToken, getStoredUser, setSession, clearSession, getMe, login as apiLogin, register as apiRegister, googleLogin as apiGoogleLogin } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Validate an existing token on mount.
  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setLoading(false);
      return undefined;
    }
    getMe().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setUser(res.user);
        setSession(getToken(), res.user, getRefreshToken());
      } else {
        clearSession();
        setUser(null);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(email, password) {
        const res = await apiLogin(email, password);
        if (res.ok) setUser(res.user);
        return res;
      },
      async register(name, email, password) {
        const res = await apiRegister(name, email, password);
        if (res.ok) setUser(res.user);
        return res;
      },
      async loginWithGoogle(credential) {
        const res = await apiGoogleLogin(credential);
        if (res.ok) setUser(res.user);
        return res;
      },
      logout() {
        clearSession();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}