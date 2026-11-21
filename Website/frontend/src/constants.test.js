import { test, expect } from 'vitest';

import {
  CATEGORICAL_FIELDS,
  NUMERIC_FIELDS,
  DEFAULT_CUSTOMER,
} from './constants.js';

test('DEFAULT_CUSTOMER is the row-6576 baseline with SeniorCitizen = 0', () => {
  expect(DEFAULT_CUSTOMER.SeniorCitizen).toBe(0);
});

test('DEFAULT_CUSTOMER exposes the full 19-field contract', () => {
  // 15 categorical + 3 numeric + SeniorCitizen = 19 fields sent to /api/predict.
  expect(Object.keys(DEFAULT_CUSTOMER)).toHaveLength(19);
  expect(CATEGORICAL_FIELDS).toHaveLength(15);
  expect(NUMERIC_FIELDS).toHaveLength(3);
});

test('every categorical/numeric field has a default value', () => {
  for (const f of CATEGORICAL_FIELDS) {
    expect(DEFAULT_CUSTOMER).toHaveProperty(f.name);
  }
  for (const f of NUMERIC_FIELDS) {
    expect(DEFAULT_CUSTOMER).toHaveProperty(f.name);
  }
});