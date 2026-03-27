import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sv_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-request-nonce'] = `${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
  config.headers['x-device-fingerprint'] = getDeviceFingerprint();
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (error) => {
    if (error.response?.status === 401) { localStorage.removeItem('sv_token'); window.location.href = '/login'; }
    return Promise.reject(error.response?.data || error);
  }
);

function getDeviceFingerprint() {
  const c = sessionStorage.getItem('sv_fp');
  if (c) return c;
  const fp = btoa([navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset()].join('|')).substr(0, 32);
  sessionStorage.setItem('sv_fp', fp);
  return fp;
}

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  register: (d) => api.post('/auth/register', d),
  getMe: () => api.get('/auth/me')
};
export const transactionAPI = {
  create: (d) => api.post('/transactions', d),
  getMy: () => api.get('/transactions/my'),
  getAll: (p) => api.get('/transactions/all', { params: p }),
  getBalance: () => api.get('/transactions/balance'),
  topUp: (d) => api.post('/transactions/topup', d),
  getIntegritySummary: () => api.get('/transactions/integrity/summary'),
  verifyIntegrity: (id) => api.get(`/transactions/integrity/verify/${id}`),
  rebuildIntegrity: () => api.post('/transactions/integrity/rebuild'),
};
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  getNotifications: () => api.get('/user/notifications'),
  markRead: () => api.put('/user/notifications/read')
};
export const gatewayAPI = {
  getDashboard: () => api.get('/gateway/dashboard'),
  getUsers: () => api.get('/gateway/users'),
  getLiveTransactions: () => api.get('/gateway/transactions/live'),
  suspendUser: (id, reason) => api.put(`/gateway/users/${id}/suspend`, { reason }),
  unsuspendUser: (id) => api.put(`/gateway/users/${id}/unsuspend`),
};
export const bankAPI = {
  getDashboard: () => api.get('/bank/dashboard'),
  getFraudAlerts: (p) => api.get('/bank/fraud-alerts', { params: p }),
  getHighRiskUsers: () => api.get('/bank/high-risk-users'),
  getNetworkGraph: () => api.get('/bank/network-graph'),
  approveUser: (id, notes) => api.put(`/bank/users/${id}/approve`, { notes }),
  unblockUser: (id, notes) => api.put(`/bank/users/${id}/unblock`, { notes }),
  blockUser: (id, notes) => api.put(`/bank/users/${id}/block`, { notes }),
  increaseMonitoring: (id, notes) => api.put(`/bank/users/${id}/monitor`, { notes }),
  getBlockchainStatus: () => api.get('/bank/blockchain/status'),
  verifyOnChain: (chainEventId) => api.get(`/bank/blockchain/verify/${chainEventId}`),
  getUserChainHistory: (userId) => api.get(`/bank/blockchain/user/${userId}/history`),
};
export default api;