import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/app.js';

// Local test configuration (read live by tokenService / auth controller).
process.env.JWT_SECRET = 'test-secret';
process.env.AUTH_ADMIN_EMAIL = 'admin@telco.local';
process.env.AUTH_ADMIN_PASSWORD = 'secret123';
delete process.env.GOOGLE_CLIENT_ID;

function makeFakeMl() {
  return {
    async health() {
      return { up: true, data: { status: 'ok' } };
    },
    async predict() {
      return 'Not likely to churn';
    },
  };
}

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

const app = () => createApp({ mlClient: makeFakeMl(), dbConnected: false, persist: false });
const postJson = (url, body, headers = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('POST /api/auth/login succeeds with configured admin creds (no DB)', async () => {
  await withServer(app(), async (base) => {
    const res = await postJson(`${base}/api/auth/login`, {
      email: 'admin@telco.local',
      password: 'secret123',
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.equal(body.user.email, 'admin@telco.local');
  });
});

test('POST /api/auth/login returns 401 with wrong password', async () => {
  await withServer(app(), async (base) => {
    const res = await postJson(`${base}/api/auth/login`, {
      email: 'admin@telco.local',
      password: 'wrong',
    });
    assert.equal(res.status, 401);
  });
});

test('POST /api/auth/register returns 503 without a database', async () => {
  await withServer(app(), async (base) => {
    const res = await postJson(`${base}/api/auth/register`, {
      email: 'new@user.com',
      password: 'password123',
    });
    assert.equal(res.status, 503);
  });
});

test('POST /api/auth/google returns 503 when Google is not configured', async () => {
  await withServer(app(), async (base) => {
    const res = await postJson(`${base}/api/auth/google`, { credential: 'fake.google.token' });
    assert.equal(res.status, 503);
  });
});

test('GET /api/auth/me returns 401 without a token', async () => {
  await withServer(app(), async (base) => {
    const res = await fetch(`${base}/api/auth/me`);
    assert.equal(res.status, 401);
  });
});

test('GET /api/auth/me returns the user with a valid token', async () => {
  await withServer(app(), async (base) => {
    const login = await postJson(`${base}/api/auth/login`, {
      email: 'admin@telco.local',
      password: 'secret123',
    });
    const { token } = await login.json();
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).user.email, 'admin@telco.local');
  });
});

test('GET /api/docs serves Swagger UI', async () => {
  await withServer(app(), async (base) => {
    const res = await fetch(`${base}/api/docs/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.toLowerCase().includes('swagger'));
  });
});