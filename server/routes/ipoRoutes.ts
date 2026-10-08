import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getIpos,
  getIpoById,
  createIpo,
  updateIpo,
  deleteIpo,
  restoreIpo,
} from '../controllers/ipoController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getIpos);
router.get('/:id', getIpoById);
router.post('/', createIpo);
router.put('/:id', updateIpo);
router.delete('/:id', deleteIpo);
router.post('/:id/restore', restoreIpo);

export default router;
