import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateCustomer } from '../src/validation/customer.js';

const VALID = {
  gender: 'Female',
  SeniorCitizen: 0,
  Partner: 'No',
  Dependents: 'No',
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'No',
  OnlineSecurity: 'No internet service',
  OnlineBackup: 'No internet service',
  DeviceProtection: 'No internet service',
  TechSupport: 'No internet service',
  StreamingTV: 'No internet service',
  StreamingMovies: 'No internet service',
  Contract: 'Month-to-month',
  PaperlessBilling: 'No',
  PaymentMethod: 'Mailed check',
  tenure: 2,
  MonthlyCharges: 20.3,
  TotalCharges: 41.2,
};

test('accepts a valid customer payload', () => {
  const r = validateCustomer(VALID);
  assert.equal(r.valid, true);
  assert.equal(r.value.SeniorCitizen, 0);
  assert.equal(r.value.tenure, 2);
});

test('coerces string SeniorCitizen "1" to number 1', () => {
  const r = validateCustomer({ ...VALID, SeniorCitizen: '1' });
  assert.equal(r.valid, true);
  assert.equal(r.value.SeniorCitizen, 1);
});

test('requires SeniorCitizen', () => {
  const { SeniorCitizen, ...rest } = VALID;
  const r = validateCustomer(rest);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'SeniorCitizen' && e.type === 'missing'));
});

test('rejects invalid SeniorCitizen value', () => {
  const r = validateCustomer({ ...VALID, SeniorCitizen: 2 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'SeniorCitizen'));
});

test('rejects invalid enum value', () => {
  const r = validateCustomer({ ...VALID, Contract: 'Daily' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'Contract' && e.type === 'enum'));
});

test('rejects non-numeric charges', () => {
  const r = validateCustomer({ ...VALID, MonthlyCharges: 'abc' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'MonthlyCharges'));
});

test('rejects negative tenure', () => {
  const r = validateCustomer({ ...VALID, tenure: -1 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'tenure'));
});

test('rejects non-object body', () => {
  const r = validateCustomer('not an object');
  assert.equal(r.valid, false);
});

test('accumulates multiple errors', () => {
  const r = validateCustomer({ SeniorCitizen: 5, Contract: 'Daily' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 2);
});

test('accepts zero boundary values for tenure, MonthlyCharges, and TotalCharges', () => {
  const r = validateCustomer({
    ...VALID,
    tenure: 0,
    MonthlyCharges: 0,
    TotalCharges: 0,
  });
  assert.equal(r.valid, true);
  assert.equal(r.value.tenure, 0);
  assert.equal(r.value.MonthlyCharges, 0);
  assert.equal(r.value.TotalCharges, 0);
});

test('rejects negative TotalCharges', () => {
  const r = validateCustomer({ ...VALID, TotalCharges: -10.5 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'TotalCharges'));
});

test('coerces string SeniorCitizen "0" to number 0', () => {
  const r = validateCustomer({ ...VALID, SeniorCitizen: '0' });
  assert.equal(r.valid, true);
  assert.equal(r.value.SeniorCitizen, 0);
});

test('rejects invalid PaymentMethod enum value', () => {
  const r = validateCustomer({ ...VALID, PaymentMethod: 'Cash' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.loc[0] === 'PaymentMethod' && e.type === 'enum'));
});