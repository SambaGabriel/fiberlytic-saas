// ─── FiberLytic API Service ──────────────────────────────────────────────────
// Handles all HTTP requests to the backend with JWT token management.
// Uses native fetch — no external dependencies.

const API_BASE = '/api/v1';

// ─── Token Storage ──────────────────────────────────────────────────────────

function getTokens() {
  try {
    return {
      accessToken: localStorage.getItem('fl_access_token'),
      refreshToken: localStorage.getItem('fl_refresh_token'),
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function setTokens(tokens) {
  localStorage.setItem('fl_access_token', tokens.accessToken);
  localStorage.setItem('fl_refresh_token', tokens.refreshToken);
  if (tokens.expiresIn) {
    localStorage.setItem('fl_token_expires', String(Date.now() + tokens.expiresIn * 1000));
  }
}

function clearTokens() {
  localStorage.removeItem('fl_access_token');
  localStorage.removeItem('fl_refresh_token');
  localStorage.removeItem('fl_token_expires');
  localStorage.removeItem('fl_user');
}

function getStoredUser() {
  try {
    const u = localStorage.getItem('fl_user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem('fl_user', JSON.stringify(user));
}

// ─── Core Fetch Wrapper ─────────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue = [];

async function apiFetch(path, options = {}) {
  const { accessToken } = getTokens();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE}${path}`;

  let res = await fetch(url, {
    ...options,
    headers,
  });

  // If 401, try refreshing the token once
  if (res.status === 401 && accessToken && !options._retry) {
    const newTokens = await tryRefreshToken();
    if (newTokens) {
      headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        _retry: true,
      });
    } else {
      // Refresh failed — force logout
      clearTokens();
      window.dispatchEvent(new CustomEvent('fl:auth:logout'));
      throw new ApiError('Session expired', 401);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.message || `Request failed: ${res.status}`,
      res.status,
      body,
    );
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

async function tryRefreshToken() {
  if (isRefreshing) {
    // Wait for the ongoing refresh
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;
  const { accessToken, refreshToken } = getTokens();

  if (!refreshToken) {
    isRefreshing = false;
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const tokens = await res.json();
    setTokens(tokens);

    // Resolve queued requests
    refreshQueue.forEach((resolve) => resolve(tokens));
    refreshQueue = [];

    return tokens;
  } catch {
    clearTokens();
    return null;
  } finally {
    isRefreshing = false;
  }
}

// ─── Error Class ────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ─── Auth Endpoints ─────────────────────────────────────────────────────────

async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setTokens(data.tokens);
  setStoredUser(data.user);
  return data;
}

async function register(payload) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  setTokens(data.tokens);
  setStoredUser(data.user);
  return data;
}

async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  } finally {
    clearTokens();
    window.dispatchEvent(new CustomEvent('fl:auth:logout'));
  }
}

// ─── Resource Endpoints ─────────────────────────────────────────────────────

const api = {
  // Auth
  login,
  register,
  logout,
  getStoredUser,
  getTokens,
  clearTokens,
  isAuthenticated: () => !!getTokens().accessToken,

  // Generic CRUD
  get: (path, params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`${path}${qs}`);
  },
  post: (path, body) =>
    apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) =>
    apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path) =>
    apiFetch(path, { method: 'DELETE' }),

  // Jobs
  getJobs: (params) => api.get('/jobs', params),
  getJob: (id) => api.get(`/jobs/${id}`),
  createJob: (data) => api.post('/jobs', data),
  updateJob: (id, data) => api.patch(`/jobs/${id}`, data),
  deleteJob: (id) => api.del(`/jobs/${id}`),

  // Users
  getUsers: (params) => api.get('/users', params),
  getUser: (id) => api.get(`/users/${id}`),

  // Projects
  getProjects: (params) => api.get('/projects', params),
  getProject: (id) => api.get(`/projects/${id}`),

  // Production
  getProduction: (params) => api.get('/production', params),
  createProduction: (data) => api.post('/production', data),
  updateProduction: (id, data) => api.patch(`/production/${id}`, data),

  // Rate Cards
  getRateCards: (params) => api.get('/rate-cards', params),

  // Invoices
  getInvoices: (params) => api.get('/invoices', params),
  getInvoiceSummary: () => api.get('/invoices/summary'),

  // Redlines
  getRedlines: (params) => api.get('/redlines', params),
  createRedline: (data) => api.post('/redlines', data),
  reviewRedline: (id, data) => api.post(`/redlines/${id}/review`, data),

  // Payroll
  getPayroll: (params) => api.get('/payroll', params),

  // Organizations
  getOrganization: (id) => api.get(`/organizations/${id}`),

  // Client Portal
  getClientProjects: () => api.get('/client-portal/projects'),
  getClientInvoices: () => api.get('/client-portal/invoices'),

  // Raw fetch for custom needs
  fetch: apiFetch,
  ApiError,
};

export default api;
