import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  createTopup,
  verifyTopup,
  handleWebhook,
  getWalletInfo,
  getTransactions,
  cancelTopup,
} from '../controllers/payment.controller';
import {
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalBanks,
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
router.post('/cancel', cancelTopup);

// Rút tiền (user)
router.get('/withdrawals', getMyWithdrawals);
router.get('/withdrawals/banks', getWithdrawalBanks);
router.post('/withdrawals', createWithdrawal);

export default router;
