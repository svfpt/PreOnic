import { Router } from 'express';
import { protect, restrictTo, requireCompleteProfile } from '../middlewares/auth.middleware';
import {
  getProducts,
  getProduct,
  getSimilarProducts,
  getProductsByRegion,
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  getProductReviews,
  addProductReview,
} from '../controllers/product.controller';

const router = Router();

/**
 * @route   GET /api/v1/products
 * @desc    Get all products (with filters: category, region, type, search, page, limit, sort)
 * @access  Public
 */
router.get('/', getProducts);

/**
 * @route   GET /api/v1/products/my
 * @desc    Get current user's products
 * @access  Private
 */
router.get('/my', protect, getMyProducts);

/**
 * @route   GET /api/v1/products/region/:region
 * @desc    Get products by region (north, central, south)
 * @access  Public
 */
router.get('/region/:region', getProductsByRegion);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product by ID
 * @access  Public
 */
router.get('/:id', getProduct);

/**
 * @route   GET /api/v1/products/:id/similar
 * @desc    Get similar products
 * @access  Public
 */
router.get('/:id/similar', getSimilarProducts);

/**
 * @route   GET /api/v1/products/:id/reviews
 * @desc    Get reviews for a product
 * @access  Public
 */
router.get('/:id/reviews', getProductReviews);

/**
 * @route   POST /api/v1/products/:id/reviews
 * @desc    Add a review (Enterprise only)
 * @access  Private
 */
router.post('/:id/reviews', protect, restrictTo('enterprise'), requireCompleteProfile, addProductReview);

/**
 * @route   POST /api/v1/products
 * @desc    Create new product listing
 * @access  Private (Farmer only)
 */
router.post('/', protect, restrictTo('farmer'), requireCompleteProfile, createProduct);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product
 * @access  Private (Owner only)
 */
router.put('/:id', protect, requireCompleteProfile, updateProduct);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Owner only)
 */
router.delete('/:id', protect, deleteProduct);

export default router;
