import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/app.js';
import { MlServiceError } from '../src/services/mlClient.js';
import { signToken } from '../src/services/tokenService.js';

const VALID = {
  gender: 'Female',
  SeniorCitizen: 0,
  Partner: 'No',
  Dependents: 'No',
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'No',
  OnlineSecurity: 'No internet service',
  OnlineBackup: 'No internet service',
  DeviceProtection: 'No internet service',
  TechSupport: 'No internet service',
  StreamingTV: 'No internet service',
  StreamingMovies: 'No internet service',
  Contract: 'Month-to-month',
  PaperlessBilling: 'No',
  PaymentMethod: 'Mailed check',
  tenure: 2,
  MonthlyCharges: 20.3,
  TotalCharges: 41.2,
};

// Fake ML client mirroring the measured row-6576 flip:
// SeniorCitizen 0 -> not likely; 1 -> likely.
function makeFakeMl({ up = true, fail = false } = {}) {
  return {
    async health() {
      return up ? { up: true, data: { status: 'ok', model: '3b1a4122', features: 30 } } : { up: false };
    },
    async predict(customer) {
      if (fail) throw new MlServiceError('ML service responded with 500', { status: 500 });
      return customer.SeniorCitizen === 1 ? 'Likely to churn' : 'Not likely to churn';
    },
  };
}

// Boot an app on an ephemeral port, run fn(baseUrl), then always close.
async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const post = (url, body) =>
  fetch(`${url}/api/predict`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /api/health returns 200 when ML is up', async () => {
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.ml.up, true);
  });
});

test('POST /api/predict returns a label (SC=0)', async () => {
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await post(base, VALID);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).prediction, 'Not likely to churn');
  });
});

test('POST /api/predict flips label when SeniorCitizen=1', async () => {
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await post(base, { ...VALID, SeniorCitizen: 1 });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).prediction, 'Likely to churn');
  });
});

test('POST /api/predict returns 422 on invalid body', async () => {
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await post(base, { SeniorCitizen: 5, Contract: 'Daily' });
    assert.equal(res.status, 422);
    assert.ok(Array.isArray((await res.json()).detail));
  });
});

test('POST /api/predict returns 503 when ML errors', async () => {
  const app = createApp({ mlClient: makeFakeMl({ fail: true }), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await post(base, VALID);
    assert.equal(res.status, 503);
    assert.ok((await res.json()).detail);
  });
});

test('GET /api/health returns 503 when ML is down', async () => {
  const app = createApp({ mlClient: makeFakeMl({ up: false }), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 503);
  });
});

test('unknown route returns 404', async () => {
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.equal(res.status, 404);
  });
});

test('POST /api/predict returns 401 without a token when auth required', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: true });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID),
    });
    assert.equal(res.status, 401);
  });
});

test('POST /api/predict succeeds with a valid Bearer token', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = signToken({ sub: 'u1', email: 'a@b.c', name: 'A' });
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: true });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...VALID, SeniorCitizen: 1 }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).prediction, 'Likely to churn');
  });
});

test('POST /api/predict rejects an invalid token with 401', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: true });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not.a.jwt' },
      body: JSON.stringify(VALID),
    });
    assert.equal(res.status, 401);
  });
});

// Prediction history ------------------------------------------------

test('GET /api/predictions returns 401 without a token', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predictions`);
    assert.equal(res.status, 401);
  });
});

test('GET /api/predictions returns an empty list when persistence is off', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = signToken({ sub: 'u1', email: 'a@b.c', name: 'A' });
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predictions`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.items, []);
  });
});

test('DELETE /api/predictions/:id returns 401 without a token', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predictions/64b7f0000000000000000000`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 401);
  });
});

test('DELETE /api/predictions/:id returns 503 when the database is unavailable', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = signToken({ sub: 'u1', email: 'a@b.c', name: 'A' });
  const app = createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false, authRequired: false });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/predictions/64b7f0000000000000000000`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 503);
  });
});