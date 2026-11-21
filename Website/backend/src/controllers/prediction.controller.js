import { Prediction } from '../models/Prediction.js';
import { validateCustomer } from '../validation/customer.js';
import { MlServiceError } from '../services/mlClient.js';

export function predictionController(deps = {}) {
  const ml = deps.mlClient;
  return async function predict(req, res, next) {
    const { valid, value, errors } = validateCustomer(req.body);
    if (!valid) {
      return res.status(422).json({ detail: errors });
    }

    let prediction;
    try {
      prediction = await ml.predict(value);
    } catch (err) {
      if (err instanceof MlServiceError) {
        return res
          .status(err.status >= 500 && err.status <= 599 ? 503 : 502)
          .json({ detail: err.message });
      }
      return next(err);
    }

    // Persist best-effort; never block a prediction on the database.
    if (deps.persist && deps.dbConnected) {
      try {
        await Prediction.create({
          prediction,
          model: ml.modelId || null,
          customer: value,
        });
      } catch {
        // swallow persistence errors
      }
    }

    return res.status(200).json({ prediction });
  };
}