import express from 'express';
import * as edgeController from '../controllers/edgeController.js';
import { protectAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateEdgeCreate, validateEdgeId } from '../middleware/validators.js';

const router = express.Router();

router.post('/', protectAdmin, validateEdgeCreate, asyncHandler(edgeController.create));
router.get('/', asyncHandler(edgeController.list));
router.get('/:id', validateEdgeId, asyncHandler(edgeController.getById));
router.put('/:id', protectAdmin, validateEdgeId, validateEdgeCreate, asyncHandler(edgeController.update));
router.delete('/:id', protectAdmin, validateEdgeId, asyncHandler(edgeController.remove));

export default router;
