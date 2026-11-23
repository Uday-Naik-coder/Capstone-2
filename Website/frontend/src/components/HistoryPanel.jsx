import { useCallback, useEffect, useState } from 'react';

import { getHistory, deletePrediction } from '../api.js';

// All customer fields worth surfacing per history row, in display order.
// Mirrors constants.js / backend validation. `format` renders a display value.
const CUSTOMER_FIELDS = [
  { key: 'SeniorCitizen', label: 'Senior Citizen', format: (v) => (Number(v) === 1 ? 'Yes' : 'No') },
  { key: 'gender', label: 'Gender' },
  { key: 'Partner', label: 'Partner' },
  { key: 'Dependents', label: 'Dependents' },
  { key: 'PhoneService', label: 'Phone Service' },
  { key: 'MultipleLines', label: 'Multiple Lines' },
  { key: 'InternetService', label: 'Internet Service' },
  { key: 'OnlineSecurity', label: 'Online Security' },
  { key: 'OnlineBackup', label: 'Online Backup' },
  { key: 'DeviceProtection', label: 'Device Protection' },
  { key: 'TechSupport', label: 'Tech Support' },
  { key: 'StreamingTV', label: 'Streaming TV' },
  { key: 'StreamingMovies', label: 'Streaming Movies' },
  { key: 'Contract', label: 'Contract' },
  { key: 'PaperlessBilling', label: 'Paperless Billing' },
  { key: 'PaymentMethod', label: 'Payment Method' },
  { key: 'tenure', label: 'Tenure', format: (v) => `${v} mo` },
  { key: 'MonthlyCharges', label: 'Monthly Charges', format: (v) => `$${v}` },
  { key: 'TotalCharges', label: 'Total Charges', format: (v) => `$${v}` },
];

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

// Returns every present customer field as { label, value } in display order.
function customerFields(customer) {
  if (!customer || typeof customer !== 'object') return [];
  return CUSTOMER_FIELDS.filter(
    (f) => customer[f.key] !== undefined && customer[f.key] !== null && customer[f.key] !== '',
  ).map((f) => ({
    label: f.label,
    value: f.format ? f.format(customer[f.key]) : String(customer[f.key]),
  }));
}

export function HistoryPanel() {
  const [state, setState] = useState({ kind: 'loading' }); // loading | ready | error
  const [items, setItems] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const res = await getHistory();
    if (res.ok) {
      setItems(res.items);
      setState({ kind: 'ready' });
    } else {
      setState({ kind: 'error', status: res.status, error: res.error });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(id) {
    setDeletingId(id);
    const res = await deletePrediction(id);
    setDeletingId(null);
    if (res.ok) {
      setItems((prev) => prev.filter((it) => it._id !== id));
    } else {
      // Surface the failure without discarding the list.
      setState((prev) => ({ ...prev, error: res.error }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Prediction history</h2>
          <p className="text-xs text-slate-500">
            Every prediction you run is saved here. Newest first.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={state.kind === 'loading'}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {state.kind === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {state.kind === 'loading' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Loading history…
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Could not load history{state.status ? ` (HTTP ${state.status})` : ''}
          </p>
          {state.error && <p className="mt-1 text-sm text-red-600">{String(state.error)}</p>}
        </div>
      )}

      {state.kind === 'ready' && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No predictions yet. Run one from the <strong>Predict</strong> tab and it will appear here.
        </div>
      )}

      {state.kind === 'ready' && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((it) => {
            const likely = it.prediction === 'Likely to churn';
            const fields = customerFields(it.customer);
            return (
              <li
                key={it._id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        likely
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {it.prediction}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(it.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(it._id)}
                    disabled={deletingId === it._id}
                    className="shrink-0 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === it._id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>

                {fields.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                    {fields.map((s) => (
                      <div key={s.label}>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                          {s.label}
                        </dt>
                        <dd className="text-sm text-slate-700">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}