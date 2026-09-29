import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { getMonthlyReport, getInsights, exportReport } from '../controllers/reportController.ts';

const router = Router();

router.use(requireAuth);
router.get('/monthly', getMonthlyReport);
router.get('/insights', getInsights);
router.get('/export', exportReport);

export default router;
