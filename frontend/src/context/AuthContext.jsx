import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext();

// The session lives in an httpOnly cookie set by the server, so nothing
// sensitive is kept in localStorage. "Logged in" means /auth/me succeeds.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Remove tokens left behind by older versions that used localStorage
    localStorage.removeItem('vestor_token');
    localStorage.removeItem('vestor_user');

    api.getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.loginUser({ email, password });
    setUser(response.user);
    return response;
  }, []);

  // Sign-up doesn't log in: the user must verify their email first.
  const register = useCallback(async (name, email, password) => {
    return api.registerUser({ name, email, password });
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const response = await api.googleAuth({ credential });
    setUser(response.user);
    return response;
  }, []);

  // Called after the email verification link signs the user in
  const setSessionUser = useCallback((u) => setUser(u), []);

  const logout = useCallback(async () => {
    try {
      await api.logoutUser();
    } catch {
      // Clear local state even if the server is unreachable
    }
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
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
