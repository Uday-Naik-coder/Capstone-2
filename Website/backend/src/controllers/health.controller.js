import { dbState } from '../config/db.js';

export function healthController(deps = {}) {
  const ml = deps.mlClient;
  return async function health(req, res) {
    const mlHealth = ml ? await ml.health() : { up: false };
    const healthy = mlHealth.up === true;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      database: dbState(),
      ml: mlHealth,
    });
  };
}