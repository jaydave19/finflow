import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { getBudgets, setBudget } from '../controllers/budgetController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getBudgets);
router.put('/', setBudget);

export default router;
