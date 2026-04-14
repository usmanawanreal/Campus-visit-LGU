import express from 'express';
import * as locationController from '../controllers/locationController.js';
import { protectAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateLocationCreate, validateLocationId } from '../middleware/validators.js';

const router = express.Router();

router.post('/', protectAdmin, validateLocationCreate, asyncHandler(locationController.create));
router.get('/search', asyncHandler(locationController.search));
router.get('/', asyncHandler(locationController.list));
router.delete('/:id', protectAdmin, validateLocationId, asyncHandler(locationController.remove));

export default router;
