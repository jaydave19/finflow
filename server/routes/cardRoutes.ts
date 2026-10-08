import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getCards,
  getCardById,
  createCard,
  updateCard,
  deleteCard,
} from '../controllers/cardController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getCards);
router.get('/:id', getCardById);
router.post('/', createCard);
router.put('/:id', updateCard);
router.delete('/:id', deleteCard);

export default router;
