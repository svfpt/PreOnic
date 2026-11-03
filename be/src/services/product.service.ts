import Product, { IProduct } from '../models/Product.model';
import Review, { IReview } from '../models/Review.model';
import { AppError } from '../middlewares/error.middleware';
import { PRODUCT_CONFIG } from '../constants';

export interface CreateProductBody {
  name: string;
  location: string;
  farm: string;
  image: string;
  priceMin: number;
  priceMax: number;
  unit?: string;
  expectedDate?: string;
  progress?: number;
  remaining?: number;
  totalQuantity?: number;
  note?: string;
  badge?: string;
  category: string;
  region: string;
  type?: string;
  description?: string;
  nutritionInfo?: string;
  certifications?: string[];
  commitments?: string[];
  seller?: {
    name: string;
    avatar: string;
    rating?: number;
    totalContracts?: number;
  };
}

type ProductFilters = {
  category?: string;
  region?: string;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
};

type ProductSortOption = {
  createdAt?: 1 | -1;
  priceMin?: 1 | -1;
  priceMax?: 1 | -1;
  rating?: 1 | -1;
  name?: 1 | -1;
};

const PRODUCT_SORT_OPTIONS: Record<string, ProductSortOption> = {
  default: { createdAt: -1 },
  price_asc: { priceMin: 1 },
  price_desc: { priceMax: -1 },
  rating: { rating: -1 },
  name: { name: 1 },
};

const PRODUCT_UPDATE_FIELDS: Array<keyof CreateProductBody> = [
  'name',
  'location',
  'farm',
  'image',
  'priceMin',
  'priceMax',
  'unit',
  'expectedDate',
  'progress',
  'remaining',
  'totalQuantity',
  'note',
  'badge',
  'category',
  'region',
  'type',
  'description',
  'nutritionInfo',
  'certifications',
  'commitments',
];

export class ProductService {
  // Khối helper này giữ cho các hàm public bên dưới chỉ còn đúng trách nhiệm điều phối luồng nghiệp vụ.
  private static buildQuery(filters: ProductFilters) {
    const query: Record<string, unknown> = { isActive: true };

    if (filters.category) query.category = filters.category;
    if (filters.region) query.region = filters.region;
    if (filters.type) query.type = filters.type;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { location: { $regex: filters.search, $options: 'i' } },
        { farm: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return query;
  }

  private static buildSortOption(sort?: string): ProductSortOption {
    return PRODUCT_SORT_OPTIONS[sort || 'default'] || PRODUCT_SORT_OPTIONS.default;
  }

  private static buildSellerData(
    body: CreateProductBody,
    userId: string,
    userName: string
  ) {
    const resolvedName =
      (userName && userName.trim()) || PRODUCT_CONFIG.DEFAULT_SELLER_NAME;
    const resolvedAvatar = resolvedName.slice(0, 2).toUpperCase();
    const sellerData = body.seller || {
      name: resolvedName,
      avatar: resolvedAvatar,
    };

    return {
      userId,
      name: (sellerData.name && sellerData.name.trim()) || resolvedName,
      avatar: (sellerData.avatar && sellerData.avatar.trim()) || resolvedAvatar,
      rating: sellerData.rating || PRODUCT_CONFIG.DEFAULT_SELLER_RATING,
      totalContracts:
        sellerData.totalContracts || PRODUCT_CONFIG.DEFAULT_TOTAL_CONTRACTS,
    };
  }

  private static filterAllowedUpdateData(
    updateData: Partial<CreateProductBody>
  ): Partial<CreateProductBody> {
    return PRODUCT_UPDATE_FIELDS.reduce<Partial<CreateProductBody>>(
      (filteredData, fieldName) => {
        if (updateData[fieldName] !== undefined) {
          (filteredData as Record<string, unknown>)[fieldName] = updateData[
            fieldName
          ] as unknown;
        }

        return filteredData;
      },
      {}
    );
  }

  /**
   * Get all products with optional filters
   */
  static async getAll(filters: ProductFilters): Promise<{ products: IProduct[]; total: number; page: number; totalPages: number }> {
    const query = this.buildQuery(filters);
    const page = filters.page || 1;
    const limit = filters.limit || PRODUCT_CONFIG.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const sortOption = this.buildSortOption(filters.sort);

    const [products, total] = await Promise.all([
      Product.find(query).sort(sortOption).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get product by ID
   */
  static async getById(productId: string): Promise<IProduct> {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }
    return product;
  }

  /**
   * Get similar products (same region or category, excluding self)
   */
  static async getSimilar(productId: string, limit: number = 4): Promise<IProduct[]> {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);

    return Product.find({
      _id: { $ne: productId },
      isActive: true,
      $or: [{ region: product.region }, { category: product.category }],
    })
      .limit(limit)
      .sort({ rating: -1 });
  }

  /**
   * Get products by region
   */
  static async getByRegion(region: string): Promise<IProduct[]> {
    return Product.find({ region, isActive: true }).sort({ rating: -1 });
  }

  /**
   * Create a new product (farmer only)
   */
  static async create(body: CreateProductBody, userId: string, userName: string): Promise<IProduct> {
    const product = await Product.create({
      ...body,
      seller: this.buildSellerData(body, userId, userName),
      createdBy: userId,
    });

    return product;
  }

  /**
   * Update product (owner only)
   */
  static async update(
    productId: string,
    userId: string,
    updateData: Partial<CreateProductBody>
  ): Promise<IProduct> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    if (product.createdBy && product.createdBy.toString() !== userId) {
      throw new AppError('Bạn không có quyền chỉnh sửa sản phẩm này', 403);
    }

    const filteredUpdate = this.filterAllowedUpdateData(updateData);

    const updated = await Product.findByIdAndUpdate(productId, filteredUpdate, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      throw new AppError('Cập nhật sản phẩm thất bại', 500);
    }

    return updated;
  }

  /**
   * Delete product (soft delete, owner only)
   */
  static async delete(productId: string, userId: string): Promise<void> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    if (product.createdBy && product.createdBy.toString() !== userId) {
      throw new AppError('Bạn không có quyền xóa sản phẩm này', 403);
    }

    product.isActive = false;
    await product.save();
  }

  /**
   * Get products by farmer/seller userId
   */
  static async getByUser(userId: string): Promise<IProduct[]> {
    return Product.find({ createdBy: userId, isActive: true }).sort({ createdAt: -1 });
  }

  /**
   * Get all reviews for a product
   */
  static async getReviews(productId: string): Promise<IReview[]> {
    return Review.find({ productId }).sort({ createdAt: -1 });
  }

  /**
   * Add a review for a product (enterprise only, one per user)
   */
  static async addReview(
    productId: string,
    reviewerId: string,
    reviewerName: string,
    rating: number,
    text: string
  ): Promise<IReview> {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    const existing = await Review.findOne({ productId, reviewerId });
    if (existing) {
      throw new AppError('Bạn đã đánh giá sản phẩm này rồi', 400);
    }

    const review = await Review.create({
      productId,
      reviewerId,
      reviewerName,
      reviewerAvatar: reviewerName.slice(0, 1).toUpperCase(),
      rating,
      text: text.trim(),
    });

    // Recalculate and update denormalized rating on the product
    const allReviews = await Review.find({ productId });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Product.findByIdAndUpdate(productId, {
      rating: Math.round(avg * 10) / 10,
      reviewCount: allReviews.length,
    });

    return review;
  }
}
