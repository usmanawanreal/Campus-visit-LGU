import express from 'express';
import * as routeController from '../controllers/routeController.js';
import { protectAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRouteCreate } from '../middleware/validators.js';

const router = express.Router();

router.post('/', protectAdmin, validateRouteCreate, asyncHandler(routeController.create));
router.get('/', asyncHandler(routeController.list));

export default router;
