import express from 'express';
import { registerResident, login, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerResident);
router.post('/register-resident', registerResident);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);

export default router;
