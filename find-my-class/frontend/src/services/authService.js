import api from './api.js';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
};

export const register = async (name, email, password, role) => {
  const { data } = await api.post('/auth/register', { name, email, password, role });
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
};

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
