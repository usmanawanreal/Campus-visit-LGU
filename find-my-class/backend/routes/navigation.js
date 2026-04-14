import express from 'express';
import * as navigationController from '../controllers/navigationController.js';
import * as navigationLocationController from '../controllers/navigationLocationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protectAdmin } from '../middleware/auth.js';
import { validateIdParam } from '../middleware/validate.js';
import {
  validateNavigationRouteQuery,
  validateCorridorHealthQuery,
  validateNavigationLocationQuery,
  validateNavigationLocationCreate
} from '../middleware/validators.js';

const router = express.Router();

router.get('/route', validateNavigationRouteQuery, asyncHandler(navigationController.getRoute));
router.get(
  '/corridor-health',
  validateCorridorHealthQuery,
  asyncHandler(navigationController.getCorridorHealth)
);
router.get('/locations', validateNavigationLocationQuery, asyncHandler(navigationLocationController.list));
router.post('/locations', protectAdmin, validateNavigationLocationCreate, asyncHandler(navigationLocationController.create));
router.put('/locations/:id', protectAdmin, validateIdParam('id'), asyncHandler(navigationLocationController.update));
router.delete('/locations/:id', protectAdmin, validateIdParam('id'), asyncHandler(navigationLocationController.remove));

export default router;
