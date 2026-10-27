import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import Contract from '../models/Contract.model';
import Escrow from '../models/Escrow.model';
import User from '../models/User.model';
import Product from '../models/Product.model';

/**
 * Get enterprise dashboard data
 * GET /api/v1/enterprise/dashboard
 */
export const getDashboard = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const [contracts, escrows, user] = await Promise.all([
      Contract.find({ enterpriseId: userId }).sort({ createdAt: -1 }),
      Escrow.find({ enterpriseId: userId }),
      User.findById(userId).select('virtualBalance reputationScore fullName'),
    ]);

    const activeContracts = contracts.filter(c => c.status === 'active');
    const pendingContracts = contracts.filter(c => c.status === 'pending');
    const completedContracts = contracts.filter(c => c.status === 'completed');

    const totalContractValue = contracts
      .filter(c => ['active', 'completed', 'approved'].includes(c.status))
      .reduce((sum, c) => sum + c.totalValue, 0);

    const totalDeposited = escrows.reduce((sum, e) => sum + e.depositedAmount, 0);
    const totalReleased = escrows.reduce((sum, e) => sum + e.releasedAmount, 0);

    // Unique farmers the enterprise is working with
    const uniqueFarmerIds = [
      ...new Set(contracts.map(c => c.farmerId.toString())),
    ];

    const recentContracts = contracts.slice(0, 5).map(c => ({
      id: c._id,
      contractCode: c.contractCode,
      farmerName: c.farmerName,
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
          totalDeposited,
          totalReleased,
          reputationScore: user?.reputationScore || 5.0,
          totalSuppliers: uniqueFarmerIds.length,
        },
        recentContracts,
      },
    });
  }
);

/**
 * Get enterprise's contracts
 * GET /api/v1/enterprise/contracts
 */
export const getContracts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;

    const query: any = { enterpriseId: userId };
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
 * Get enterprise's suppliers (farmers they've worked with)
 * GET /api/v1/enterprise/suppliers
 */
export const getSuppliers = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const contracts = await Contract.find({
      enterpriseId: userId,
      status: { $in: ['active', 'completed', 'approved'] },
    });

    // Get unique farmer IDs
    const farmerMap = new Map<string, { contractCount: number; totalValue: number }>();

    contracts.forEach(c => {
      const farmerId = c.farmerId.toString();
      const existing = farmerMap.get(farmerId) || {
        contractCount: 0,
        totalValue: 0,
      };
      existing.contractCount++;
      existing.totalValue += c.totalValue;
      farmerMap.set(farmerId, existing);
    });

    const farmerIds = Array.from(farmerMap.keys());
    const farmers = await User.find({
      _id: { $in: farmerIds },
    }).select('fullName email phone reputationScore isActive');

    const suppliers = farmers.map(f => ({
      id: f._id,
      name: f.fullName,
      email: f.email,
      phone: f.phone,
      reputationScore: f.reputationScore,
      isActive: f.isActive,
      contractCount: farmerMap.get(f._id.toString())?.contractCount || 0,
      totalValue: farmerMap.get(f._id.toString())?.totalValue || 0,
    }));

    // Sort by contract count (most active first)
    suppliers.sort((a, b) => b.contractCount - a.contractCount);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { suppliers, total: suppliers.length },
    });
  }
);

/**
 * Get enterprise's warehouse (aggregated by product)
 * GET /api/v1/enterprise/warehouse
 */
export const getWarehouse = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    // Get completed contracts for the enterprise
    const contracts = await Contract.find({
      enterpriseId: userId,
      status: 'completed',
    });

    // Aggregate by product name
    const warehouseMap = new Map<
      string,
      { quantity: number; unit: string; totalValue: number; count: number }
    >();

    contracts.forEach(c => {
      const existing = warehouseMap.get(c.productName) || {
        quantity: 0,
        unit: c.unit,
        totalValue: 0,
        count: 0,
      };
      existing.quantity += c.quantity;
      existing.totalValue += c.totalValue;
      existing.count++;
      warehouseMap.set(c.productName, existing);
    });

    const warehouseItems = Array.from(warehouseMap.entries()).map(
      ([productName, data]) => ({
        productName,
        quantity: data.quantity,
        unit: data.unit,
        totalValue: data.totalValue,
        contractCount: data.count,
      })
    );

    res.status(200).json({
      success: true,
      status: 'success',
      data: { items: warehouseItems, total: warehouseItems.length },
    });
  }
);

/**
 * Get enterprise analytics
 * GET /api/v1/enterprise/analytics
 */
export const getAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;

    const [contracts, escrows] = await Promise.all([
      Contract.find({ enterpriseId: userId }),
      Escrow.find({ enterpriseId: userId }),
    ]);

    // Monthly spending analysis (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlyData: { month: string; value: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleDateString('vi-VN', {
        month: 'short',
        year: 'numeric',
      });

      const monthContracts = contracts.filter(c => {
        const created = new Date(c.createdAt);
        return created >= monthStart && created <= monthEnd;
      });

      monthlyData.push({
        month: monthName,
        value: monthContracts.reduce((sum, c) => sum + c.totalValue, 0),
        count: monthContracts.length,
      });
    }

    // Product distribution
    const productMap = new Map<string, number>();
    contracts.forEach(c => {
      const existing = productMap.get(c.productName) || 0;
      productMap.set(c.productName, existing + c.totalValue);
    });

    const productDistribution = Array.from(productMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Status summary
    const statusSummary = {
      draft: contracts.filter(c => c.status === 'draft').length,
      pending: contracts.filter(c => c.status === 'pending').length,
      approved: contracts.filter(c => c.status === 'approved').length,
      active: contracts.filter(c => c.status === 'active').length,
      completed: contracts.filter(c => c.status === 'completed').length,
      cancelled: contracts.filter(c => c.status === 'cancelled').length,
      disputed: contracts.filter(c => c.status === 'disputed').length,
    };

    const totalSpending = contracts
      .filter(c => ['active', 'completed'].includes(c.status))
      .reduce((sum, c) => sum + c.totalValue, 0);

    const avgContractValue =
      contracts.length > 0 ? totalSpending / contracts.length : 0;

    res.status(200).json({
      success: true,
      status: 'success',
      data: {
        overview: {
          totalSpending,
          avgContractValue,
          totalContracts: contracts.length,
          totalEscrowDeposited: escrows.reduce(
            (sum, e) => sum + e.depositedAmount,
            0
          ),
        },
        monthlyData,
        productDistribution,
        statusSummary,
      },
    });
  }
);

/**
 * Get enterprise orders (derived from contracts + escrow milestones)
 * GET /api/v1/enterprise/orders
 *
 * "Đơn hàng" = các hợp đồng đã ký trở đi (approved → active → completed),
 * kèm cả disputed/cancelled để doanh nghiệp vẫn theo dõi được sau khiếu nại.
 * Trạng thái đơn được suy ra từ tiến độ milestone của escrow (nguồn sự thật).
 */
const UNIT_LABELS: Record<string, string> = {
  tan: 'tấn',
  ta: 'tạ',
  kg: 'kg',
  thung: 'thùng',
};

export const getOrders = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;

    const contracts = await Contract.find({
      enterpriseId: userId,
      status: { $in: ['approved', 'active', 'completed', 'disputed', 'cancelled'] },
    }).sort({ createdAt: -1 });

    const orders = await Promise.all(
      contracts.map(async (c) => {
        const escrow = await Escrow.findOne({ contractId: c._id });
        const escrowStatus = escrow?.status || 'none';

        // Snapshot milestone — FE dựng timeline trực tiếp từ đây, không suy đoán.
        const milestones = (escrow?.milestones || [])
          .slice()
          .sort((a, b) => a.step - b.step)
          .map((m) => ({
            step: m.step,
            name: m.name,
            description: m.description,
            status: m.status,
            requiredBy: m.requiredBy,
            releaseAmount: m.releaseAmount,
            releasePercentage: m.releasePercentage,
            farmerConfirmed: m.farmerConfirmed,
            enterpriseConfirmed: m.enterpriseConfirmed,
            farmerConfirmedAt: m.farmerConfirmedAt || null,
            enterpriseConfirmedAt: m.enterpriseConfirmedAt || null,
            completedAt: m.completedAt || null,
          }));

        const completedSteps = milestones.filter((m) => m.status === 'completed').length;

        // Mốc đang hoạt động: ưu tiên in_progress, sau đó là pending có step nhỏ nhất.
        const activeMilestone =
          milestones.find((m) => m.status === 'in_progress') ||
          milestones.find((m) => m.status === 'pending') ||
          null;

        const isDisputed = escrowStatus === 'disputed' || c.status === 'disputed';
        const isCancelled = c.status === 'cancelled';
        const isFullyDone =
          escrowStatus === 'fully_released' || c.status === 'completed' || completedSteps >= 4;

        // Trạng thái đơn (pipeline) — đồng bộ với 5 bước hiển thị trên FE.
        let orderStatus: string;
        if (isCancelled) orderStatus = 'cancelled';
        else if (isDisputed) orderStatus = 'disputed';
        else if (escrowStatus === 'none' || escrowStatus === 'awaiting_deposit')
          orderStatus = 'awaiting_deposit';
        else if (isFullyDone) orderStatus = 'delivered';
        else if (completedSteps >= 3) orderStatus = 'quality_check';
        else if (completedSteps >= 2) orderStatus = 'shipping';
        else orderStatus = 'processing';

        // Doanh nghiệp chỉ được "xác nhận" mốc khi: mốc của DN, KHÔNG phải step 1
        // (step 1 = Ký quỹ chỉ hoàn tất qua nạp tiền), và escrow đã được nạp tiền.
        // Tránh việc confirm step 1 giải ngân khoản tiền chưa hề được ký quỹ.
        const enterpriseCanConfirm =
          !!activeMilestone &&
          activeMilestone.requiredBy === 'enterprise' &&
          activeMilestone.step !== 1 &&
          activeMilestone.status !== 'completed' &&
          ['funded', 'partially_released'].includes(escrowStatus) &&
          !isDisputed &&
          !isCancelled;

        const waitingFor = isDisputed
          ? 'admin'
          : isCancelled || isFullyDone
            ? null
            : activeMilestone?.requiredBy || null;

        // Escrow tự tạo khi ký HĐ → none gần như không xảy ra; vẫn để fallback "tạo ký quỹ".
        const canCreateEscrow = escrowStatus === 'none';
        const canDeposit = escrowStatus === 'awaiting_deposit';
        const canDispute =
          !!escrow &&
          !isDisputed &&
          !isCancelled &&
          ['funded', 'partially_released'].includes(escrowStatus) &&
          !isFullyDone;

        const unitLabel = UNIT_LABELS[c.unit] || c.unit;

        return {
          id: c._id,
          contractCode: c.contractCode,
          farmerName: c.farmerName,
          productName: c.productName,
          quantity: `${c.quantity} ${unitLabel}`,
          rawQuantity: c.quantity,
          unit: c.unit,
          unitLabel,
          pricePerUnit: c.pricePerUnit,
          value: c.totalValue,
          paymentTerms: c.paymentTerms,
          status: orderStatus,
          contractStatus: c.status,
          deliveryDate: c.deliveryDate,
          createdAt: c.createdAt,
          completedAt: c.completedAt || null,
          cancelReason: c.cancelReason || null,

          // Escrow — FE gọi confirm/dispute trực tiếp bằng escrowId (không cần round-trip phụ).
          escrowId: escrow?._id || null,
          escrowStatus,
          totalAmount: escrow?.totalAmount ?? c.totalValue,
          depositedAmount: escrow?.depositedAmount || 0,
          releasedAmount: escrow?.releasedAmount || 0,

          milestones,
          currentMilestone: activeMilestone?.name || null,
          currentMilestoneStep: activeMilestone?.step || null,
          currentMilestoneRequiredBy: activeMilestone?.requiredBy || null,
          completedSteps,
          totalSteps: 5,

          enterpriseCanConfirm,
          enterpriseConfirmStep: enterpriseCanConfirm ? activeMilestone?.step ?? null : null,
          disputeStep: activeMilestone?.step || 4,
          canCreateEscrow,
          canDeposit,
          canDispute,
          waitingFor,
        };
      })
    );

    const filteredOrders = status
      ? orders.filter((o) => o.status === status)
      : orders;

    res.status(200).json({
      success: true,
      status: 'success',
      data: { orders: filteredOrders, total: filteredOrders.length },
    });
  }
);
