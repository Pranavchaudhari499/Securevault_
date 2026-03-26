import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sv_token');
    const cachedUser = localStorage.getItem('sv_user');

    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        if (parsed) setUser(parsed);
      } catch (e) {
        localStorage.removeItem('sv_user');
      }
    }

    if (token) {
      authAPI.getMe().then(data => {
        setUser(data.user);
        localStorage.setItem('sv_user', JSON.stringify(data.user));
        connectSocket(data.user._id, data.user.role);
      }).catch((error) => {
        const msg = (error && error.message ? error.message : '').toLowerCase();
        const unauthorized = msg.includes('not authorized') || msg.includes('token invalid') || msg.includes('expired');

        if (unauthorized) {
          localStorage.removeItem('sv_token');
          localStorage.removeItem('sv_user');
          setUser(null);
        }
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login({ email, password });
    localStorage.setItem('sv_token', data.token);
    localStorage.setItem('sv_user', JSON.stringify(data.user));
    setUser(data.user);
    connectSocket(data.user.id, data.user.role);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('sv_token');
    localStorage.removeItem('sv_user');
    disconnectSocket();
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('sv_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
