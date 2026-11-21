import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PredictionResult } from './PredictionResult.jsx';

test('shows the idle prompt before predicting', () => {
  render(<PredictionResult state={{ kind: 'idle' }} />);
  expect(screen.getByText(/Fill in the customer details/i)).toBeInTheDocument();
});

test('shows a loading message while predicting', () => {
  render(<PredictionResult state={{ kind: 'loading' }} />);
  expect(screen.getByText(/Contacting the model/i)).toBeInTheDocument();
});

test('renders an error with the HTTP status and message', () => {
  render(<PredictionResult state={{ kind: 'error', status: 500, error: 'boom' }} />);
  expect(screen.getByText(/Prediction failed \(HTTP 500\)/)).toBeInTheDocument();
  expect(screen.getByText(/boom/)).toBeInTheDocument();
});

test('formats an array validation error', () => {
  render(
    <PredictionResult
      state={{ kind: 'error', status: 422, error: [{ loc: ['SeniorCitizen'], msg: 'must be 0 or 1' }] }}
    />,
  );
  expect(screen.getByText(/SeniorCitizen: must be 0 or 1/)).toBeInTheDocument();
});

test('shows the "Likely to churn" label', () => {
  render(<PredictionResult state={{ kind: 'done', prediction: 'Likely to churn' }} />);
  expect(screen.getByText('Likely to churn')).toBeInTheDocument();
});

test('shows the "Not likely to churn" label', () => {
  render(<PredictionResult state={{ kind: 'done', prediction: 'Not likely to churn' }} />);
  expect(screen.getByText('Not likely to churn')).toBeInTheDocument();
});