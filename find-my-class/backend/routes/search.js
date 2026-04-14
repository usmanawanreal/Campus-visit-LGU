import express from 'express';
import * as searchController from '../controllers/searchController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.get('/classrooms', asyncHandler(searchController.searchClassrooms));
router.get('/buildings', asyncHandler(searchController.searchBuildings));

export default router;
