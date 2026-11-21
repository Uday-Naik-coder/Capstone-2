import { spawn } from 'node:child_process';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createMlClient } from './services/mlClient.js';
import { createApp } from './app.js';

// ---------------------------------------------------------------------------
// Embedded ML (single-image deployments)
//
// When ML_EMBED=1 the Python model runs as a child process of this server on
// 127.0.0.1:ML_PORT, so one container ships the API, the SPA and the model.
// When ML_EMBED is unset (local dev), the client talks to an external ML
// service via ML_SERVICE_URL exactly as before.
// ---------------------------------------------------------------------------

function mlBaseUrl() {
  if (env.mlEmbed) return `http://127.0.0.1:${env.mlPort}`;
  return env.mlServiceUrl;
}

function startEmbeddedMl() {
  const child = spawn(
    env.mlPython,
    ['-m', 'uvicorn', 'services.ml.main:app', '--host', '127.0.0.1', '--port', String(env.mlPort)],
    {
      cwd: env.mlAppDir,
      env: { ...process.env, PYTHONPATH: env.mlAppDir, PYTHONUNBUFFERED: '1' },
      stdio: 'inherit',
    },
  );
  child.on('exit', (code) => {
    // eslint-disable-next-line no-console
    console.warn(`[backend] embedded ML process exited (code ${code})`);
  });
  child.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[backend] failed to start embedded ML:', err.message);
  });
  return child;
}

async function waitForMl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  let mlChild = null;

  if (env.mlEmbed) {
    const mlUrl = mlBaseUrl();
    // eslint-disable-next-line no-console
    console.log(`[backend] starting embedded ML service at ${mlUrl}`);
    mlChild = startEmbeddedMl();
    const ready = await waitForMl(mlUrl, env.mlStartupTimeoutMs);
    if (ready) {
      // eslint-disable-next-line no-console
      console.log('[backend] embedded ML service is ready');
    } else {
      // eslint-disable-next-line no-console
      console.warn('[backend] embedded ML service not ready in time; predictions may fail until it is up');
    }
  }

  const mlClient = createMlClient({
    baseUrl: mlBaseUrl(),
    timeoutMs: env.mlTimeoutMs,
  });

  let dbConnected = false;
  try {
    const result = await connectDb(env.mongoUri);
    dbConnected = result.connected === true;
    if (!dbConnected) {
      // eslint-disable-next-line no-console
      console.warn(`[backend] MongoDB not connected (${result.reason}); predictions still work`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[backend] MongoDB connection failed; predictions still work:', err.message);
  }

  const app = createApp({ mlClient, dbConnected, persist: true });

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[backend] listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[backend] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      if (mlChild && !mlChild.killed) mlChild.kill('SIGTERM');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[backend] fatal startup error:', err);
  process.exit(1);
});