import { Router } from 'express';

import { healthController } from '../controllers/health.controller.js';

export function healthRoutes(deps = {}) {
  const router = Router();
  router.get('/', healthController(deps));
  return router;
}