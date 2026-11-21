import { Router } from 'express';

import { predictionController } from '../controllers/prediction.controller.js';

export function predictRoutes(deps = {}) {
  const router = Router();
  router.post('/', predictionController(deps));
  return router;
}