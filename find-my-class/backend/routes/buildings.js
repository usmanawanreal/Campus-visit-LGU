import express from 'express';
import * as buildingController from '../controllers/buildingController.js';
import { protectAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBuildingCreate, validateBuildingId } from '../middleware/validators.js';

const router = express.Router();

router.post('/', protectAdmin, validateBuildingCreate, asyncHandler(buildingController.create));
router.get('/', asyncHandler(buildingController.list));
router.get('/:id', validateBuildingId, asyncHandler(buildingController.getById));
router.delete('/:id', protectAdmin, validateBuildingId, asyncHandler(buildingController.remove));

export default router;
