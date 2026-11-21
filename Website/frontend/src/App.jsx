import { useEffect, useState } from 'react';

import { getHealth } from './api.js';
import { CustomerForm } from './components/CustomerForm.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';

function HealthBadge() {
  const [status, setStatus] = useState('checking'); // checking | ok | down

  useEffect(() => {
    let alive = true;
    getHealth().then((res) => {
      if (!alive) return;
      setStatus(res.ok && res.body?.status === 'ok' ? 'ok' : 'down');
    });
    return () => {
      alive = false;
    };
  }, []);

  const map = {
    checking: { text: 'Backend: checking…', cls: 'bg-slate-100 text-slate-600' },
    ok: { text: 'Backend: online', cls: 'bg-emerald-100 text-emerald-700' },
    down: { text: 'Backend: offline', cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.text}</span>
  );
}

function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Telco Churn Predictor</h1>
            <p className="text-xs text-slate-500">
              Predict whether a customer is likely to churn.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <HealthBadge />
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="hidden text-xs text-slate-600 sm:inline">{user?.email}</span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        <CustomerForm />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  );
}