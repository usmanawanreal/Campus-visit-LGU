import api from './api.js';

export const getAll = (params) => api.get('/nodes', { params });
export const getById = (id) => api.get(`/nodes/${id}`);
export const create = (data) => api.post('/nodes', data);
export const update = (id, data) => api.put(`/nodes/${id}`, data);
export const remove = (id) => api.delete(`/nodes/${id}`);
