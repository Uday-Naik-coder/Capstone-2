import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createMlClient } from './services/mlClient.js';
import { createApp } from './app.js';

async function main() {
  const mlClient = createMlClient({
    baseUrl: env.mlServiceUrl,
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