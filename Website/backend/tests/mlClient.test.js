import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMlClient, MlServiceError } from '../src/services/mlClient.js';

function fakeFetch(handler) {
  return async (url, options) => handler(url, options);
}

test('predict returns the label on 200', async () => {
  const client = createMlClient({
    baseUrl: 'http://ml.test',
    fetchImpl: fakeFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ prediction: 'Likely to churn' }),
    })),
  });
  const label = await client.predict({ SeniorCitizen: 1 });
  assert.equal(label, 'Likely to churn');
});

test('predict posts to /predict', async () => {
  let seen;
  const client = createMlClient({
    baseUrl: 'http://ml.test/',
    fetchImpl: fakeFetch(async (url, options) => {
      seen = { url, method: options.method };
      return { ok: true, status: 200, json: async () => ({ prediction: 'Not likely to churn' }) };
    }),
  });
  await client.predict({ SeniorCitizen: 0 });
  assert.equal(seen.url, 'http://ml.test/predict');
  assert.equal(seen.method, 'POST');
});

test('predict throws MlServiceError with status on 5xx', async () => {
  const client = createMlClient({
    baseUrl: 'http://ml.test',
    fetchImpl: fakeFetch(async () => ({ ok: false, status: 500, text: async () => 'boom' })),
  });
  await assert.rejects(() => client.predict({}), (err) => {
    assert.ok(err instanceof MlServiceError);
    assert.equal(err.status, 500);
    return true;
  });
});

test('predict throws MlServiceError when unreachable', async () => {
  const client = createMlClient({
    baseUrl: 'http://ml.test',
    fetchImpl: fakeFetch(async () => {
      throw new Error('ECONNREFUSED');
    }),
  });
  await assert.rejects(() => client.predict({}), MlServiceError);
});

test('predict throws on unexpected payload', async () => {
  const client = createMlClient({
    baseUrl: 'http://ml.test',
    fetchImpl: fakeFetch(async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) })),
  });
  await assert.rejects(() => client.predict({}), MlServiceError);
});

test('health reports up on 200', async () => {
  const client = createMlClient({
    baseUrl: 'http://ml.test',
    fetchImpl: fakeFetch(async () => ({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })),
  });
  const h = await client.health();
  assert.equal(h.up, true);
});

test('health reports down on network error', async () => {
  const client = createMlClient({
    baseUrl: 'http://ml.test',
    fetchImpl: fakeFetch(async () => {
      throw new Error('down');
    }),
  });
  const h = await client.health();
  assert.equal(h.up, false);
});