import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { getProfile, updateProfile, updateSettings, deleteAccount } from '../controllers/userController.ts';

const router = Router();

router.use(requireAuth);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/settings', updateSettings);
router.delete('/', deleteAccount);

export default router;
