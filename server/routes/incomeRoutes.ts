import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getIncomes,
  createIncome,
  updateIncome,
  deleteIncome,
  restoreIncome,
} from '../controllers/incomeController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getIncomes);
router.post('/', createIncome);
router.put('/:id', updateIncome);
router.delete('/:id', deleteIncome);
router.post('/:id/restore', restoreIncome);

export default router;
