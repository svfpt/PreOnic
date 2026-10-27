import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { successResponse, paginatedResponse } from '../utils/response.util';
import User from '../models/User.model';
import Contract from '../models/Contract.model';
import Dispute from '../models/Dispute.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { EscrowService } from '../services/escrow.service';

/**
 * GET /api/v1/admin/dashboard
 * Tổng quan hệ thống
 */
export const getDashboard = asyncHandler(
  async (_req: AuthRequest, res: Response, _next: NextFunction) => {
    const [
      totalUsers,
      totalFarmers,
      totalEnterprises,
      totalContracts,
      activeContracts,
      completedContracts,
      cancelledContracts,
      openDisputes,
      totalTransactions,
      revenueAgg,
      recentUsers,
      recentContracts,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' }, isHidden: { $ne: true } }),
      User.countDocuments({ role: 'farmer', isHidden: { $ne: true } }),
      User.countDocuments({ role: 'enterprise', isHidden: { $ne: true } }),
      Contract.countDocuments({}),
      Contract.countDocuments({ status: 'active' }),
      Contract.countDocuments({ status: 'completed' }),
      Contract.countDocuments({ status: 'cancelled' }),
      Dispute.countDocuments({ status: { $in: ['open', 'under_review'] } }),
      PaymentTransaction.countDocuments({ status: 'completed' }),
      PaymentTransaction.aggregate([
        { $match: { status: 'completed', type: 'topup' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      User.find({ role: { $ne: 'admin' }, isHidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
          // Admin không được xem email người dùng → loại email khỏi payload.
        .select('fullName role isActive createdAt'),
      Contract.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('contractCode farmerName enterpriseName totalValue status createdAt'),
    ]);

    const totalTopupRevenue = revenueAgg[0]?.total || 0;

    // Monthly new users (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyUsers = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, role: { $ne: 'admin' } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthlyLabels = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
    const monthlyUserData = monthlyUsers.map((m) => ({
      month: monthlyLabels[m._id.month - 1],
      count: m.count,
    }));

    res.status(200).json(
      successResponse({
        stats: {
          totalUsers,
          totalFarmers,
          totalEnterprises,
          totalContracts,
          activeContracts,
          completedContracts,
          cancelledContracts,
          openDisputes,
          totalTransactions,
          totalTopupRevenue,
        },
        monthlyUserData,
        recentUsers,
        recentContracts,
      })
    );
  }
);

/**
 * GET /api/v1/admin/users
 * Danh sách tất cả người dùng (có phân trang + tìm kiếm + lọc role)
 */
export const getUsers = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const role = req.query.role as string;
    const isActive = req.query.isActive as string;

    // Loại các account bị ẩn mềm khỏi danh sách quản lý (kể cả admin không thấy).
    const filter: any = { role: { $ne: 'admin' }, isHidden: { $ne: true } };

    if (role && ['farmer', 'enterprise'].includes(role)) {
      filter.role = role;
    }
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // Admin không được xem email & số dư ví người dùng → loại email, virtualBalance khỏi payload.
        .select('fullName phone role isActive isVerified reputationScore createdAt lastLogin province'),
      User.countDocuments(filter),
    ]);

    res.status(200).json(paginatedResponse(users, page, limit, total));
  }
);

/**
 * GET /api/v1/admin/users/:id
 * Chi tiết 1 người dùng
 */
export const getUserDetail = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const user = await User.findById(req.params.id)
      // Admin không được xem email & số dư ví người dùng → loại cả hai khỏi payload.
      .select('-password -refreshToken -passwordResetToken -emailVerificationToken -virtualBalance -email');

    // Account bị ẩn mềm → coi như không tồn tại với admin.
    if (!user || user.isHidden) throw new AppError('Người dùng không tồn tại', 404);

    const [contractCount, transactionCount] = await Promise.all([
      Contract.countDocuments({
        $or: [{ farmerId: user._id }, { enterpriseId: user._id }],
      }),
      PaymentTransaction.countDocuments({ userId: user._id, status: 'completed' }),
    ]);

    res.status(200).json(successResponse({ user, contractCount, transactionCount }));
  }
);

/**
 * PATCH /api/v1/admin/users/:id/toggle-status
 * Kích hoạt / vô hiệu hóa tài khoản
 */
export const toggleUserStatus = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);
    if (user.role === 'admin') throw new AppError('Không thể thay đổi trạng thái admin', 403);

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.status(200).json(
      successResponse(
        { userId: user._id, isActive: user.isActive },
        `Tài khoản đã ${user.isActive ? 'kích hoạt' : 'vô hiệu hóa'} thành công`
      )
    );
  }
);

/**
 * DELETE /api/v1/admin/users/:id
 * Xóa vĩnh viễn tài khoản người dùng
 */
export const deleteUser = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);
    if (user.role === 'admin') throw new AppError('Không thể xóa tài khoản admin', 403);

    const activeContractCount = await Contract.countDocuments({
      $or: [{ farmerId: user._id }, { enterpriseId: user._id }],
      status: { $in: ['pending', 'active'] },
    });
    if (activeContractCount > 0) {
      throw new AppError(
        `Không thể xóa: tài khoản đang có ${activeContractCount} hợp đồng đang hoạt động`,
        400
      );
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json(
      successResponse({ userId: req.params.id }, 'Tài khoản đã được xóa vĩnh viễn')
    );
  }
);

/**
 * GET /api/v1/admin/contracts
 * Danh sách tất cả hợp đồng
 */
export const getAllContracts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as string;

    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { contractCode: { $regex: search, $options: 'i' } },
        { farmerName: { $regex: search, $options: 'i' } },
        { enterpriseName: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
      ];
    }

    const [contracts, total] = await Promise.all([
      Contract.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('contractCode farmerName enterpriseName productName totalValue status signedAt createdAt deliveryDate'),
      Contract.countDocuments(filter),
    ]);

    res.status(200).json(paginatedResponse(contracts, page, limit, total));
  }
);

/**
 * GET /api/v1/admin/contracts/:id
 * Chi tiết hợp đồng
 */
export const getContractDetail = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('ID hợp đồng không hợp lệ', 400);
    }

    const contract = await Contract.findById(req.params.id)
      .populate('farmerId', 'fullName phone')
      .populate('enterpriseId', 'fullName phone');

    if (!contract) throw new AppError('Hợp đồng không tồn tại', 404);

    const dispute = await Dispute.findOne({ contractId: contract._id });

    res.status(200).json(successResponse({ contract, dispute }));
  }
);

/**
 * GET /api/v1/admin/disputes
 * Danh sách tất cả khiếu nại
 */
export const getAllDisputes = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const filter: any = {};
    if (status) filter.status = status;

    const [disputes, total] = await Promise.all([
      Dispute.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('contractId', 'contractCode farmerName enterpriseName totalValue')
        .populate('raisedBy', 'fullName role')
        .populate('againstUserId', 'fullName role'),
      Dispute.countDocuments(filter),
    ]);

    res.status(200).json(paginatedResponse(disputes, page, limit, total));
  }
);

/**
 * GET /api/v1/admin/disputes/:id
 * Chi tiết khiếu nại
 */
export const getDisputeDetail = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const dispute = await Dispute.findById(req.params.id)
      .populate('contractId', 'contractCode farmerName enterpriseName productName totalValue status')
      .populate('raisedBy', 'fullName role phone')
      .populate('againstUserId', 'fullName role phone');

    if (!dispute) throw new AppError('Khiếu nại không tồn tại', 404);

    res.status(200).json(successResponse({ dispute }));
  }
);

/**
 * POST /api/v1/admin/disputes/:id/resolve
 * Giải quyết khiếu nại (delegate to EscrowService)
 */
export const resolveDisputeAdmin = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { resolution, adminNotes } = req.body;

    if (!resolution || !['farmer', 'enterprise'].includes(resolution)) {
      throw new AppError('resolution phải là "farmer" hoặc "enterprise"', 400);
    }

    const dispute = await EscrowService.resolveDispute(
      req.params.id,
      resolution,
      adminNotes || ''
    );

    res.status(200).json(
      successResponse({ dispute }, 'Khiếu nại đã được giải quyết thành công!')
    );
  }
);

/**
 * GET /api/v1/admin/transactions
 * Danh sách tất cả giao dịch
 */
export const getAllTransactions = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const type = req.query.type as string;
    const status = req.query.status as string;

    const filter: any = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const [transactions, total, statsAgg] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName role'),
      PaymentTransaction.countDocuments(filter),
      PaymentTransaction.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats: Record<string, { totalAmount: number; count: number }> = {};
    for (const s of statsAgg) {
      stats[s._id] = { totalAmount: s.totalAmount, count: s.count };
    }

    res.status(200).json({
      ...paginatedResponse(transactions, page, limit, total),
      stats,
    });
  }
);
