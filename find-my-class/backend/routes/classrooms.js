import express from 'express';
import * as classroomController from '../controllers/classroomController.js';
import { protectAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateClassroomCreate, validateClassroomId } from '../middleware/validators.js';

const router = express.Router();

router.post('/', protectAdmin, validateClassroomCreate, asyncHandler(classroomController.create));
router.get('/', asyncHandler(classroomController.list));
router.get('/:roomNumber', asyncHandler(classroomController.getByRoomNumber));
router.delete('/:id', protectAdmin, validateClassroomId, asyncHandler(classroomController.remove));

export default router;
