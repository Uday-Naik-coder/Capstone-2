/**
 * Request validation mirroring services/ml/main.py::CustomerData.
 *
 * The Python ML service (Pydantic) is the final authority; this module gives the
 * Node backend fast, structured 422 errors that match the ML contract without a
 * network round-trip. Keep the allowed values in sync with the ML service.
 */

const ENUM_FIELDS = {
  gender: ['Male', 'Female'],
  Partner: ['Yes', 'No'],
  Dependents: ['Yes', 'No'],
  PhoneService: ['Yes', 'No'],
  MultipleLines: ['Yes', 'No', 'No phone service'],
  InternetService: ['DSL', 'Fiber optic', 'No'],
  OnlineSecurity: ['Yes', 'No', 'No internet service'],
  OnlineBackup: ['Yes', 'No', 'No internet service'],
  DeviceProtection: ['Yes', 'No', 'No internet service'],
  TechSupport: ['Yes', 'No', 'No internet service'],
  StreamingTV: ['Yes', 'No', 'No internet service'],
  StreamingMovies: ['Yes', 'No', 'No internet service'],
  Contract: ['Month-to-month', 'One year', 'Two year'],
  PaperlessBilling: ['Yes', 'No'],
  PaymentMethod: [
    'Electronic check',
    'Mailed check',
    'Bank transfer (automatic)',
    'Credit card (automatic)',
  ],
};

const NUMERIC_FIELDS = ['tenure', 'MonthlyCharges', 'TotalCharges'];

/**
 * @param {unknown} input
 * @returns {{ valid: boolean, value?: object, errors: Array<{loc:string[], msg:string, type:string}> }}
 */
export function validateCustomer(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: [{ loc: ['body'], msg: 'Request body must be a JSON object', type: 'object' }],
    };
  }

  const errors = [];
  const value = {};

  // SeniorCitizen: required, integer 0 or 1 (accepts "0"/"1" from form data).
  const sc = input.SeniorCitizen;
  if (sc === undefined || sc === null || sc === '') {
    errors.push({ loc: ['SeniorCitizen'], msg: 'Field required', type: 'missing' });
  } else if (sc === 0 || sc === 1 || sc === '0' || sc === '1') {
    value.SeniorCitizen = Number(sc);
  } else {
    errors.push({ loc: ['SeniorCitizen'], msg: 'Must be 0 or 1', type: 'enum' });
  }

  // Categorical (Literal) fields.
  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    const v = input[field];
    if (v === undefined || v === null || v === '') {
      errors.push({ loc: [field], msg: 'Field required', type: 'missing' });
      continue;
    }
    if (!allowed.includes(v)) {
      errors.push({
        loc: [field],
        msg: `Must be one of: ${allowed.join(', ')}`,
        type: 'enum',
      });
      continue;
    }
    value[field] = v;
  }

  // Numeric fields. tenure must be a non-negative integer; charges non-negative.
  for (const field of NUMERIC_FIELDS) {
    const v = input[field];
    if (v === undefined || v === null || v === '') {
      errors.push({ loc: [field], msg: 'Field required', type: 'missing' });
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
      errors.push({ loc: [field], msg: 'Must be a number', type: 'number' });
      continue;
    }
    if (n < 0) {
      errors.push({ loc: [field], msg: 'Must be >= 0', type: 'number' });
      continue;
    }
    if (field === 'tenure' && !Number.isInteger(n)) {
      errors.push({ loc: [field], msg: 'Must be an integer', type: 'integer' });
      continue;
    }
    value[field] = n;
  }

  return { valid: errors.length === 0, value, errors };
}