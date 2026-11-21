import { GoogleLogin } from '@react-oauth/google';

import { useAuth } from './AuthContext.jsx';

// Renders the Google sign-in button only when a client ID is configured.
export function GoogleLoginButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) return null;

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          const res = await loginWithGoogle(credentialResponse.credential);
          if (!res.ok && onError) onError(res.error || 'Google sign-in failed');
        }}
        onError={() => onError && onError('Google sign-in was cancelled or failed')}
        useOneTap={false}
      />
    </div>
  );
}