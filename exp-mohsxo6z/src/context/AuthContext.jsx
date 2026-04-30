// Auto-generado por PyZero Generator — Auth Context
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pyzero_token');
    if (token) {
      api.get('/auth/me')
        .then(data => setUser(data))
        .catch(() => localStorage.removeItem('pyzero_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('pyzero_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('pyzero_token');
    setUser(null);
    window.location.href = '/';
  };

  const register = async (userData) => {
    const data = await api.post('/auth/register', userData);
    localStorage.setItem('pyzero_token', data.token);
    setUser(data.user);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
