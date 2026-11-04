import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const AUTH_STORAGE_KEY = 'kpi-auth-user';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token to requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user && user.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
          }
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.location.href = '/kpi';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const login = (credentials) => api.post('/api/auth/login', credentials);
export const register = (userData) => api.post('/api/auth/register', userData);
export const getCurrentUser = () => api.get('/api/auth/me');
export const logout = () => api.post('/api/auth/logout');

// Admin API
export const fetchUsers = () => api.get('/api/admin/users');
export const createUser = (userData) => api.post('/api/admin/users', userData);
export const updateUser = (id, userData) => api.put(`/api/admin/users/${id}`, userData);
export const deleteUser = (id) => api.delete(`/api/admin/users/${id}`);
export const fetchPermissions = () => api.get('/api/admin/permissions');
export const fetchPermissionUsers = () => api.get('/api/admin/permissions/users');
export const fetchPermissionProcessus = () => api.get('/api/admin/permissions/processus');
export const fetchPermissionIndicateurs = (processus) =>
    api.get(`/api/admin/permissions/indicateurs/${encodeURIComponent(processus)}`);
export const fetchUsersByPermission = (processus, indicateur) =>
    api.get(`/api/admin/permissions/users/${encodeURIComponent(processus)}/${encodeURIComponent(indicateur)}`);
export const addUserPermission = (userId, processus, indicateur) =>
    api.post('/api/admin/permissions', { userId, processus, indicateur });
export const deleteUserPermission = (permissionId) => api.delete(`/api/admin/permissions/${permissionId}`);
export const fetchSystemSettings = () => api.get('/api/admin/settings');
export const updateSystemSettings = (settings) => api.put('/api/admin/settings', settings);
// Dashboard API
export const fetchAllProcessusSummary = (year) => api.get(`/api/dashboard/all-summary${year ? `?year=${year}` : ''}`);
export const fetchDashboardMonthlyConformity = (year, month) =>
  api.get(`/api/dashboard/monthly-conformity?year=${year}&month=${month}`);

// KPI API
export const fetchDashboardSummary = () => api.get('/api/dashboard/summary');
export const fetchDashboardIndicateurs = () => api.get('/api/dashboard/indicateurs');
export const fetchDashboardActions = () => api.get('/api/dashboard/actions');
export const fetchProcessusList = () => api.get('/api/dashboard/processus');
export const fetchDashboardRows = (processus, year, period) => 
    api.get(`/api/dashboard/processus/${encodeURIComponent(processus)}?year=${year}&period=${period}`);
export const createProcessus = (processus) => api.post('/api/dashboard/processus', { processus });
export const createIndicateurDashboard = (indicateur, processus, designation, signe, unite) => 
    api.post('/api/dashboard/indicateur', { indicateur, processus, designation, signe, unite });
export const updateIndicateurDashboard = (indicateur, signe, unite) => 
    api.put(`/api/dashboard/indicateur/${indicateur}`, { signe, unite });
export const updateDashboardIndicatorPilote = (indicateur, pilote) =>
    api.put(`/api/dashboard/indicateur/${encodeURIComponent(indicateur)}/pilote`, { pilote });
export const updateDashboardIndicatorResponsable = (indicateur, responsable) =>
    api.put(`/api/dashboard/indicateur/${encodeURIComponent(indicateur)}/responsable`, { responsable });
export const updateDashboardIndicatorUser = (indicateur, userId) =>
    api.put(`/api/dashboard/indicateur/${encodeURIComponent(indicateur)}/user`, { userId });
export const updateObjectiveDashboard = (indicateur, year, month, value) => 
    api.put(`/api/dashboard/objective/${indicateur}`, { year, month, value });
export const fetchPeriods = (indicateur) => api.get(`/api/dashboard/periods/${indicateur}`);
export const fetchAllPlanActions = () => api.get('/api/dashboard/plan-action/all');
export const createOutils = (data) => api.post('/api/dashboard/outils', data);
export const fetchOutils = () => api.get('/api/dashboard/outils');

// Indicateurs API
export const fetchIndicateurs = () => api.get('/api/indicateurs');
export const fetchIndicateur = (id) => api.get(`/api/indicateurs/${id}`);
export const createIndicateur = (indicateur) => api.post('/api/indicateurs', indicateur);
export const updateIndicateur = (id, indicateur) => api.put(`/api/indicateurs/${id}`, indicateur);
export const deleteIndicateur = (id) => api.delete(`/api/indicateurs/${id}`);
export const fetchUserIndicateurs = () => api.get('/api/indicateurs/user-tasks');
export const sendIndicatorNotification = (indicateur, processus) => api.post('/api/indicateurs/notify', { indicateur, processus });
export const upsertIndicateurAnnee = (data) => api.post('/api/dashboard/indicateur-annee', data);


// Objectives API
export const fetchObjectives = () => api.get('/api/objectives');
export const fetchObjectivesByIndicateur = (indicateur) => api.get(`/api/objectives/indicateur/${indicateur}`);
export const createObjective = (objective) => api.post('/api/objectives', objective);
export const updateObjective = (id, objective) => api.put(`/api/objectives/${id}`, objective);
export const deleteObjective = (id) => api.delete(`/api/objectives/${id}`);

// Realises API
export const fetchRealises = () => api.get('/api/realises');
export const fetchRealisesByIndicateur = (indicateur) => api.get(`/api/realises/indicateur/${indicateur}`);
export const createRealise = (realise) => api.post('/api/realises', realise);
export const updateRealise = (id, realise) => api.put(`/api/realises/${id}`, realise);
export const deleteRealise = (id) => api.delete(`/api/realises/${id}`);

// Actions API
export const fetchActions = () => api.get('/api/actions');
export const fetchActionsByIndicateur = (indicateur) => api.get(`/api/actions/indicateur/${indicateur}`);
export const createAction = (action) => api.post('/api/actions', action);
export const updateAction = (id, action) => api.put(`/api/actions/${id}`, action);
export const deleteAction = (id) => api.delete(`/api/actions/${id}`);

// Ollama AI API
export const ollamaCompletion = (payload) => api.post('/api/ollama/completion', payload);
export const ollamaModels = () => api.get('/api/ollama/models');
export const ollamaPublicChat = (payload) => api.post('/api/ollama/chat', payload);//public chat
export const ollamaEnterpriseChat = (payload) => api.post('/api/ollama/enterprise-chat', payload);//entreprise

// Responsables API
export const fetchResponsables = () => api.get('/api/responsables');
export const fetchResponsable = (id) => api.get(`/api/responsables/${id}`);
export const createResponsable = (responsable) => api.post('/api/responsables', responsable);
export const updateResponsable = (id, responsable) => api.put(`/api/responsables/${id}`, responsable);
export const deleteResponsable = (id) => api.delete(`/api/responsables/${id}`);

// Notifications API
export const fetchNotifications = () => api.get('/api/notifications');
export const fetchUnreadCount = () => api.get('/api/notifications/unread-count');
export const markNotificationAsRead = (id) => api.put(`/api/notifications/${id}/read`);
export const markAllAsRead = () => api.put('/api/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/api/notifications/${id}`);
export const fetchNotificationSettings = () => api.get('/api/notifications/settings');
export const updateNotificationSettings = (settings) => api.put('/api/notifications/settings', settings);

// ML API
export const fetchMLAnomalies = () => api.get('/api/ml/anomalies');
export const fetchMLRiskScores = () => api.get('/api/ml/risk_scores');
export const fetchMLSuggestions = () => api.get('/api/ml/suggestions');
export const fetchMLDashboard = () => api.get('/api/ml/dashboard');
export const fetchMLBestPredictions = (params = {}) => api.get('/api/ml/best-predictions', { params });
export const fetchMLJobStatus = () => api.get('/api/ml/jobs/status');
export const fetchMLModelMetadata = () => api.get('/api/ml/model/metadata');
export const runMLEtlJob = () => api.post('/api/ml/jobs/etl/run');
export const runMLTrainingJob = () => api.post('/api/ml/jobs/train/run');
export const predictMLRealisation = (payload) => api.post('/api/ml/predict-realisation', payload);
export const predictMLRiskSuggestion = (payload) => api.post('/api/ml/risk-suggestion/predict', payload);
export const testMLIndicator = (payload) => api.post('/api/ml/indicator-test', payload);
export const testMLAnomaly = (payload) => api.post('/api/ml/anomaly-test', payload);
// Ollama API

export const fetchMLCopilot = (indicateur, options = {}) => {
  const params = new URLSearchParams();

  if (options.year) {
    params.set('year', String(options.year));
  }

  if (options.month) {
    params.set('month', String(options.month));
  }

  const query = params.toString();
  return api.get(`/api/ml/copilot/${encodeURIComponent(indicateur)}${query ? `?${query}` : ''}`);
};



export default api;
