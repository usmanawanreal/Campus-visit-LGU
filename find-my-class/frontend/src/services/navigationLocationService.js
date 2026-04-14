import api from './api.js';

export const getAll = (params = {}) => api.get('/navigation/locations', { params });

export const create = (payload) => api.post('/navigation/locations', payload);

export const update = (id, payload) => api.put(`/navigation/locations/${id}`, payload);

export const remove = (id) => api.delete(`/navigation/locations/${id}`);

