import express from 'express';
import * as authController from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateAuthRegister, validateAuthLogin } from '../middleware/validators.js';

const router = express.Router();

router.post('/register', validateAuthRegister, asyncHandler(authController.register));
router.post('/login', validateAuthLogin, asyncHandler(authController.login));

export default router;
