import { test, expect, beforeEach, vi } from 'vitest';

import { predict, login, getToken, getRefreshToken, setSession, clearSession, refreshAuthToken, getHistory, deletePrediction } from './api.js';

function mockResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test('predict returns the label on success', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => mockResponse({ body: { prediction: 'Not likely to churn' } })));
  const res = await predict({ SeniorCitizen: 0 });
  expect(res.ok).toBe(true);
  expect(res.status).toBe(200);
  expect(res.prediction).toBe('Not likely to churn');
});

test('predict attaches a Bearer token when present', async () => {
  setSession('jwt-123', { email: 'a@b.c' });
  const fetchMock = vi.fn(async () => mockResponse({ body: { prediction: 'Likely to churn' } }));
  vi.stubGlobal('fetch', fetchMock);

  const res = await predict({ SeniorCitizen: 1 });
  expect(res.ok).toBe(true);
  expect(res.prediction).toBe('Likely to churn');

  const [, init] = fetchMock.mock.calls[0];
  expect(init.headers.authorization).toBe('Bearer jwt-123');
  expect(init.headers['content-type']).toBe('application/json');
});

test('predict omits the auth header when no token', async () => {
  const fetchMock = vi.fn(async () => mockResponse({ body: { prediction: 'Not likely to churn' } }));
  vi.stubGlobal('fetch', fetchMock);
  await predict({ SeniorCitizen: 0 });
  const [, init] = fetchMock.mock.calls[0];
  expect(init.headers.authorization).toBeUndefined();
});

test('predict clears the session and reports 401 when unauthorized', async () => {
  setSession('expired', { email: 'a@b.c' });
  vi.stubGlobal('fetch', vi.fn(async () => mockResponse({ ok: false, status: 401, body: {} })));

  const res = await predict({ SeniorCitizen: 0 });
  expect(res.ok).toBe(false);
  expect(res.status).toBe(401);
  expect(res.error).toMatch(/sign in again/i);
  expect(getToken()).toBe('');
});

test('predict surfaces the server error detail on failure', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => mockResponse({ ok: false, status: 422, body: { detail: [{ msg: 'bad field' }] } })),
  );
  const res = await predict({ SeniorCitizen: 9 });
  expect(res.ok).toBe(false);
  expect(res.status).toBe(422);
  expect(res.error).toEqual([{ msg: 'bad field' }]);
});

test('login stores the token and user on success', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => mockResponse({ body: { token: 'jwt-abc', user: { email: 'x@y.z', name: 'X' } } })),
  );
  const res = await login('x@y.z', 'password');
  expect(res.ok).toBe(true);
  expect(getToken()).toBe('jwt-abc');
  expect(JSON.parse(localStorage.getItem('telco_user'))).toEqual({ email: 'x@y.z', name: 'X' });
});

test('login returns ok:false with an error on bad credentials', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => mockResponse({ ok: false, status: 401, body: { detail: 'Invalid credentials' } })),
  );
  const res = await login('x@y.z', 'wrong');
  expect(res.ok).toBe(false);
  expect(res.status).toBe(401);
  expect(res.error).toBe('Invalid credentials');
});

test('clearSession removes the stored token and user', () => {
  setSession('t', { email: 'a@b.c' });
  clearSession();
  expect(getToken()).toBe('');
  expect(localStorage.getItem('telco_user')).toBeNull();
});

test('setSession stores and clearSession removes refresh token', () => {
  setSession('acc-1', { email: 'a@b.c' }, 'ref-1');
  expect(getToken()).toBe('acc-1');
  expect(getRefreshToken()).toBe('ref-1');
  clearSession();
  expect(getToken()).toBe('');
  expect(getRefreshToken()).toBe('');
});

test('refreshAuthToken updates session with refreshed tokens on success', async () => {
  setSession('acc-old', { email: 'user@test.com' }, 'ref-valid');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      mockResponse({
        body: {
          accessToken: 'acc-new',
          refreshToken: 'ref-new',
          user: { email: 'user@test.com', name: 'User' },
        },
      }),
    ),
  );

  const res = await refreshAuthToken();
  expect(res.ok).toBe(true);
  expect(getToken()).toBe('acc-new');
  expect(getRefreshToken()).toBe('ref-new');
});

test('predict automatically refreshes token on 401 and retries original request', async () => {
  setSession('acc-expired', { email: 'u@test.com' }, 'ref-valid');

  let callCount = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      callCount += 1;
      if (url === '/api/predict' && callCount === 1) {
        return mockResponse({ ok: false, status: 401, body: { detail: 'Token expired' } });
      }
      if (url === '/api/auth/refresh') {
        return mockResponse({
          ok: true,
          status: 200,
          body: { accessToken: 'acc-fresh', refreshToken: 'ref-fresh', user: { email: 'u@test.com' } },
        });
      }
      if (url === '/api/predict' && callCount === 3) {
        return mockResponse({ ok: true, status: 200, body: { prediction: 'Likely to churn' } });
      }
      return mockResponse({ ok: false, status: 500 });
    }),
  );

  const res = await predict({ SeniorCitizen: 1 });
  expect(res.ok).toBe(true);
  expect(res.prediction).toBe('Likely to churn');
  expect(getToken()).toBe('acc-fresh');
  expect(getRefreshToken()).toBe('ref-fresh');
});


// History -----------------------------------------------------------

test('getHistory returns the items array on success', async () => {
  setSession('jwt-123', { email: 'a@b.c' });
  const fetchMock = vi.fn(async () =>
    mockResponse({ body: { items: [{ _id: '1', prediction: 'Likely to churn' }] } }),
  );
  vi.stubGlobal('fetch', fetchMock);

  const res = await getHistory();
  expect(res.ok).toBe(true);
  expect(res.items).toHaveLength(1);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/predictions');
  expect(init.headers.authorization).toBe('Bearer jwt-123');
});

test('getHistory returns an empty array when the body has no items', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => mockResponse({ body: {} })));
  const res = await getHistory();
  expect(res.ok).toBe(true);
  expect(res.items).toEqual([]);
});

test('getHistory clears the session and reports 401 when unauthorized', async () => {
  setSession('expired', { email: 'a@b.c' });
  vi.stubGlobal('fetch', vi.fn(async () => mockResponse({ ok: false, status: 401, body: {} })));

  const res = await getHistory();
  expect(res.ok).toBe(false);
  expect(res.status).toBe(401);
  expect(res.items).toEqual([]);
  expect(getToken()).toBe('');
});

test('deletePrediction calls DELETE with the encoded id', async () => {
  setSession('jwt-123', { email: 'a@b.c' });
  const fetchMock = vi.fn(async () => mockResponse({ body: { ok: true } }));
  vi.stubGlobal('fetch', fetchMock);

  const res = await deletePrediction('abc/123');
  expect(res.ok).toBe(true);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/predictions/abc%2F123');
  expect(init.method).toBe('DELETE');
  expect(init.headers.authorization).toBe('Bearer jwt-123');
});

test('deletePrediction surfaces the server error on failure', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => mockResponse({ ok: false, status: 404, body: { detail: 'Prediction not found' } })),
  );
  const res = await deletePrediction('64b7f0000000000000000000');
  expect(res.ok).toBe(false);
  expect(res.status).toBe(404);
  expect(res.error).toBe('Prediction not found');
});