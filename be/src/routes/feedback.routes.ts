import { Router } from 'express';
import { protect, requireCompleteProfile } from '../middlewares/auth.middleware';
import { createFeedback, getMyFeedbacks } from '../controllers/feedback.controller';

const router = Router();

router.use(protect);

router.get('/mine', getMyFeedbacks);
router.post('/', requireCompleteProfile, createFeedback);

export default router;
