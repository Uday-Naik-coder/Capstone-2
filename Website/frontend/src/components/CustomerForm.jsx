import { useState } from 'react';

import { predict } from '../api.js';
import {
  CATEGORICAL_FIELDS,
  NUMERIC_FIELDS,
  DEFAULT_CUSTOMER,
} from '../constants.js';
import { Field, Select, NumberInput } from './Field.jsx';
import { PredictionResult } from './PredictionResult.jsx';

export function CustomerForm() {
  const [customer, setCustomer] = useState(DEFAULT_CUSTOMER);
  const [state, setState] = useState({ kind: 'idle' }); // idle | loading | done | error

  function update(name, raw) {
    setState({ kind: 'idle' });
    setCustomer((prev) => {
      let value = raw;
      if (name === 'SeniorCitizen') value = Number(raw);
      else if (NUMERIC_FIELDS.some((f) => f.name === name)) {
        value = raw === '' ? '' : Number(raw);
      }
      return { ...prev, [name]: value };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setState({ kind: 'loading' });
    const res = await predict(customer);
    if (res.ok) setState({ kind: 'done', prediction: res.prediction });
    else setState({ kind: 'error', status: res.status, error: res.error });
  }

  function reset() {
    setCustomer(DEFAULT_CUSTOMER);
    setState({ kind: 'idle' });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Senior Citizen" htmlFor="SeniorCitizen" hint="0 = no, 1 = yes">
          <Select
            id="SeniorCitizen"
            value={String(customer.SeniorCitizen)}
            options={[
              { value: '0', label: '0 — No' },
              { value: '1', label: '1 — Yes' },
            ]}
            onChange={(v) => update('SeniorCitizen', v)}
          />
        </Field>

        {CATEGORICAL_FIELDS.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={f.name}>
            <Select
              id={f.name}
              value={customer[f.name]}
              options={f.options}
              onChange={(v) => update(f.name, v)}
            />
          </Field>
        ))}

        {NUMERIC_FIELDS.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={f.name}>
            <NumberInput
              id={f.name}
              value={customer[f.name]}
              min={f.min}
              step={f.step}
              onChange={(v) => update(f.name, v)}
            />
          </Field>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={state.kind === 'loading'}
          className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
        >
          {state.kind === 'loading' ? 'Predicting…' : 'Predict churn'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-6">
        <PredictionResult state={state} />
      </div>
    </form>
  );
}