import express from 'express';
import { getNotifications, markNotificationRead } from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getNotifications);
router.patch('/:id/read', authenticateToken, markNotificationRead);

export default router;
