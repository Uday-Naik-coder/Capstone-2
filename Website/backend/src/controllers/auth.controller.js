import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/tokenService.js';
import { verifyGoogleCredential, googleConfigured, GoogleAuthError } from '../services/googleAuth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issue(user) {
  const payload = { sub: user.id, email: user.email, name: user.name };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, provider: user.provider },
  };
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // still do a comparison to reduce timing signal
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export async function register(req, res, next) {
  try {
    const { name = '', email, password } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(422).json({ detail: 'A valid email is required' });
    }
    if (!password || String(password).length < 8) {
      return res.status(422).json({ detail: 'Password must be at least 8 characters' });
    }
    if (!isDbConnected()) {
      return res.status(503).json({ detail: 'Registration requires a database connection' });
    }
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      return res.status(409).json({ detail: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      passwordHash,
      provider: 'local',
    });
    return res.status(201).json(issue(user));
  } catch (err) {
    return next(err);
  }
}

function isDbConnected() {
  // eslint-disable-next-line global-require
  const mongoose = User.base;
  return mongoose?.connection?.readyState === 1;
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(422).json({ detail: 'Email and password are required' });
    }
    const mail = String(email).toLowerCase();

    // Database-backed users
    if (isDbConnected()) {
      const user = await User.findOne({ email: mail });
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(String(password), user.passwordHash);
        if (ok) return res.status(200).json(issue(user));
      }
    }

    // Env admin fallback (no database required). Read live so tests can set
    // these without import-order concerns.
    const adminEmail = process.env.AUTH_ADMIN_EMAIL || env.adminEmail;
    const adminPassword = process.env.AUTH_ADMIN_PASSWORD || env.adminPassword;
    if (adminEmail && adminPassword && timingSafeEqualStr(mail, String(adminEmail).toLowerCase()) && timingSafeEqualStr(String(password), adminPassword)) {
      const user = {
        id: 'admin',
        email: mail,
        name: 'Administrator',
        provider: 'admin',
        toPublic() {
          return { id: 'admin', email: this.email, name: this.name, provider: 'admin' };
        },
      };
      return res.status(200).json(issue(user));
    }

    return res.status(401).json({ detail: 'Invalid credentials' });
  } catch (err) {
    return next(err);
  }
}

export async function google(req, res, next) {
  try {
    const credential = req.body?.credential || req.body?.idToken;
    let profile;
    try {
      profile = await verifyGoogleCredential(credential);
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        const status = googleConfigured() ? 401 : 503;
        return res.status(status).json({ detail: err.message });
      }
      throw err;
    }

    // Persist/upsert when a database is available; otherwise issue a stateless token.
    if (isDbConnected()) {
      let user = await User.findOne({ email: profile.email });
      if (user) {
        if (!user.googleId) {
          user.googleId = profile.googleId;
          user.provider = 'google';
          await user.save();
        }
      } else {
        user = await User.create({
          name: profile.name,
          email: profile.email,
          googleId: profile.googleId,
          provider: 'google',
        });
      }
      return res.status(200).json(issue(user));
    }

    const user = {
      id: profile.googleId,
      email: profile.email,
      name: profile.name,
      provider: 'google',
      toPublic() {
        return { id: this.id, email: this.email, name: this.name, provider: 'google' };
      },
    };
    return res.status(200).json(issue(user));
  } catch (err) {
    return next(err);
  }
}

export function me(req, res) {
  const { sub, email, name } = req.user || {};
  return res.status(200).json({ user: { id: sub, email, name } });
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(422).json({ detail: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ detail: 'Invalid or expired refresh token' });
    }

    const { sub, email, name } = decoded;

    if (isDbConnected() && sub !== 'admin') {
      const user = await User.findById(sub);
      if (!user) {
        return res.status(401).json({ detail: 'User not found' });
      }
      return res.status(200).json(issue(user));
    }

    const user = {
      id: sub,
      email,
      name,
      provider: sub === 'admin' ? 'admin' : 'local',
      toPublic() {
        return { id: this.id, email: this.email, name: this.name, provider: this.provider };
      },
    };
    return res.status(200).json(issue(user));
  } catch (err) {
    return next(err);
  }
}