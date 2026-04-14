import express from 'express';
import * as nodeController from '../controllers/nodeController.js';
import { protectAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateNodeCreate, validateNodeId } from '../middleware/validators.js';

const router = express.Router();

router.post('/', protectAdmin, validateNodeCreate, asyncHandler(nodeController.create));
router.get('/', asyncHandler(nodeController.list));
router.get('/:id', validateNodeId, asyncHandler(nodeController.getById));
router.put('/:id', protectAdmin, validateNodeId, validateNodeCreate, asyncHandler(nodeController.update));
router.delete('/:id', protectAdmin, validateNodeId, asyncHandler(nodeController.remove));

export default router;
