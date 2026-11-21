// Minimal OpenAPI 3 spec for the Telco Churn backend, served at /api/docs.
const customerSchema = {
  type: 'object',
  required: [
    'SeniorCitizen',
    'gender',
    'Partner',
    'Dependents',
    'tenure',
    'PhoneService',
    'PaperlessBilling',
    'MonthlyCharges',
    'TotalCharges',
  ],
  properties: {
    SeniorCitizen: { type: 'integer', enum: [0, 1], description: '0 = no, 1 = yes' },
    gender: { type: 'string', enum: ['Female', 'Male'] },
    Partner: { type: 'string', enum: ['Yes', 'No'] },
    Dependents: { type: 'string', enum: ['Yes', 'No'] },
    tenure: { type: 'integer', minimum: 0, description: 'Months with the company' },
    PhoneService: { type: 'string', enum: ['Yes', 'No'] },
    MultipleLines: { type: 'string', enum: ['Yes', 'No', 'No phone service'] },
    InternetService: { type: 'string', enum: ['DSL', 'Fiber optic', 'No'] },
    OnlineSecurity: { type: 'string', enum: ['Yes', 'No', 'No internet service'] },
    OnlineBackup: { type: 'string', enum: ['Yes', 'No', 'No internet service'] },
    DeviceProtection: { type: 'string', enum: ['Yes', 'No', 'No internet service'] },
    TechSupport: { type: 'string', enum: ['Yes', 'No', 'No internet service'] },
    StreamingTV: { type: 'string', enum: ['Yes', 'No', 'No internet service'] },
    StreamingMovies: { type: 'string', enum: ['Yes', 'No', 'No internet service'] },
    Contract: { type: 'string', enum: ['Month-to-month', 'One year', 'Two year'] },
    PaperlessBilling: { type: 'string', enum: ['Yes', 'No'] },
    PaymentMethod: {
      type: 'string',
      enum: [
        'Electronic check',
        'Mailed check',
        'Bank transfer (automatic)',
        'Credit card (automatic)',
      ],
    },
    MonthlyCharges: { type: 'number', minimum: 0 },
    TotalCharges: { type: 'number', minimum: 0 },
  },
};

const bearer = [{ bearerAuth: [] }];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Telco Churn API',
    version: '1.0.0',
    description:
      'Predicts whether a telco customer is likely to churn. Proxies to a pinned ML model via the Python ML service. Predict routes require a Bearer JWT.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Customer: customerSchema,
      Prediction: {
        type: 'object',
        properties: { prediction: { type: 'string', enum: ['Likely to churn', 'Not likely to churn'] } },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } },
          },
        },
      },
      Error: { type: 'object', properties: { detail: {} } },
    },
  },
  paths: {
    '/api/health': {
      get: { summary: 'Service health', responses: { 200: { description: 'OK' }, 503: { description: 'Degraded' } } },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register with email/password (requires database)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created' }, 409: { description: 'Email taken' }, 503: { description: 'No database' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Login with email/password (database user or configured admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/api/auth/google': {
      post: {
        summary: 'Exchange a Google ID token for an app JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['credential'],
                properties: { credential: { type: 'string', description: 'Google ID token (JWT)' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 401: { description: 'Invalid credential' }, 503: { description: 'Google not configured' } },
      },
    },
    '/api/auth/me': {
      get: { summary: 'Current user (requires auth)', security: bearer, responses: { 200: { description: 'OK' }, 401: { description: 'Unauthorized' } } },
    },
    '/api/predict': {
      post: {
        summary: 'Predict churn (requires auth)',
        security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Customer' } } } },
        responses: {
          200: { description: 'Prediction', content: { 'application/json': { schema: { $ref: '#/components/schemas/Prediction' } } } },
          401: { description: 'Unauthorized' },
          422: { description: 'Validation error' },
          502: { description: 'ML service error' },
          503: { description: 'ML service unavailable' },
        },
      },
    },
  },
};