// API client for the backend. Same-origin via Vite dev proxy (/api -> :4000).
// Attaches a Bearer JWT to protected requests when present.

const TOKEN_KEY = 'telco_token';
const USER_KEY = 'telco_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
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

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  } catch {
    // storage unavailable; session stays in memory only
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, authorization: `Bearer ${token}` } : extra;
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
    setSession(body.token, body.user);
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
    setSession(body.token, body.user);
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
    setSession(body.token, body.user);
    return { ok: true, user: body.user };
  }
  return { ok: false, status: res.status, error: await parseError(res) };
}

export async function getMe() {
  const res = await fetch('/api/auth/me', { headers: authHeaders() });
  if (res.ok) {
    const body = await res.json();
    return { ok: true, user: body.user };
  }
  return { ok: false, status: res.status };
}

// Health / predict -------------------------------------------------

export async function getHealth() {
  const res = await fetch('/api/health');
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function predict(customer) {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
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