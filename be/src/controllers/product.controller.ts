import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { ProductService } from '../services/product.service';

/**
 * Get all products (public)
 * GET /api/v1/products
 */
export const getProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { category, region, type, search, page, limit, sort } = req.query;

    const result = await ProductService.getAll({
      category: category as string,
      region: region as string,
      type: type as string,
      search: search as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sort: sort as string,
    });

    res.status(200).json({
      success: true,
      status: 'success',
      data: {
        products: result.products,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  }
);

/**
 * Get single product (public)
 * GET /api/v1/products/:id
 */
export const getProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const product = await ProductService.getById(req.params.id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { product },
    });
  }
);

/**
 * Get similar products (public)
 * GET /api/v1/products/:id/similar
 */
export const getSimilarProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const limit = req.query.limit ? Number(req.query.limit) : 4;
    const products = await ProductService.getSimilar(req.params.id, limit);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { products },
    });
  }
);

/**
 * Get products by region (public)
 * GET /api/v1/products/region/:region
 */
export const getProductsByRegion = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const products = await ProductService.getByRegion(req.params.region);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { products },
    });
  }
);

/**
 * Create product (farmer only)
 * POST /api/v1/products
 */
export const createProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const product = await ProductService.create(
      req.body,
      req.user!.id,
      req.user!.fullName
    );

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Tạo sản phẩm thành công!',
      data: { product },
    });
  }
);

/**
 * Update product (owner only)
 * PUT /api/v1/products/:id
 */
export const updateProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const product = await ProductService.update(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Cập nhật sản phẩm thành công!',
      data: { product },
    });
  }
);

/**
 * Delete product (owner only)
 * DELETE /api/v1/products/:id
 */
export const deleteProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await ProductService.delete(req.params.id, req.user!.id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Xóa sản phẩm thành công!',
    });
  }
);

/**
 * Get my products (farmer)
 * GET /api/v1/products/my
 */
export const getMyProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const products = await ProductService.getByUser(req.user!.id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { products, total: products.length },
    });
  }
);

/**
 * Get reviews for a product
 * GET /api/v1/products/:id/reviews
 */
export const getProductReviews = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const reviews = await ProductService.getReviews(req.params.id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { reviews },
    });
  }
);

/**
 * Add a review for a product (enterprise only)
 * POST /api/v1/products/:id/reviews
 */
export const addProductReview = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { rating, text } = req.body;

    if (!rating || !text) {
      throw new AppError('rating và text là bắt buộc', 400);
    }
    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      throw new AppError('rating phải từ 1 đến 5', 400);
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new AppError('Nội dung đánh giá không được để trống', 400);
    }

    const review = await ProductService.addReview(
      req.params.id,
      req.user!.id,
      req.user!.fullName,
      ratingNum,
      text
    );

    res.status(201).json({
      success: true,
      status: 'success',
      data: { review },
    });
  }
);
