import { createContext, useContext, useState, useEffect } from 'react';
import { getStoredToken, getStoredUser, logout as authLogout } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());

  useEffect(() => {
    setUser(getStoredUser());
    setToken(getStoredToken());
  }, [token]);

  const loginSuccess = (userData, tokenValue) => {
    setUser(userData);
    setToken(tokenValue);
  };

  const logout = () => {
    authLogout();
    setUser(null);
    setToken(null);
  };

  const isAuthenticated = !!token;
  const isAdmin = isAuthenticated && String(user?.role || '').toLowerCase() === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isAdmin, loginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
