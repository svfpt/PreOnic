import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.middleware';
import {
  getDashboard,
  getContracts,
  getSuppliers,
  getWarehouse,
  getAnalytics,
  getOrders,
} from '../controllers/enterprise.controller';

const router = Router();

// All routes are protected and restricted to enterprises
router.use(protect);
router.use(restrictTo('enterprise'));

/**
 * @route   GET /api/v1/enterprise/dashboard
 * @desc    Get enterprise dashboard data (stats, recent contracts)
 * @access  Private (Enterprise only)
 */
router.get('/dashboard', getDashboard);

/**
 * @route   GET /api/v1/enterprise/suppliers
 * @desc    Get list of suppliers (farmers worked with)
 * @access  Private (Enterprise only)
 */
router.get('/suppliers', getSuppliers);

/**
 * @route   GET /api/v1/enterprise/contracts
 * @desc    Get enterprise contracts (optional ?status= filter)
 * @access  Private (Enterprise only)
 */
router.get('/contracts', getContracts);

/**
 * @route   GET /api/v1/enterprise/warehouse
 * @desc    Get warehouse/inventory data (aggregated from completed contracts)
 * @access  Private (Enterprise only)
 */
router.get('/warehouse', getWarehouse);

/**
 * @route   GET /api/v1/enterprise/analytics
 * @desc    Get enterprise analytics (monthly trends, product distribution)
 * @access  Private (Enterprise only)
 */
router.get('/analytics', getAnalytics);

/**
 * @route   GET /api/v1/enterprise/orders
 * @desc    Get enterprise orders (derived from contracts + escrow milestones)
 * @access  Private (Enterprise only)
 */
router.get('/orders', getOrders);

export default router;
