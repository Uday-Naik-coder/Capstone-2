import { Router } from 'express';

import {
  historyController,
  deletePredictionController,
} from '../controllers/prediction.controller.js';
import { requireAuth } from '../middleware/auth.js';

export function historyRoutes(deps = {}) {
  const router = Router();
  // History is always user-scoped, so these routes require auth even when
  // AUTH_REQUIRED is disabled for /api/predict.
  router.get('/', requireAuth, historyController(deps));
  router.delete('/:id', requireAuth, deletePredictionController(deps));
  return router;
}