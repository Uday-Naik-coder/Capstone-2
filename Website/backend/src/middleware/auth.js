import { verifyToken } from '../services/tokenService.js';

function extractBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Requires a valid Bearer JWT. On success sets req.user = { sub, email, name }.
 * Returns 401 otherwise.
 */
export function requireAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ detail: 'Authentication required' });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}

/**
 * Populates req.user when a valid token is present, but never rejects.
 */
export function optionalAuth(req, res, next) {
  const token = extractBearer(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore
    }
  }
  return next();
}