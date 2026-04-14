import api from './api.js';

export const getAll = (params) => api.get('/buildings', { params });
export const getById = (id) => api.get(`/buildings/${id}`);
export const create = (data) => api.post('/buildings', data);
export const remove = (id) => api.delete(`/buildings/${id}`);

export const search = (q) => api.get('/search/buildings', { params: { q } });
