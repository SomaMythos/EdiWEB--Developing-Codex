import { api } from './client';

export const authApi = {
  login: (password) => api.post('/auth/login', { password }),
  status: () => api.get('/auth/status'),
};

export const notificationsApi = {
  list: (params = {}) => api.get('/notifications', { params }),
  updateStatus: (id, status) => api.patch(`/notifications/${id}/status`, { status }),
  getPreferences: () => api.get('/notifications/preferences'),
  savePreferences: (payload) => api.put('/notifications/preferences', payload),
  registerDevice: (payload) => api.post('/notifications/devices', payload),
  listDevices: (params = {}) => api.get('/notifications/devices', { params }),
  deleteDevice: (deviceToken) => api.delete(`/notifications/devices/${encodeURIComponent(deviceToken)}`),
  dispatchPush: (payload = {}) => api.post('/notifications/push/dispatch', payload),
  listPushDeliveries: (params = {}) => api.get('/notifications/push/deliveries', { params }),
  refreshPushReceipts: (payload = {}) => api.post('/notifications/push/receipts', payload),
};

export const dailyApi = {
  getByDate: (date) => api.get(`/daily/${date}`),
  generate: (date) => api.post('/daily/generate', null, { params: { date } }),
  completeBlock: (blockId, completed) => api.patch(`/daily/block/${blockId}/complete`, { completed }),
  getSummary: (date) => api.get('/daily/summary', { params: { date } }),
};

export const goalsApi = {
  list: () => api.get('/goals'),
  listCategories: () => api.get('/goals/categories'),
  listByCategory: (categoryId) => api.get(`/goals/categories/${categoryId}`),
  create: (payload) => {
    const form = new FormData();
    form.append('title', payload.title);
    if (payload.description) form.append('description', payload.description);
    if (payload.deadline) form.append('deadline', payload.deadline);
    form.append('difficulty', String(payload.difficulty || 1));
    if (payload.category_id) form.append('category_id', String(payload.category_id));
    return api.post('/goals', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, payload) => api.put(`/goals/${id}`, payload),
  remove: (id) => api.delete(`/goals/${id}`),
  updateStatus: (id, status) => api.patch(`/goals/${id}/status`, null, { params: { status } }),
  getHome: () => api.get('/goals/home'),
};

export const financeApi = {
  getSummary: () => api.get('/finance/summary'),
  listTransactions: (limit = 50) => api.get('/finance/transactions', { params: { limit } }),
  spend: (payload) => api.post('/finance/spend', payload),
};

export const calendarApi = {
  getMonth: (month) => api.get('/calendar/month', { params: { month } }),
  getDay: (date) => api.get('/calendar/day', { params: { date } }),
  createEvent: (payload) => api.post('/calendar/events', payload),
  updateEvent: (id, payload) => api.put(`/calendar/events/${id}`, payload),
  createManualLog: (payload) => api.post('/calendar/logs', payload),
  updateManualLog: (id, payload) => api.put(`/calendar/logs/${id}`, payload),
};
