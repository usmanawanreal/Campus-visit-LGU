import api from './api.js';

export const getAll = (params) => api.get('/classrooms', { params });
export const getByRoomNumber = (roomNumber) =>
  api.get(`/classrooms/${encodeURIComponent(roomNumber)}`);
export const create = (data) => api.post('/classrooms', data);
export const remove = (id) => api.delete(`/classrooms/${id}`);

export const search = (q) => api.get('/search/classrooms', { params: { q } });
