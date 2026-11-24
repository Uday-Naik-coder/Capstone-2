import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

// Lazily resolve signing secrets. In production a missing JWT_SECRET is a hard
// error; in development we fall back to a random per-process secret (tokens then
// do not survive a restart, which is acceptable for local use).
let fallbackSecret = null;
function secret() {
  const live = process.env.JWT_SECRET || env.jwtSecret;
  if (live) return live;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  return fallbackSecret;
}

let fallbackRefreshSecret = null;
function refreshSecret() {
  const live = process.env.JWT_REFRESH_SECRET || env.jwtRefreshSecret;
  if (live) return live;
  // If no explicit refresh secret is configured, derive from the base secret
  const base = secret();
  if (base) return crypto.createHmac('sha256', base).update('telco-refresh-token-salt').digest('hex');
  if (!fallbackRefreshSecret) {
    fallbackRefreshSecret = crypto.randomBytes(32).toString('hex');
  }
  return fallbackRefreshSecret;
}

export function signAccessToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || env.jwtExpiresIn) {
  return jwt.sign({ ...payload, type: 'access' }, secret(), { expiresIn, algorithm: 'HS256' });
}

export function signRefreshToken(payload, expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || env.jwtRefreshExpiresIn) {
  return jwt.sign({ ...payload, type: 'refresh' }, refreshSecret(), { expiresIn, algorithm: 'HS256' });
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, secret(), { algorithms: ['HS256'] });
  if (decoded.type && decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, refreshSecret(), { algorithms: ['HS256'] });
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type for refresh');
  }
  return decoded;
}

// Backward-compatible aliases
export const signToken = signAccessToken;
export const verifyToken = verifyAccessToken;
