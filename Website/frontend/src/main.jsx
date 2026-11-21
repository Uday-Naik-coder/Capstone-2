import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';

import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './index.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let tree = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

// Wrap with GoogleOAuthProvider only when a client ID is configured, so the
// Google button renders and works; otherwise the app runs without it.
if (googleClientId) {
  tree = <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{tree}</React.StrictMode>,
);