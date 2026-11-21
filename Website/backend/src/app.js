import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { healthRoutes } from './routes/health.routes.js';
import { predictRoutes } from './routes/predict.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { requireAuth } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { openApiSpec } from './docs/openapi.js';

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}