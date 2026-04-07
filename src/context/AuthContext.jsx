import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('wallo_token'));
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('wallo_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const userData = await api.getMe();
        setUser(userData);
        setToken(storedToken);
      } catch (err) {
        console.warn('Token validation failed:', err.message);
        localStorage.removeItem('wallo_token');
        localStorage.removeItem('wallo_user');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.loginUser({ email, password });
    localStorage.setItem('wallo_token', response.token);
    localStorage.setItem('wallo_user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    return response;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const response = await api.registerUser({ name, email, password });
    localStorage.setItem('wallo_token', response.token);
    localStorage.setItem('wallo_user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    return response;
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const response = await api.googleAuth({ credential });
    localStorage.setItem('wallo_token', response.token);
    localStorage.setItem('wallo_user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    return response;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wallo_token');
    localStorage.removeItem('wallo_user');
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated,
      login,
      register,
      googleLogin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
