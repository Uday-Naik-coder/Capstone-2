import { OAuth2Client } from 'google-auth-library';

import { env } from '../config/env.js';

export class GoogleAuthError extends Error {}

let client = null;

// Resolve the client ID live (prefer a runtime override), mirroring how
// tokenService reads JWT_SECRET. This keeps config testable and lets an empty
// value explicitly disable Google login regardless of what was baked at import.
function clientId() {
  return process.env.GOOGLE_CLIENT_ID !== undefined
    ? process.env.GOOGLE_CLIENT_ID
    : env.googleClientId;
}

function getClient() {
  if (!client) client = new OAuth2Client(clientId());
  return client;
}

export function googleConfigured() {
  return Boolean(clientId());
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
      audience: clientId(),
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