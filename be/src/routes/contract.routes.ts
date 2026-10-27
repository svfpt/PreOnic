import { Router } from 'express';
import { protect, requireCompleteProfile } from '../middlewares/auth.middleware';
import {
  createContract,
  getContract,
  listContracts,
  requestSignOtp,
  signContract,
  cancelContract,
  rejectContract,
} from '../controllers/contract.controller';

const router = Router();

// All contract routes require authentication
router.use(protect);

// ===== CONTRACT CRUD =====
router.post('/', requireCompleteProfile, createContract);
router.get('/', listContracts);
router.get('/:id', getContract);
router.post('/:id/request-sign-otp', requireCompleteProfile, requestSignOtp);
router.post('/:id/sign', requireCompleteProfile, signContract);
router.post('/:id/cancel', cancelContract);
router.post('/:id/reject', rejectContract);

export default router;
