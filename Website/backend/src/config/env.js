import dotenv from 'dotenv';

dotenv.config();

function intEnv(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: intEnv(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI || '',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  mlTimeoutMs: intEnv(process.env.ML_TIMEOUT_MS, 5000),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Auth
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // Optional email/password login that works without a database (dev/demo).
  adminEmail: process.env.AUTH_ADMIN_EMAIL || '',
  adminPassword: process.env.AUTH_ADMIN_PASSWORD || '',
  requireAuth: boolEnv(process.env.AUTH_REQUIRED, true),
};

export function isProd() {
  return env.nodeEnv === 'production';
}