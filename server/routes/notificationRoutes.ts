import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from '../controllers/notificationController.ts';

const router = Router();

router.use(requireAuth);
router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/', clearNotifications);

export default router;
