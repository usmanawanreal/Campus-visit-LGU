import api from './api.js';

export const getAll = (params) => api.get('/locations', { params });
export const search = (q) => api.get('/locations/search', { params: { q } });
export const create = (data) => api.post('/locations', data);
export const remove = (id) => api.delete(`/locations/${id}`);
