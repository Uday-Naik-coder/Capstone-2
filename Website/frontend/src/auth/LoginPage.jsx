import { useState } from 'react';

import { useAuth } from './AuthContext.jsx';
import { GoogleLoginButton } from './GoogleLogin.jsx';

const field =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = mode === 'login' ? await login(email, password) : await register(name, email, password);
    setBusy(false);
    if (!res.ok) setError(Array.isArray(res.error) ? res.error.join(', ') : res.error || 'Authentication failed');
  }

  const hasGoogle = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Telco Churn Predictor</h1>
        <p className="mt-1 text-xs text-slate-500">
          {mode === 'login' ? 'Sign in to predict customer churn.' : 'Create an account to get started.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input
              className={field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
            <input
              className={field}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              required
            />
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {hasGoogle && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
            </div>
            <GoogleLoginButton onError={setError} />
          </>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button className="font-semibold text-indigo-600 hover:underline" onClick={() => { setMode('register'); setError(''); }}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="font-semibold text-indigo-600 hover:underline" onClick={() => { setMode('login'); setError(''); }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}