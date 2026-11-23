// API client for the backend. Same-origin via Vite dev proxy (/api -> :4000).
// Attaches a Bearer JWT to protected requests when present.
// Automatically refreshes expired access tokens using the refresh token.

const TOKEN_KEY = 'telco_token';
const REFRESH_TOKEN_KEY = 'telco_refresh_token';
const USER_KEY = 'telco_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token, user, refreshToken = null) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {
    // storage unavailable; session stays in memory only
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, authorization: `Bearer ${token}` } : extra;
}

let refreshPromise = null;

export async function refreshAuthToken() {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    clearSession();
    return { ok: false, status: 401, error: 'No refresh token available' };
  }

  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });
      if (res.ok) {
        const body = await res.json();
        setSession(body.accessToken || body.token, body.user, body.refreshToken);
        return { ok: true, token: body.accessToken || body.token, user: body.user };
      }
      clearSession();
      return { ok: false, status: res.status, error: await parseError(res) };
    } catch (err) {
      clearSession();
      return { ok: false, status: 500, error: err.message };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function fetchWithAuth(url, options = {}) {
  const headers = authHeaders(options.headers || {});
  let res = await fetch(url, { ...options, headers });

  // If unauthorized and we have a refresh token, try refreshing and retry once
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAuthToken();
    if (refreshed.ok) {
      const retryHeaders = authHeaders(options.headers || {});
      res = await fetch(url, { ...options, headers: retryHeaders });
    }
  }

  return res;
}

async function parseError(res) {
  const text = await res.text().catch(() => '');
  let detail = text;
  try {
    const body = JSON.parse(text);
    detail = body.detail ?? body;
  } catch {
    // keep raw text
  }
  return detail;
}

// Auth -------------------------------------------------------------

export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    const body = await res.json();
    setSession(body.accessToken || body.token, body.user, body.refreshToken);
    return { ok: true, user: body.user };
  }
  return { ok: false, status: res.status, error: await parseError(res) };
}

export async function register(name, email, password) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (res.ok) {
    const body = await res.json();
    setSession(body.accessToken || body.token, body.user, body.refreshToken);
    return { ok: true, user: body.user };
  }
  return { ok: false, status: res.status, error: await parseError(res) };
}

export async function googleLogin(credential) {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (res.ok) {
    const body = await res.json();
    setSession(body.accessToken || body.token, body.user, body.refreshToken);
    return { ok: true, user: body.user };
  }
  return { ok: false, status: res.status, error: await parseError(res) };
}

export async function getMe() {
  const res = await fetchWithAuth('/api/auth/me');
  if (res.ok) {
    const body = await res.json();
    return { ok: true, user: body.user };
  }
  return { ok: false, status: res.status };
}

// History ----------------------------------------------------------

export async function getHistory() {
  const res = await fetchWithAuth('/api/predictions');

  if (res.status === 401) {
    clearSession();
    return { ok: false, status: 401, error: 'Session expired. Please sign in again.', items: [] };
  }

  if (res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, items: Array.isArray(body.items) ? body.items : [] };
  }

  return { ok: false, status: res.status, error: await parseError(res), items: [] };
}

export async function deletePrediction(id) {
  const res = await fetchWithAuth(`/api/predictions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (res.status === 401) {
    clearSession();
    return { ok: false, status: 401, error: 'Session expired. Please sign in again.' };
  }

  if (res.ok) return { ok: true, status: res.status };

  return { ok: false, status: res.status, error: await parseError(res) };
}

// Health / predict -------------------------------------------------

export async function getHealth() {
  const res = await fetch('/api/health');
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function predict(customer) {
  const res = await fetchWithAuth('/api/predict', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(customer),
  });

  if (res.status === 401) {
    clearSession();
    return { ok: false, status: 401, error: 'Session expired. Please sign in again.' };
  }

  if (res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, prediction: body.prediction };
  }

  return { ok: false, status: res.status, error: await parseError(res) };
}