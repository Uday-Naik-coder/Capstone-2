import { OAuth2Client } from 'google-auth-library';

import { env } from '../config/env.js';

export class GoogleAuthError extends Error {}

let client = null;
function getClient() {
  if (!client) client = new OAuth2Client(env.googleClientId);
  return client;
}

export function googleConfigured() {
  return Boolean(env.googleClientId);
}

/**
 * Verify a Google ID token (credential from Google Identity Services).
 * Returns the verified profile { googleId, email, name, emailVerified }.
 * Throws GoogleAuthError when not configured or the token is invalid.
 */
export async function verifyGoogleCredential(credential) {
  if (!googleConfigured()) {
    throw new GoogleAuthError('Google login is not configured (set GOOGLE_CLIENT_ID)');
  }
  if (!credential || typeof credential !== 'string') {
    throw new GoogleAuthError('Missing Google credential');
  }

  let ticket;
  try {
    ticket = await getClient().verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
  } catch (err) {
    throw new GoogleAuthError(`Invalid Google credential: ${err.message}`);
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new GoogleAuthError('Google credential has no email');
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    emailVerified: Boolean(payload.email_verified),
  };
}