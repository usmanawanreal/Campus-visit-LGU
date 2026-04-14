import api from './api.js';

export const getAll = (params) => api.get('/edges', { params });
export const getById = (id) => api.get(`/edges/${id}`);
export const create = (data) => api.post('/edges', data);
export const update = (id, data) => api.put(`/edges/${id}`, data);
export const remove = (id) => api.delete(`/edges/${id}`);
