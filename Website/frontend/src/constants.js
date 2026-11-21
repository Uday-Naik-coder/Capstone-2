// Field definitions mirroring backend/src/validation/customer.js and
// services/ml/main.py::CustomerData. Keep in sync.

export const CATEGORICAL_FIELDS = [
  { name: 'gender', label: 'Gender', options: ['Female', 'Male'] },
  { name: 'Partner', label: 'Partner', options: ['No', 'Yes'] },
  { name: 'Dependents', label: 'Dependents', options: ['No', 'Yes'] },
  { name: 'PhoneService', label: 'Phone Service', options: ['Yes', 'No'] },
  {
    name: 'MultipleLines',
    label: 'Multiple Lines',
    options: ['No', 'Yes', 'No phone service'],
  },
  {
    name: 'InternetService',
    label: 'Internet Service',
    options: ['No', 'DSL', 'Fiber optic'],
  },
  {
    name: 'OnlineSecurity',
    label: 'Online Security',
    options: ['No internet service', 'Yes', 'No'],
  },
  {
    name: 'OnlineBackup',
    label: 'Online Backup',
    options: ['No internet service', 'Yes', 'No'],
  },
  {
    name: 'DeviceProtection',
    label: 'Device Protection',
    options: ['No internet service', 'Yes', 'No'],
  },
  {
    name: 'TechSupport',
    label: 'Tech Support',
    options: ['No internet service', 'Yes', 'No'],
  },
  {
    name: 'StreamingTV',
    label: 'Streaming TV',
    options: ['No internet service', 'Yes', 'No'],
  },
  {
    name: 'StreamingMovies',
    label: 'Streaming Movies',
    options: ['No internet service', 'Yes', 'No'],
  },
  {
    name: 'Contract',
    label: 'Contract',
    options: ['Month-to-month', 'One year', 'Two year'],
  },
  { name: 'PaperlessBilling', label: 'Paperless Billing', options: ['No', 'Yes'] },
  {
    name: 'PaymentMethod',
    label: 'Payment Method',
    options: [
      'Mailed check',
      'Electronic check',
      'Bank transfer (automatic)',
      'Credit card (automatic)',
    ],
  },
];

export const NUMERIC_FIELDS = [
  { name: 'tenure', label: 'Tenure (months)', min: 0, step: 1 },
  { name: 'MonthlyCharges', label: 'Monthly Charges ($)', min: 0, step: '0.01' },
  { name: 'TotalCharges', label: 'Total Charges ($)', min: 0, step: '0.01' },
];

// Default customer payload (baseline: row 6576, SeniorCitizen = 0).
export const DEFAULT_CUSTOMER = {
  SeniorCitizen: 0,
  gender: 'Female',
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