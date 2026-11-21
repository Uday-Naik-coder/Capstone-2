function formatError(error) {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) {
    return error
      .map((e) => {
        const loc = Array.isArray(e.loc) ? e.loc.join('.') : '';
        return `${loc ? loc + ': ' : ''}${e.msg}`;
      })
      .join(' · ');
  }
  return JSON.stringify(error);
}

export function PredictionResult({ state }) {
  if (state.kind === 'idle') {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Fill in the customer details and click <strong>Predict churn</strong>.
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Contacting the model…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-700">
          Prediction failed{state.status ? ` (HTTP ${state.status})` : ''}
        </p>
        <p className="mt-1 text-sm text-red-600">{formatError(state.error)}</p>
      </div>
    );
  }

  const likely = state.prediction === 'Likely to churn';
  return (
    <div
      className={`rounded-xl border p-5 ${
        likely ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Prediction
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          likely ? 'text-red-700' : 'text-emerald-700'
        }`}
      >
        {state.prediction}
      </p>
    </div>
  );
}