import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { exportBackup, importBackup } from '../controllers/backupController.ts';

const router = Router();

router.use(requireAuth);
router.get('/export', exportBackup);
router.post('/import', importBackup);

export default router;
