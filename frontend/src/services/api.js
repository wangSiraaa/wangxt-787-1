import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const batchAPI = {
  list: (params) => api.get('/batches', { params }),
  get: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  setConclusion: (id, data) => api.post(`/batches/${id}/conclusion`, data),
};

export const problemAPI = {
  list: (params) => api.get('/problems', { params }),
  get: (id) => api.get(`/problems/${id}`),
  create: (data) => api.post('/problems', data),
  assign: (id, data) => api.put(`/problems/${id}/assign`, data),
  startRectify: (id, data) => api.put(`/problems/${id}/start-rectify`, data),
  addMeasure: (id, data) => api.post(`/problems/${id}/measures`, data),
  retest: (id, data) => api.post(`/problems/${id}/retest`, data),
  close: (id, data) => api.put(`/problems/${id}/close`, data),
  canClose: (id) => api.get(`/problems/${id}/can-close`),
};

export const userAPI = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  getByRole: (role) => api.get(`/users/role/${role}`),
};

export const defectLevelAPI = {
  list: () => api.get('/defect-levels'),
  get: (id) => api.get(`/defect-levels/${id}`),
};

export const dashboardAPI = {
  overview: () => api.get('/dashboard/overview'),
  problemsByStatus: () => api.get('/dashboard/problems-by-status'),
  problemsByLevel: () => api.get('/dashboard/problems-by-level'),
  overdueProblems: () => api.get('/dashboard/overdue-problems'),
  recentActivities: (limit) => api.get('/dashboard/recent-activities', { params: { limit } }),
  batchRisks: (batchId) => api.get(`/dashboard/batch/${batchId}/risks`),
};

export const subscriptionAPI = {
  getSubscription: (problemId, userId) => api.get(`/subscriptions/problems/${problemId}`, { params: { userId } }),
  subscribe: (problemId, userId) => api.post(`/subscriptions/problems/${problemId}`, { userId }),
  unsubscribe: (problemId, userId) => api.delete(`/subscriptions/problems/${problemId}`, { data: { userId } }),
  getMySubscriptions: (userId) => api.get('/subscriptions/my', { params: { userId } }),
  getNotifications: (userId, unreadOnly = false, limit) => api.get('/subscriptions/notifications', { params: { userId, unread_only: unreadOnly, limit } }),
  markNotificationRead: (notificationId, userId) => api.put(`/subscriptions/notifications/${notificationId}/read`, { userId }),
  markAllRead: (userId) => api.put('/subscriptions/notifications/read-all', { userId }),
  getUnreadCount: (userId) => api.get('/subscriptions/notifications/unread-count', { params: { userId } }),
};

export default api;
