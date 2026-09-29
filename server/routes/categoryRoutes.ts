import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
} from '../controllers/categoryController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getCategories);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);
router.post('/:id/restore', restoreCategory);

export default router;
