import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { healthRoutes } from './routes/health.routes.js';
import { predictRoutes } from './routes/predict.routes.js';
import { historyRoutes } from './routes/history.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { requireAuth } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { openApiSpec } from './docs/openapi.js';

// Directory containing the built React SPA (single-image deployments). In dev
// this folder usually does not exist, so static serving is skipped and the API
// behaves exactly as before.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : path.resolve(__dirname, '..', 'public');
const SPA_INDEX = path.join(PUBLIC_DIR, 'index.html');
const HAS_SPA = fs.existsSync(SPA_INDEX);

export function createApp({
  mlClient = null,
  dbConnected = false,
  persist = true,
  // When true, /api/predict requires a Bearer JWT. Defaults to AUTH_REQUIRED env.
  authRequired = env.requireAuth,
} = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  const deps = { mlClient, dbConnected, persist };

  // Public
  app.use('/api/health', healthRoutes(deps));
  app.use('/api/auth', authRoutes(deps));

  // API docs (Swagger UI)
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Telco Churn API Docs' }));
  app.get('/api/openapi.json', (req, res) => res.json(openApiSpec));

  // Protected
  const gate = authRequired ? requireAuth : (req, res, next) => next();
  app.use('/api/predict', gate, predictRoutes(deps));

  // Prediction history (always auth-scoped; each route enforces requireAuth).
  app.use('/api/predictions', historyRoutes(deps));

  // Static SPA (single-image deployments): serve the built React app and fall
  // back to index.html for client-side routes. API routes above always win.
  if (HAS_SPA) {
    app.use(express.static(PUBLIC_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      return res.sendFile(SPA_INDEX, (err) => {
        if (err) next();
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}