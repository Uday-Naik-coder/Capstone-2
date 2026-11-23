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
          userId: req.user?.sub || null,
        });
      } catch {
        // swallow persistence errors
      }
    }

    return res.status(200).json({ prediction });
  };
}

/**
 * GET /api/predictions — list the current user's prediction history, newest
 * first. Returns an empty list (never errors) when persistence is disabled or
 * the database is unavailable.
 */
export function historyController(deps = {}) {
  return async function history(req, res, next) {
    if (!deps.persist || !deps.dbConnected) {
      return res.status(200).json({ items: [] });
    }
    try {
      const items = await Prediction.find({ userId: req.user.sub })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      return res.status(200).json({ items });
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * DELETE /api/predictions/:id — remove one of the current user's predictions.
 * Scoped by userId so a user can only delete their own rows.
 */
export function deletePredictionController(deps = {}) {
  return async function deletePrediction(req, res, next) {
    if (!deps.persist || !deps.dbConnected) {
      return res.status(503).json({ detail: 'History is unavailable' });
    }
    const { id } = req.params;
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({ detail: 'Invalid prediction id' });
    }
    try {
      const removed = await Prediction.findOneAndDelete({
        _id: id,
        userId: req.user.sub,
      });
      if (!removed) {
        return res.status(404).json({ detail: 'Prediction not found' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  };
}