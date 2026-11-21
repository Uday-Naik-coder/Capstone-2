import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

// Lazily resolve a signing secret. In production a missing JWT_SECRET is a hard
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

export function signToken(payload, expiresIn = env.jwtExpiresIn) {
  return jwt.sign(payload, secret(), { expiresIn, algorithm: 'HS256' });
}

export function verifyToken(token) {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] });
}