import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import {
  getDashboard,
  getContracts,
  getCrops,
  getOrders,
  getFinances,
} from '../controllers/farmer.controller';

const router = Router();

// All routes are protected and restricted to farmers
router.use(protect);
router.use(restrictTo('farmer'));

/**
 * @route   GET /api/v1/farmer/dashboard
 * @desc    Get farmer dashboard data (stats, recent contracts)
 * @access  Private (Farmer only)
 */
router.get('/dashboard', getDashboard);

/**
 * @route   GET /api/v1/farmer/crops
 * @desc    Get farmer crops/products
 * @access  Private (Farmer only)
 */
router.get('/crops', getCrops);

/**
 * @route   GET /api/v1/farmer/contracts
 * @desc    Get farmer contracts (optional ?status= filter)
 * @access  Private (Farmer only)
 */
router.get('/contracts', getContracts);

/**
 * @route   GET /api/v1/farmer/orders
 * @desc    Get farmer orders (derived from active/completed contracts)
 * @access  Private (Farmer only)
 */
router.get('/orders', getOrders);

/**
 * @route   GET /api/v1/farmer/finances
 * @desc    Get farmer financial data (balance, transactions)
 * @access  Private (Farmer only)
 */
router.get('/finances', getFinances);

export default router;
