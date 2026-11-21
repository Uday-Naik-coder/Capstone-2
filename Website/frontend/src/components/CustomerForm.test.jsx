import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { CustomerForm } from './CustomerForm.jsx';
import { predict } from '../api.js';

// Mock the API client so the form logic is tested without a network call.
vi.mock('../api.js', () => ({ predict: vi.fn() }));

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /predict churn/i }));
}

beforeEach(() => {
  predict.mockReset();
});

test('renders the Senior Citizen field and the submit button', () => {
  render(<CustomerForm />);
  expect(screen.getByLabelText(/Senior Citizen/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /predict churn/i })).toBeInTheDocument();
});

test('submits the default payload (SeniorCitizen = 0) and renders the result', async () => {
  predict.mockResolvedValue({ ok: true, prediction: 'Not likely to churn' });
  render(<CustomerForm />);

  submit();

  await waitFor(() => expect(predict).toHaveBeenCalledTimes(1));
  expect(predict.mock.calls[0][0].SeniorCitizen).toBe(0);
  expect(await screen.findByText('Not likely to churn')).toBeInTheDocument();
});

test('flips SeniorCitizen to 1 and sends it as a number', async () => {
  predict.mockResolvedValue({ ok: true, prediction: 'Likely to churn' });
  render(<CustomerForm />);

  fireEvent.change(screen.getByLabelText(/Senior Citizen/i), { target: { value: '1' } });
  submit();

  await waitFor(() => expect(predict).toHaveBeenCalledTimes(1));
  expect(predict.mock.calls[0][0].SeniorCitizen).toBe(1);
  expect(await screen.findByText('Likely to churn')).toBeInTheDocument();
});

test('shows an error message when prediction fails', async () => {
  predict.mockResolvedValue({ ok: false, status: 503, error: 'ML service unavailable' });
  render(<CustomerForm />);

  submit();

  expect(await screen.findByText(/Prediction failed \(HTTP 503\)/)).toBeInTheDocument();
  expect(screen.getByText(/ML service unavailable/)).toBeInTheDocument();
});

test('Reset restores the default payload after an edit', async () => {
  predict.mockResolvedValue({ ok: true, prediction: 'Not likely to churn' });
  render(<CustomerForm />);

  fireEvent.change(screen.getByLabelText(/Senior Citizen/i), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: /reset/i }));
  expect(screen.getByLabelText(/Senior Citizen/i).value).toBe('0');

  submit();
  await waitFor(() => expect(predict).toHaveBeenCalledTimes(1));
  expect(predict.mock.calls[0][0].SeniorCitizen).toBe(0);
});