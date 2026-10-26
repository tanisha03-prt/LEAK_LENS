import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import leakRoutes from './leakRoutes.js';
import buildingRoutes from './buildingRoutes.js';
import userRoutes from './userRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import statusRoutes from './statusRoutes.js';
import { getAuditLogs } from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/leaks', leakRoutes);
router.use('/buildings', buildingRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/status', statusRoutes);

// Direct alias for audit logs
router.get('/audit-logs', authenticateToken, requireRole('admin'), getAuditLogs);

export default router;
