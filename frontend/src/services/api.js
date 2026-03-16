import axios from 'axios';

const DEFAULT_API_URL = '/api';
const normalizeUrl = (value) => value.replace(/\/+$/, '');

const envApiUrl = normalizeUrl((import.meta.env.VITE_API_URL || '').trim());

export const API_URL = envApiUrl || DEFAULT_API_URL;
export const API_ORIGIN = /^https?:\/\//i.test(API_URL)
  ? new URL(API_URL).origin
  : (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8000');

axios.defaults.baseURL = API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Activity Types removido (sistema agora usa Disciplina / Diversão direto na Activity)


export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['x-edi-auth-token'] = token;
    axios.defaults.headers.common['x-edi-auth-token'] = token;
    return;
  }
  delete api.defaults.headers.common['x-edi-auth-token'];
  delete axios.defaults.headers.common['x-edi-auth-token'];
};

export const authApi = {
  status: () => api.get('/auth/status'),
  login: (password) => api.post('/auth/login', { password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};


// Activities
export const activitiesApi = {
  list: () => api.get('/activities'),
  create: (data) => api.post('/activities', data),
  update: (id, data) => api.put(`/activities/${id}`, data),
  toggle: (id) => api.patch(`/activities/${id}/toggle`),
  remove: (id) => api.delete(`/activities/${id}`),
};

export const activityCountersApi = {
  list: () => api.get('/activity-counters'),
  create: (data) => api.post('/activity-counters', data),
  complete: (id) => api.post(`/activity-counters/${id}/complete`),
};

export const dailyApi = {
  getByDate: (date) => api.get(`/daily/${date}`),
  getSummary: (date) => api.get('/daily/summary', { params: { date } }),
  getDayType: (date) => api.get('/daily/type', { params: { date } }),
  getRoutine: (date) => api.get('/daily/routine', { params: { date } }),
  getConsistency: (days = 7) => api.get('/daily/consistency', { params: { days } }),
  getWeeklyStats: (date) => api.get('/daily/weekly-stats', { params: { date } }),
  overrideDayType: (date, isOff) => api.post('/daily/override', { date, is_off: isOff }),
  generate: (date) => api.post('/daily/generate', null, { params: { date } }),
  completeBlock: (blockId, completed) => api.patch(`/daily/block/${blockId}/complete`, { completed }),
  updateBlock: (blockId, payload) => api.patch(`/daily/block/${blockId}`, payload),
};

export const routinesApi = {
  create: (name, dayType) => api.post('/daily/routines', { name, day_type: dayType }),
  addBlock: (payload) => api.post('/daily/routines/blocks', payload),
  removeBlock: (blockId) => api.delete(`/daily/routines/blocks/${blockId}`),
};

// Daily Log
export const dailyLogApi = {
  list: () => api.get('/daily-log'),
  register: (data) => api.post('/daily-log/register', data),
  getByDate: (date) => api.get(`/daily-log/${date}`),
};

// Goals
const toGoalsFormData = (data) => {
  if (data instanceof FormData) return data;
  const formData = new FormData();
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      formData.append(key, value);
    }
  });
  return formData;
};

export const goalsApi = {
  list: () => api.get('/goals'),
  create: (data) => api.post('/goals', toGoalsFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/goals/${id}`, data),
  updateWithFormData: (id, data) => api.put(`/goals/${id}/multipart`, toGoalsFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => api.delete(`/goals/${id}`),
  linkActivity: (data) => api.post('/goals/link-activity', data),
  unlinkActivity: (goalId, activityId) => api.delete(`/goals/${goalId}/activities/${activityId}`),
  getProgress: (id) => api.get(`/goals/${id}/progress`),
  updateStatus: (id, status) => api.patch(`/goals/${id}/status`, null, { params: { status } }),
  getStarsTotal: () => api.get('/goals/stars/total'),
  getHome: () => api.get('/goals/home'),
  listCategories: () => api.get('/goals/categories'),
  createCategory: (data) => api.post('/goals/categories', data),
  updateCategory: (id, data) => api.put(`/goals/categories/${id}`, data),
  removeCategory: (id) => api.delete(`/goals/categories/${id}`),
  listByCategory: (categoryId) => api.get(`/goals/categories/${categoryId}`),
  listMilestones: (goalId) => api.get(`/goals/${goalId}/milestones`),
  syncMilestones: (goalId, data) => api.put(`/goals/${goalId}/milestones`, data),
  updateMilestoneStatus: (milestoneId, isCompleted) => api.patch(`/goals/milestones/${milestoneId}/status`, { is_completed: isCompleted }),
};

// Analytics
export const analyticsApi = {
  getToday: () => api.get('/analytics/today'),
  getLastDays: (days = 7) => api.get(`/analytics/last-days/${days}`),
  getTopActivities: (limit = 5) => api.get(`/analytics/top-activities?limit=${limit}`),
  getGoalsOverview: () => api.get('/analytics/goals-overview'),
};

export const reportsApi = {
  getDailyOverview: () => api.get('/reports/daily/overview'),
  getDailyStreaks: () => api.get('/reports/daily/streaks'),
  getDailyActivityDetail: (activityId) => api.get(`/reports/daily/activity/${activityId}`),
  getDailyTimeseries: (days = 30) => api.get('/reports/daily/timeseries', { params: { days } }),
  getGoalsSummary: () => api.get('/reports/goals/summary'),
  getHobbiesLog: (params = {}) => api.get('/reports/hobbies/log', { params }),
  getFinanceSummary: (params = {}) => api.get('/reports/finance/summary', { params }),
};

// Notifications
export const notificationsApi = {
  list: (params = {}) => api.get('/notifications', { params }),
  listConsumables: (params = {}) => api.get('/notifications/consumables', { params }),
  getAll: () => api.get('/notifications', { params: { include_generated: true } }),
  createCustom: (data) => api.post('/notifications/custom', data),
  updateCustom: (id, data) => api.put(`/notifications/custom/${id}`, data),
  updateStatus: (id, status) => api.patch(`/notifications/${id}/status`, { status }),
  snooze: (id, minutes = 30) => api.post(`/notifications/${id}/snooze`, { minutes }),
  getPreferences: () => api.get('/notifications/preferences'),
  savePreferences: (data) => api.put('/notifications/preferences', data),
  registerDevice: (data) => api.post('/notifications/devices', data),
  listDevices: (params = {}) => api.get('/notifications/devices', { params }),
  deleteDevice: (deviceToken) => api.delete(`/notifications/devices/${encodeURIComponent(deviceToken)}`),
  dispatchPush: (data = {}) => api.post('/notifications/push/dispatch', data),
  listPushDeliveries: (params = {}) => api.get('/notifications/push/deliveries', { params }),
  refreshPushReceipts: (data = {}) => api.post('/notifications/push/receipts', data),
};

// Notes and Weekly Journal
export const notesApi = {
  listContexts: () => api.get('/notes/contexts'),
  createContext: (data) => api.post('/notes/contexts', data),
  updateContext: (id, data) => api.put(`/notes/contexts/${id}`, data),
  deleteContext: (id) => api.delete(`/notes/contexts/${id}`),
  list: (params = {}) => api.get('/notes', { params }),
  search: (query) => api.get('/notes/search', { params: { query } }),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
};

export const journalApi = {
  getSettings: () => api.get('/journal/settings'),
  updateSettings: (data) => api.put('/journal/settings', data),
  getCurrent: (referenceDate) => api.get('/journal/current', { params: { reference_date: referenceDate } }),
  listEntries: (limit = 12) => api.get('/journal/entries', { params: { limit } }),
  saveEntry: (data) => api.post('/journal/entries', data),
};

const toWatchFormData = (data) => {
  if (data instanceof FormData) return data;
  const formData = new FormData();
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      formData.append(key, value);
    }
  });
  return formData;
};

export const watchApi = {
  getOverview: (limitLogs = 18) => api.get('/watch/overview', { params: { limit_logs: limitLogs } }),
  listCategories: () => api.get('/watch/categories'),
  createCategory: (name) => api.post('/watch/categories', new URLSearchParams({ name })),
  listItems: (params = {}) => api.get('/watch/items', { params }),
  createItem: (data) => api.post('/watch/items', toWatchFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateItem: (id, data) => api.put(`/watch/items/${id}`, toWatchFormData(data), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteItem: (id) => api.delete(`/watch/items/${id}`),
  addLog: (id, data) => api.post(`/watch/items/${id}/logs`, data),
  markWatched: (id) => api.patch(`/watch/items/${id}/watched`),
};

// System Integration
export const systemIntegrationApi = {
  getStatus: () => api.get('/system/integration'),
  createDesktopShortcut: () => api.post('/system/desktop-shortcut'),
  setWindowsStartup: (enabled) => api.put('/system/windows-startup', { enabled }),
  resetDatabase: (confirmationText) => api.post('/system/reset-database', { confirmation_text: confirmationText }),
};

// Export
export const exportApi = {
  exportJson: (filename) => api.get('/export/json', { params: { filename } }),
  exportCsv: () => api.get('/export/csv'),
  exportActivitiesReport: (startDate, endDate) =>
    api.get('/export/activities-report', { params: { start_date: startDate, end_date: endDate } }),
  exportGoalsProgress: () => api.get('/export/goals-progress'),
};

// User Profile
export const userApi = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.post('/user/profile', data),
  getMetrics: () => api.get('/user/metrics'),
  addMetric: (data) => api.post('/user/metrics', data),
};

// Activity History
export const historyApi = {
  getHistory: (days = 30) => api.get(`/activity-history?days=${days}`),
};

export default api;

// Finance
export const financeApi = {
  getConfig: () => api.get('/finance/config'),
  saveConfig: (data) => api.post('/finance/config', data),
  listFixedExpenses: () => api.get('/finance/fixed-expenses'),
  createFixedExpense: (data) => api.post('/finance/fixed-expenses', data),
  updateFixedExpense: (id, data) => api.put(`/finance/fixed-expenses/${id}`, data),
  deleteFixedExpense: (id) => api.delete(`/finance/fixed-expenses/${id}`),
  listTransactions: (limit = 200) => api.get('/finance/transactions', { params: { limit } }),
  createTransaction: (data) => api.post('/finance/transactions', data),
  updateTransaction: (id, data) => api.put(`/finance/transactions/${id}`, data),
  deleteTransaction: (id) => api.delete(`/finance/transactions/${id}`),
  getSummary: () => api.get('/finance/summary'),
  getProjection: (months = 120) => api.get(`/finance/projection?months=${months}`),
};

// Dashboard + Profile
export const dashboardApi = {
  getOverview: () => api.get('/dashboard/overview'),
  getWeekly: () => api.get('/dashboard/weekly'),
  getFrontpage: () => api.get('/dashboard/frontpage'),
  search: (query, limitPerSection = 5) => api.get('/dashboard/search', { params: { query, limit_per_section: limitPerSection } }),
};

export const profileApi = {
  get: () => api.get('/profile'),
  save: (data) => api.post('/profile', data),
  getMetrics: (limit = 30) => api.get(`/profile/metrics?limit=${limit}`),
  addMetric: (data) => api.post('/profile/metrics', data),
};

// Books
export const booksApi = {
  list: (status) => api.get('/books', { params: { status } }),
  create: (data) => api.post('/books', data),
  delete: (id) => api.delete(`/books/${id}`),
  addSession: (bookId, data) => api.post(`/books/${bookId}/sessions`, data),
  stats: () => api.get('/books/stats'),
  listTypes: () => api.get('/books/types'),
  createType: (data) => api.post('/books/types', data),
  getLog: (limit = 200) => api.get('/books/log', { params: { limit } }),
  getStatsByType: (month, year) => api.get('/books/stats-by-type', { params: { month, year } }),
};

// Paintings & Progress Photos
export const paintingsApi = {
  list: (status, category) => api.get('/visual-arts/artworks', { params: { status, visual_category: category } }),
  getInsights: (category) => api.get('/visual-arts/insights', { params: { visual_category: category } }),
  getLog: (category, limit = 40) => api.get('/visual-arts/log', { params: { visual_category: category, limit } }),
  create: (data) => {
    const formData = new FormData();
    formData.append('title', data.title);
    if (data.size) formData.append('size', data.size);
    if (data.started_at) formData.append('started_at', data.started_at);
    if (data.category) formData.append('visual_category', data.category);
    if (data.reference_image) formData.append('reference_image', data.reference_image);
    return api.post('/visual-arts/artworks', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  addProgress: (paintingId, data) => {
    const formData = new FormData();
    formData.append('update_title', data.update_title || 'Atualização de progresso');
    if (data.photo) formData.append('photo', data.photo);
    if (data.mark_completed) formData.append('mark_completed', data.mark_completed);
    return api.post(`/visual-arts/artworks/${paintingId}/updates`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getProgress: (paintingId) => api.get(`/visual-arts/artworks/${paintingId}/gallery`),
  complete: (paintingId, data = {}) =>
    api.patch(`/visual-arts/artworks/${paintingId}/completion-date`, { finished_at: data.finished_at || new Date().toISOString() }),
  createArtwork: (data) => {
    const formData = new FormData();
    formData.append('title', data.title);
    if (data.size) formData.append('size', data.size);
    if (data.started_at) formData.append('started_at', data.started_at);
    if (data.visual_category) formData.append('visual_category', data.visual_category);
    if (data.reference_image) formData.append('reference_image', data.reference_image);
    return api.post('/visual-arts/artworks', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listUpdates: (paintingId) => api.get(`/visual-arts/artworks/${paintingId}/gallery`),
  createUpdate: (paintingId, data) => {
    const formData = new FormData();
    formData.append('update_title', data.update_title || 'Atualização de progresso');
    if (typeof data.mark_completed !== 'undefined') formData.append('mark_completed', String(data.mark_completed));
    if (data.photo) formData.append('photo', data.photo);
    return api.post(`/visual-arts/artworks/${paintingId}/updates`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateCompletionDate: (paintingId, data) =>
    api.patch(`/visual-arts/artworks/${paintingId}/completion-date`, { finished_at: data.finished_at || null }),
  listMediaFolders: (sectionType) => api.get('/visual-arts/media-folders', { params: { section_type: sectionType } }),
  createMediaFolder: (data) => api.post('/visual-arts/media-folders', data),
  updateMediaFolder: (folderId, data) => api.put(`/visual-arts/media-folders/${folderId}`, data),
  listMediaItems: (folderId) => api.get(`/visual-arts/media-folders/${folderId}/items`),
  createMediaItem: ({ folder_id, title, photo, date }) => {
    const formData = new FormData();
    formData.append('folder_id', folder_id);
    formData.append('title', title);
    formData.append('photo', photo);
    if (date) formData.append('date', date);
    return api.post('/visual-arts/media-items', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteMediaItem: (itemId) => api.delete(`/visual-arts/media-items/${itemId}`),
  deleteMediaFolder: (folderId) => api.delete(`/visual-arts/media-folders/${folderId}`),
  deleteArtwork: (paintingId) => api.delete(`/visual-arts/artworks/${paintingId}`),
};

// Shopping
export const shoppingApi = {
  listWishlist: (itemType) => api.get('/shopping/wishlist', { params: { item_type: itemType } }),
  addWishlist: (data) => api.post('/shopping/wishlist', data),
  updateWishlist: (id, data) => api.put(`/shopping/wishlist/${id}`, data),
  markWishlist: (id, isMarked) => api.patch(`/shopping/wishlist/${id}/mark`, { is_marked: isMarked }),
  deleteWishlist: (id) => api.delete(`/shopping/wishlist/${id}`),
  listItems: (category) => api.get('/shopping/items', { params: { category } }),
  addItem: (data) => api.post('/shopping/items', data),
  stats: () => api.get('/shopping/stats'),
};

export const consumablesApi = {
  listCategories: () => api.get('/consumables/categories'),
  createCategory: ({ name }) => api.post('/consumables/categories', { name }),
  listItems: (categoryId = undefined) => api.get('/consumables/items', {
    params: categoryId ? { category_id: categoryId } : {},
  }),
  createItem: ({ name, category_id }) => api.post('/consumables/items', { name, category_id }),
  getItemDetail: (itemId) => api.get(`/consumables/items/${itemId}`),
  restock: (itemId, { purchase_date, price_paid }) => api.post(`/consumables/items/${itemId}/restock`, {
    purchase_date,
    price_paid,
  }),
  finishCycle: (itemId, { ended_at }) => api.post(`/consumables/items/${itemId}/finish`, { ended_at }),
};

export const dayPlanApi = {
  list: (date) => api.get('/day-plan', { params: { date } }),
  add: (data) => api.post('/day-plan', data),
  remove: (id) => api.delete(`/day-plan/${id}`),
};

export const calendarApi = {
  getMonth: (month) => api.get('/calendar/month', { params: { month } }),
  getDay: (date) => api.get('/calendar/day', { params: { date } }),
  getWeek: (referenceDate) => api.get('/calendar/week', { params: { reference_date: referenceDate } }),
  createEvent: (data) => api.post('/calendar/events', data),
  deleteEvent: (id) => api.delete(`/calendar/events/${id}`),
  createManualLog: (data) => api.post('/calendar/logs', data),
  deleteManualLog: (id) => api.delete(`/calendar/logs/${id}`),
};

// Day Engine Config
export const dayConfigApi = {
  get: () => api.get('/day-config'),
  save: (data) => api.post('/day-config', data),
};



