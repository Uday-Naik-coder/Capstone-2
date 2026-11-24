import { Router } from 'express';

import { register, login, google, me, refresh } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export function authRoutes() {
  const router = Router();
  router.post('/register', register);
  router.post('/login', login);
  router.post('/google', google);
  router.post('/refresh', refresh);
  router.get('/me', requireAuth, me);
  return router;
}