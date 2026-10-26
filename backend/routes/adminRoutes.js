import express from 'express';
import { createStaffUser, getAuditLogs } from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/create-user', authenticateToken, requireRole('admin'), createStaffUser);

export default router;
