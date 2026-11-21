/**
 * Client for the Python ML service (services/ml FastAPI app).
 *
 * Uses the global fetch (Node 18+) and AbortSignal.timeout for bounded latency.
 * createMlClient is a factory so tests can inject a fake fetchImpl.
 */

export class MlServiceError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = 'MlServiceError';
    this.status = status;
    this.cause = cause;
  }
}

export function createMlClient({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  if (!baseUrl) throw new Error('createMlClient requires a baseUrl');
  if (typeof fetchImpl !== 'function') throw new Error('createMlClient requires a fetchImpl');

  const base = baseUrl.replace(/\/+$/, '');

  async function predict(customer) {
    let res;
    try {
      res = await fetchImpl(`${base}/predict`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(customer),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new MlServiceError('ML service is unreachable', { cause });
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new MlServiceError(`ML service responded with ${res.status}`, {
        status: res.status,
        cause: detail,
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!data || typeof data.prediction !== 'string') {
      throw new MlServiceError('ML service returned an unexpected payload');
    }
    return data.prediction;
  }

  async function health() {
    try {
      const res = await fetchImpl(`${base}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) return { up: false, status: res.status };
      return { up: true, data: await res.json().catch(() => ({})) };
    } catch {
      return { up: false };
    }
  }

  return { baseUrl: base, predict, health };
}