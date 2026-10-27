import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  createTopup,
  verifyTopup,
  handleWebhook,
  demoTopup,
  getWalletInfo,
  getTransactions,
  cancelTopup,
} from '../controllers/payment.controller';
import {
  createWithdrawal,
  getMyWithdrawals,
} from '../controllers/withdrawal.controller';

const router = Router();

// Payment gateway webhook — no auth required
router.post('/webhook', handleWebhook);

// All other routes require authentication
router.use(protect);

router.get('/wallet', getWalletInfo);
router.get('/transactions', getTransactions);
router.post('/topup', createTopup);
router.post('/topup/verify', verifyTopup);
router.post('/demo-topup', demoTopup);
router.post('/cancel', cancelTopup);

// Rút tiền (user)
router.get('/withdrawals', getMyWithdrawals);
router.post('/withdrawals', createWithdrawal);

export default router;
