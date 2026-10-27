import { Router } from 'express';
import { protect, restrictTo, requireCompleteProfile } from '../middlewares/auth.middleware';
import {
  createEscrow,
  deposit,
  farmerConfirm,
  enterpriseConfirm,
  raiseDispute,
  getByContract,
  getEscrow,
  listEscrows,
  listUserDisputes,
  resolveDispute,
  getBalance,
} from '../controllers/escrow.controller';

const router = Router();

// All escrow routes require authentication
router.use(protect);

// ===== BALANCE =====
router.get('/balance', getBalance);

// ===== DISPUTES =====
router.get('/disputes', listUserDisputes);
router.post('/disputes/:id/resolve', restrictTo('admin'), resolveDispute);

// ===== ESCROW CRUD =====
router.post('/', requireCompleteProfile, createEscrow);
router.get('/', listEscrows);
router.get('/contract/:contractId', getByContract);
router.get('/:id', getEscrow);

// ===== ESCROW ACTIONS =====
router.post('/:id/deposit', requireCompleteProfile, deposit);
router.post('/:id/farmer-confirm', requireCompleteProfile, farmerConfirm);
router.post('/:id/enterprise-confirm', requireCompleteProfile, enterpriseConfirm);
router.post('/:id/dispute', requireCompleteProfile, raiseDispute);

export default router;
