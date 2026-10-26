import express from 'express';
import { 
  getLeaks, 
  getLeakById, 
  createLeak, 
  assignTechnician, 
  updateProgress 
} from '../controllers/leakController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getLeaks);
router.get('/:id', authenticateToken, getLeakById);
router.post('/', authenticateToken, createLeak);
router.post('/:id/assign', authenticateToken, requireRole('admin'), assignTechnician);
router.post('/:id/progress', authenticateToken, requireRole('maintenance', 'admin'), updateProgress);

export default router;
