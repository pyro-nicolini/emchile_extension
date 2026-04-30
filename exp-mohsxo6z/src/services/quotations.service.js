import api from './api';

export const QuotationsService = {
  getAll: () => api.get('/quotations'),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`)
};
