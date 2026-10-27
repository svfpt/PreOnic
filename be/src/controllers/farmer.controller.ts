import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import Contract from '../models/Contract.model';
import Escrow from '../models/Escrow.model';
import User from '../models/User.model';
import Product from '../models/Product.model';
import { getHarvestEligibility } from '../utils/harvest.util';

/**
 * Get farmer dashboard data
 * GET /api/v1/farmer/dashboard
 */
export const getDashboard = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    // Get contracts
    const [contracts, escrows, user, products] = await Promise.all([
      Contract.find({ farmerId: userId }).sort({ createdAt: -1 }),
      Escrow.find({ farmerId: userId }),
      User.findById(userId).select('virtualBalance reputationScore fullName'),
      Product.find({ createdBy: userId, isActive: true }),
    ]);

    const activeContracts = contracts.filter(c => c.status === 'active');
    const pendingContracts = contracts.filter(c => c.status === 'pending');
    const completedContracts = contracts.filter(c => c.status === 'completed');

    const totalContractValue = contracts
      .filter(c => ['active', 'completed', 'approved'].includes(c.status))
      .reduce((sum, c) => sum + c.totalValue, 0);

    const totalEscrowReceived = escrows.reduce((sum, e) => sum + e.releasedAmount, 0);
    const pendingEscrowAmount = escrows.reduce(
      (sum, e) => sum + (e.depositedAmount - e.releasedAmount),
      0
    );

    // Recent contracts for table
    const recentContracts = contracts.slice(0, 5).map(c => ({
      id: c._id,
      contractCode: c.contractCode,
      enterpriseName: c.enterpriseName,
      productName: c.productName,
      totalValue: c.totalValue,
      deliveryDate: c.deliveryDate,
      status: c.status,
    }));

    res.status(200).json({
      success: true,
      status: 'success',
      data: {
        stats: {
          totalContractValue,
          activeContracts: activeContracts.length,
          pendingContracts: pendingContracts.length,
          completedContracts: completedContracts.length,
          totalContracts: contracts.length,
          balance: user?.virtualBalance || 0,
          totalEscrowReceived,
          pendingEscrowAmount,
          reputationScore: user?.reputationScore || 5.0,
          totalProducts: products.length,
        },
        recentContracts,
      },
    });
  }
);

/**
 * Get farmer's contracts
 * GET /api/v1/farmer/contracts
 */
export const getContracts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;

    const query: any = { farmerId: userId };
    if (status) query.status = status;

    const contracts = await Contract.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      status: 'success',
      data: { contracts, total: contracts.length },
    });
  }
);

/**
 * Get farmer's orders (derived from active/completed contracts)
 * GET /api/v1/farmer/orders
 */
export const getOrders = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;

    const contractQuery: any = {
      farmerId: userId,
      status: { $in: ['active', 'completed'] },
    };

    const contracts = await Contract.find(contractQuery)
      .populate('productId', 'expectedDate')
      .sort({ createdAt: -1 });

    // Map contracts to order-like format
    const orders = await Promise.all(
      contracts.map(async (c) => {
        const escrow = await Escrow.findOne({ contractId: c._id });
        const productExpectedDate = (c.productId as any)?.expectedDate || null;
        const harvestEligibility = getHarvestEligibility(productExpectedDate);
        const currentMilestone = escrow?.milestones.find(
          m => m.status === 'in_progress'
        );
        const completedSteps = escrow?.milestones.filter(
          m => m.status === 'completed'
        ).length || 0;

        // Mapping theo mốc đã hoàn thành để UI không cho phép gọi step 3 trước step 2.
        let orderStatus = 'confirmed';
        if (completedSteps >= 4) orderStatus = 'delivered';
        else if (completedSteps >= 3) orderStatus = 'quality_check';
        else if (completedSteps >= 2) orderStatus = 'processing';

        return {
          id: c._id,
          contractCode: c.contractCode,
          enterpriseName: c.enterpriseName,
          productName: c.productName,
          quantity: `${c.quantity} ${c.unit}`,
          value: c.totalValue,
          status: orderStatus,
          deliveryDate: c.deliveryDate,
          createdAt: c.createdAt,
          escrowId: escrow?._id || null,
          escrowStatus: escrow?.status || 'none',
          currentMilestone: currentMilestone?.name || null,
          expectedHarvestDate: productExpectedDate,
          shippingAllowed: harvestEligibility.shippingAllowed,
          shippingRestrictionReason: harvestEligibility.reason,
          completedSteps,
          totalSteps: 5,
        };
      })
    );

    // Filter by status if provided
    const filteredOrders = status
      ? orders.filter(o => o.status === status)
      : orders;

    res.status(200).json({
      success: true,
      status: 'success',
      data: { orders: filteredOrders, total: filteredOrders.length },
    });
  }
);

/**
 * Get farmer's financial data
 * GET /api/v1/farmer/finances
 */
export const getFinances = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const [user, escrows, contracts] = await Promise.all([
      User.findById(userId).select('virtualBalance'),
      Escrow.find({ farmerId: userId }),
      Contract.find({ farmerId: userId }),
    ]);

    // Aggregate all escrow transactions for this farmer
    const allTransactions: any[] = [];

    escrows.forEach((escrow) => {
      const contract = contracts.find(
        c => c._id.toString() === escrow.contractId.toString()
      );

      escrow.transactions.forEach((tx) => {
        if (tx.type === 'release' && tx.toUserId?.toString() === userId) {
          allTransactions.push({
            id: tx._id,
            type: 'income',
            description: `Giai ngan HĐ ${contract?.contractCode || ''} — ${contract?.productName || ''}`,
            amount: tx.amount,
            date: tx.createdAt,
            status: 'completed',
            contractCode: contract?.contractCode,
          });
        }
      });
    });

    // Sort by date
    allTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const totalIncome = allTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const completedContractValue = contracts
      .filter(c => c.status === 'completed')
      .reduce((sum, c) => sum + c.totalValue, 0);

    const pendingAmount = escrows
      .filter(e => !['fully_released', 'refunded'].includes(e.status))
      .reduce((sum, e) => sum + (e.depositedAmount - e.releasedAmount), 0);

    res.status(200).json({
      success: true,
      status: 'success',
      data: {
        balance: user?.virtualBalance || 0,
        stats: {
          totalIncome,
          completedContractValue,
          pendingAmount,
          totalTransactions: allTransactions.length,
        },
        transactions: allTransactions.slice(0, 20),
      },
    });
  }
);

/**
 * Get farmer's crops (products they've listed)
 * GET /api/v1/farmer/crops
 */
export const getCrops = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const products = await Product.find({ createdBy: userId, isActive: true }).sort({
      createdAt: -1,
    });

    // Map to crop-like format
    const crops = products.map(p => ({
      id: p._id,
      name: p.name,
      location: p.location,
      farm: p.farm,
      category: p.category,
      progress: p.progress,
      remaining: p.remaining,
      totalQuantity: p.totalQuantity,
      expectedDate: p.expectedDate,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      unit: p.unit,
      badge: p.badge,
    }));

    res.status(200).json({
      success: true,
      status: 'success',
      data: { crops, total: crops.length },
    });
  }
);
