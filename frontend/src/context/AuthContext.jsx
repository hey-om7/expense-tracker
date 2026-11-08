import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext();

// The session lives in an httpOnly cookie set by the server, so nothing
// sensitive is kept in localStorage. "Logged in" means /auth/me succeeds.
// Non-sensitive flag ("1") meaning this browser had a session last time. It only
// decides what to show while /auth/me is in flight (PIN screen vs. skeleton);
// the server cookie stays the source of truth.
const HINT_KEY = 'vestor_session_hint';
const readHint = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
const writeHint = (on) => {
  try { if (on) localStorage.setItem(HINT_KEY, '1'); else localStorage.removeItem(HINT_KEY); } catch { /* storage blocked */ }
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionHint] = useState(readHint);
  const setUser = useCallback((u) => { setUserState(u); writeHint(!!u); }, []);

  useEffect(() => {
    // Remove tokens left behind by older versions that used localStorage
    localStorage.removeItem('vestor_token');
    localStorage.removeItem('vestor_user');

    api.getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(async (email, password) => {
    const response = await api.loginUser({ email, password });
    setUser(response.user);
    return response;
  }, [setUser]);

  // Sign-up doesn't log in: the user must verify their email first.
  const register = useCallback(async (name, email, password, termsAccepted = false) => {
    return api.registerUser({ name, email, password, termsAccepted });
  }, []);

  // termsAccepted is only needed when this Google sign-in creates a new account.
  const googleLogin = useCallback(async (credential, { termsAccepted = false } = {}) => {
    const response = await api.googleAuth({ credential, termsAccepted });
    setUser(response.user);
    return response;
  }, [setUser]);

  // Called after the email verification link signs the user in
  const setSessionUser = useCallback((u) => setUser(u), [setUser]);

  const logout = useCallback(async () => {
    try {
      await api.logoutUser();
    } catch {
      // Clear local state even if the server is unreachable
    }
    setUser(null);
  }, [setUser]);

  const isAuthenticated = !!user;
  // True while the session check runs for a browser that was signed in before.
  const likelyAuthenticated = isAuthenticated || (loading && sessionHint);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      likelyAuthenticated,
      login,
      register,
      googleLogin,
      setSessionUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
