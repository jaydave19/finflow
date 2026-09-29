import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  restoreExpense,
  duplicateExpense,
} from '../controllers/expenseController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
router.post('/:id/restore', restoreExpense);
router.post('/:id/duplicate', duplicateExpense);

export default router;
