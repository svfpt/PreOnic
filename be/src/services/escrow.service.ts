import mongoose from 'mongoose';
import Escrow, { IEscrow, IMilestone } from '../models/Escrow.model';
import Contract, { IContract } from '../models/Contract.model';
import Dispute, { IDispute } from '../models/Dispute.model';
import User from '../models/User.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { AppError } from '../middlewares/error.middleware';
import { NotificationService } from './notification.service';
import Product from '../models/Product.model';
import { getHarvestEligibility } from '../utils/harvest.util';
import { buildMilestones } from '../utils/milestone.util';

// Sau khi .populate(), ref vốn là ObjectId trở thành document {_id, ...}.
// Helper này lấy id dưới dạng string cho cả 2 trường hợp, tránh phải cast `any` rải rác.
function refToId(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    const id = (ref as { _id: unknown })._id;
    return id ? String(id) : '';
  }
  return String(ref);
}

export class EscrowService {
  private static async recordPaymentTransaction(params: {
    userId: mongoose.Types.ObjectId;
    type: 'escrow_deposit' | 'escrow_release' | 'refund';
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await PaymentTransaction.create({
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      status: 'completed',
      paymentMethod: 'internal',
      description: params.description,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      completedAt: new Date(),
      metadata: params.metadata,
    });
  }
  /**
   * Internal: create escrow directly from a contract object (no auth check).
   * Used by ContractService when both parties have signed.
   */
  static async createEscrowForContract(contract: IContract): Promise<IEscrow> {
    // Check if escrow already exists
    const existing = await Escrow.findOne({ contractId: contract._id });
    if (existing) return existing; // idempotent — return existing

    const milestones = buildMilestones(contract.paymentTerms, contract.totalValue);

    const escrow = await Escrow.create({
      contractId: contract._id,
      farmerId: contract.farmerId,
      enterpriseId: contract.enterpriseId,
      totalAmount: contract.totalValue,
      milestones,
      transactions: [],
    });

    return escrow;
  }

  /**
   * Create a new escrow for a contract (API endpoint — with auth check)
   */
  static async createEscrow(
    contractId: string,
    userId: string
  ): Promise<IEscrow> {
    const contract = await Contract.findById(contractId);
    if (!contract) {
      throw new AppError('Hợp đồng không tồn tại', 404);
    }

    // Only contract parties can create escrow
    const isParty =
      contract.farmerId.toString() === userId ||
      contract.enterpriseId.toString() === userId;
    if (!isParty) {
      throw new AppError('Bạn không có quyền tạo escrow cho hợp đồng này', 403);
    }

    // Check if escrow already exists
    const existing = await Escrow.findOne({ contractId: contract._id });
    if (existing) {
      throw new AppError('Escrow đã tồn tại cho hợp đồng này', 400);
    }

    const milestones = buildMilestones(contract.paymentTerms, contract.totalValue);

    const escrow = await Escrow.create({
      contractId: contract._id,
      farmerId: contract.farmerId,
      enterpriseId: contract.enterpriseId,
      totalAmount: contract.totalValue,
      milestones,
      transactions: [],
    });

    // Update contract status
    contract.status = 'approved';
    await contract.save();

    return escrow;
  }

  /**
   * Enterprise deposits money into escrow
   */
  static async deposit(
    escrowId: string,
    userId: string,
    amount: number
  ): Promise<IEscrow> {
    const escrow = await Escrow.findById(escrowId);
    if (!escrow) {
      throw new AppError('Escrow không tồn tại', 404);
    }

    // Only enterprise can deposit
    if (escrow.enterpriseId.toString() !== userId) {
      throw new AppError('Chỉ doanh nghiệp mới có thể đặt cọc', 403);
    }

    if (escrow.status !== 'awaiting_deposit') {
      throw new AppError('Escrow đã được nạp tiền', 400);
    }

    // Check enterprise balance
    const enterprise = await User.findById(userId);
    if (!enterprise) {
      throw new AppError('Người dùng không tồn tại', 404);
    }

    if (enterprise.virtualBalance < amount) {
      throw new AppError(
        `Số dư không đủ. Số dư hiện tại: ${enterprise.virtualBalance.toLocaleString('vi-VN')} VND`,
        400
      );
    }

    // Validate amount matches expected
    if (amount < escrow.totalAmount) {
      throw new AppError(
        `Số tiền nạp phải bằng toàn bộ giá trị hợp đồng: ${escrow.totalAmount.toLocaleString('vi-VN')} VND`,
        400
      );
    }

    // Deduct from enterprise balance
    const enterpriseBalanceBefore = enterprise.virtualBalance;
    enterprise.virtualBalance -= amount;
    await enterprise.save({ validateBeforeSave: false });

    // Update escrow
    escrow.depositedAmount = amount;
    escrow.status = 'funded';

    // Record transaction
    escrow.transactions.push({
      type: 'deposit',
      amount,
      fromUserId: new mongoose.Types.ObjectId(userId),
      description: `Doanh nghiệp đặt cọc ${amount.toLocaleString('vi-VN')} VND`,
      createdAt: new Date(),
    });

    await this.recordPaymentTransaction({
      userId: enterprise._id,
      type: 'escrow_deposit',
      amount,
      balanceBefore: enterpriseBalanceBefore,
      balanceAfter: enterprise.virtualBalance,
      description: `Ký quỹ hợp đồng ${escrow.contractId.toString()}`,
      metadata: {
        escrowId: escrow._id.toString(),
        contractId: escrow.contractId.toString(),
      },
    });

    // Mark milestone 1 as completed
    const milestone1 = escrow.milestones.find((m) => m.step === 1);
    if (milestone1) {
      milestone1.status = 'completed';
      milestone1.enterpriseConfirmed = true;
      milestone1.enterpriseConfirmedAt = new Date();
      milestone1.completedAt = new Date();

      // Giải ngân ngay phần trước theo điều khoản (50_50 → 50%, 30_70 → 30%, 100_upfront → 100%)
      if ((milestone1.releasePercentage ?? 0) > 0) {
        await this.completeMilestone(escrow, milestone1);
      }
    }

    await escrow.save();

    // Activate the contract
    const contract = await Contract.findById(escrow.contractId);
    if (contract) {
      contract.status = 'active';
      await contract.save();
    }

    // Notify farmer about deposit
    try {
      const immediateRelease = milestone1?.releaseAmount ?? 0;
      const releaseNote = immediateRelease > 0
        ? ` ${immediateRelease.toLocaleString('vi-VN')} VND đã được giải ngân vào tài khoản của bạn ngay lập tức.`
        : '';
      await NotificationService.create({
        userId: escrow.farmerId.toString(),
        type: 'escrow',
        title: 'Doanh nghiệp đã ký quỹ',
        message: `Doanh nghiệp đã ký quỹ toàn bộ ${amount.toLocaleString('vi-VN')} VND.${releaseNote} Hợp đồng đã được kích hoạt — vui lòng chuẩn bị hàng hóa.`,
        severity: 'info',
        relatedId: String(escrow._id),
        relatedModel: 'Escrow',
      });
    } catch { /* non-critical — don't fail deposit if notification fails */ }

    return escrow;
  }

  /**
   * Farmer confirms a milestone (e.g., shipped goods)
   */
  static async farmerConfirmMilestone(
    escrowId: string,
    userId: string,
    milestoneStep: number,
    evidence?: string
  ): Promise<IEscrow> {
    const escrow = await Escrow.findById(escrowId);
    if (!escrow) {
      throw new AppError('Escrow không tồn tại', 404);
    }

    if (escrow.farmerId.toString() !== userId) {
      throw new AppError('Chỉ nông dân mới có thể xác nhận mốc này', 403);
    }

    const milestone = escrow.milestones.find((m) => m.step === milestoneStep);
    if (!milestone) {
      throw new AppError('Mốc không tồn tại', 404);
    }

    if (milestone.status === 'completed') {
      throw new AppError('Mốc này đã hoàn thành', 400);
    }

    // Check previous milestones are completed
    const prevMilestones = escrow.milestones.filter(
      (m) => m.step < milestoneStep
    );
    const firstIncompleteMilestone = prevMilestones.find(
      (m) => m.status !== 'completed'
    );
    if (firstIncompleteMilestone) {
      throw new AppError(
        `Các mốc trước chưa hoàn thành: mốc ${firstIncompleteMilestone.step} (${firstIncompleteMilestone.name})`,
        400
      );
    }

    if (milestoneStep === 3) {
      const contract = await Contract.findById(escrow.contractId).select('productId');
      if (contract?.productId) {
        const product = await Product.findById(contract.productId).select('expectedDate');
        const harvestEligibility = getHarvestEligibility(product?.expectedDate);
        if (!harvestEligibility.shippingAllowed) {
          throw new AppError(
            harvestEligibility.reason || 'Chưa đến ngày thu hoạch nên chưa thể lên đơn vận chuyển',
            400
          );
        }
      }
    }

    milestone.farmerConfirmed = true;
    milestone.farmerConfirmedAt = new Date();
    milestone.status = 'in_progress';
    if (evidence) {
      milestone.evidence = evidence;
    }

    // Complete milestone if it only requires farmer confirmation, or if enterprise already confirmed
    if (milestone.requiredBy === 'farmer' || milestone.enterpriseConfirmed) {
      await this.completeMilestone(escrow, milestone);
    }

    await escrow.save();

    // Notify enterprise about farmer milestone confirmation
    try {
      const milestoneMessages: Record<number, string> = {
        2: `Nông dân đã xác nhận chuẩn bị hàng hóa xong. Vui lòng theo dõi tiến trình giao hàng.`,
        3: `Nông dân đã xác nhận gửi hàng${evidence ? ` (${evidence})` : ''}. Hệ thống sẽ thông báo lại sau 2 ngày để bạn xác nhận nhận hàng.`,
      };
      const msg = milestoneMessages[milestoneStep];
      if (msg) {
        await NotificationService.create({
          userId: escrow.enterpriseId.toString(),
          type: 'escrow',
          title: `Cập nhật mốc: ${milestone.name}`,
          message: msg,
          severity: milestoneStep === 3 ? 'warning' : 'info',
          relatedId: String(escrow._id),
          relatedModel: 'Escrow',
        });
      }
    } catch { /* non-critical */ }

    return escrow;
  }

  /**
   * Enterprise confirms a milestone (e.g., goods quality OK)
   */
  static async enterpriseConfirmMilestone(
    escrowId: string,
    userId: string,
    milestoneStep: number,
    evidence?: string
  ): Promise<IEscrow> {
    const escrow = await Escrow.findById(escrowId);
    if (!escrow) {
      throw new AppError('Escrow không tồn tại', 404);
    }

    if (escrow.enterpriseId.toString() !== userId) {
      throw new AppError('Chỉ doanh nghiệp mới có thể xác nhận mốc này', 403);
    }

    const milestone = escrow.milestones.find((m) => m.step === milestoneStep);
    if (!milestone) {
      throw new AppError('Mốc không tồn tại', 404);
    }

    if (milestone.status === 'completed') {
      throw new AppError('Mốc này đã hoàn thành', 400);
    }

    // Check previous milestones are completed
    const prevMilestones = escrow.milestones.filter(
      (m) => m.step < milestoneStep
    );
    const firstIncompleteMilestone = prevMilestones.find(
      (m) => m.status !== 'completed'
    );
    if (firstIncompleteMilestone) {
      throw new AppError(
        `Các mốc trước chưa hoàn thành: mốc ${firstIncompleteMilestone.step} (${firstIncompleteMilestone.name})`,
        400
      );
    }

    milestone.enterpriseConfirmed = true;
    milestone.enterpriseConfirmedAt = new Date();
    if (milestone.status === 'pending') {
      milestone.status = 'in_progress';
    }
    if (evidence) {
      milestone.evidence = evidence;
    }

    // Complete milestone if it only requires enterprise confirmation, or if farmer already confirmed
    if (milestone.requiredBy === 'enterprise' || milestone.farmerConfirmed) {
      await this.completeMilestone(escrow, milestone);
    }

    await escrow.save();

    // Notify farmer about enterprise confirmation
    try {
      const releaseAmt = milestone.releaseAmount ?? 0;
      const releaseMsg = releaseAmt > 0
        ? ` ${releaseAmt.toLocaleString('vi-VN')} VND đã được giải ngân vào tài khoản của bạn.`
        : '';
      await NotificationService.create({
        userId: escrow.farmerId.toString(),
        type: 'escrow',
        title: `Doanh nghiệp xác nhận: ${milestone.name}`,
        message: `Doanh nghiệp đã xác nhận mốc "${milestone.name}".${releaseMsg}`,
        severity: 'info',
        relatedId: String(escrow._id),
        relatedModel: 'Escrow',
      });
    } catch { /* non-critical */ }

    return escrow;
  }

  /**
   * Complete a milestone: mark done and release funds to farmer
   */
  private static async completeMilestone(
    escrow: IEscrow,
    milestone: IMilestone
  ): Promise<void> {
    milestone.status = 'completed';
    milestone.completedAt = new Date();

    const releaseAmount = milestone.releaseAmount;

    if (releaseAmount > 0) {
      // Release funds to farmer
      const farmer = await User.findById(escrow.farmerId);
      if (farmer) {
        const farmerBalanceBefore = farmer.virtualBalance;
        farmer.virtualBalance += releaseAmount;
        await farmer.save({ validateBeforeSave: false });

        await this.recordPaymentTransaction({
          userId: farmer._id,
          type: 'escrow_release',
          amount: releaseAmount,
          balanceBefore: farmerBalanceBefore,
          balanceAfter: farmer.virtualBalance,
          description: `Giải ngân từ ký quỹ — mốc ${milestone.step} (${milestone.name})`,
          metadata: {
            escrowId: escrow._id.toString(),
            contractId: escrow.contractId.toString(),
            milestoneStep: milestone.step,
          },
        });
      }

      escrow.releasedAmount += releaseAmount;

      // Record transaction
      escrow.transactions.push({
        type: 'release',
        amount: releaseAmount,
        fromUserId: escrow.enterpriseId,
        toUserId: escrow.farmerId,
        milestoneStep: milestone.step,
        description: `Giải ngân ${releaseAmount.toLocaleString('vi-VN')} VND — Mốc: ${milestone.name}`,
        createdAt: new Date(),
      });

      // Update escrow status
      if (escrow.releasedAmount >= escrow.totalAmount) {
        escrow.status = 'fully_released';
        // Complete the contract
        const contract = await Contract.findById(escrow.contractId);
        if (contract) {
          contract.status = 'completed';
          contract.completedAt = new Date();
          await contract.save();
        }
      } else {
        escrow.status = 'partially_released';
      }
    }

    // Check if this is the last milestone
    const allCompleted = escrow.milestones.every(
      (m) => m.status === 'completed'
    );
    if (allCompleted) {
      escrow.status = 'fully_released';
      const contract = await Contract.findById(escrow.contractId);
      if (contract && contract.status !== 'completed') {
        contract.status = 'completed';
        contract.completedAt = new Date();
        await contract.save();
      }
    }
  }

  /**
   * Enterprise raises a dispute on a milestone
   */
  static async raiseDispute(
    escrowId: string,
    userId: string,
    userRole: 'farmer' | 'enterprise',
    milestoneStep: number,
    reason: string,
    evidence: string[]
  ): Promise<IDispute> {
    const escrow = await Escrow.findById(escrowId);
    if (!escrow) {
      throw new AppError('Escrow không tồn tại', 404);
    }

    // Verify user is a party
    const isParty =
      escrow.farmerId.toString() === userId ||
      escrow.enterpriseId.toString() === userId;
    if (!isParty) {
      throw new AppError('Bạn không thuộc hợp đồng này', 403);
    }

    const milestone = escrow.milestones.find((m) => m.step === milestoneStep);
    if (!milestone) {
      throw new AppError('Mốc không tồn tại', 404);
    }

    // Mark milestone and escrow as disputed
    milestone.status = 'disputed';
    escrow.status = 'disputed';
    await escrow.save();

    // Update contract status
    const contract = await Contract.findById(escrow.contractId);
    if (contract) {
      contract.status = 'disputed';
      await contract.save();
    }

    // Determine against whom
    const againstUserId =
      escrow.farmerId.toString() === userId
        ? escrow.enterpriseId
        : escrow.farmerId;

    // Create dispute record for admin
    const dispute = await Dispute.create({
      contractId: escrow.contractId,
      escrowId: escrow._id,
      milestoneStep,
      raisedBy: new mongoose.Types.ObjectId(userId),
      raisedByRole: userRole,
      againstUserId,
      reason,
      evidence,
    });

    return dispute;
  }

  /**
   * Admin resolves a dispute
   */
  static async resolveDispute(
    disputeId: string,
    resolution: 'farmer' | 'enterprise',
    adminNotes: string
  ): Promise<IDispute> {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new AppError('Khiếu nại không tồn tại', 404);
    }

    const escrow = await Escrow.findById(dispute.escrowId);
    if (!escrow) {
      throw new AppError('Escrow không tồn tại', 404);
    }

    dispute.status = resolution === 'farmer' ? 'resolved_farmer' : 'resolved_enterprise';
    dispute.adminNotes = adminNotes;
    dispute.resolvedAt = new Date();
    dispute.resolution =
      resolution === 'farmer'
        ? 'Admin xác nhận nông dân đúng — tiền giải ngân cho nông dân'
        : 'Admin xác nhận doanh nghiệp đúng — hoàn tiền cho doanh nghiệp';
    await dispute.save();

    const milestone = escrow.milestones.find(
      (m) => m.step === dispute.milestoneStep
    );

    if (resolution === 'farmer' && milestone) {
      // Release funds to farmer
      milestone.status = 'completed';
      milestone.completedAt = new Date();
      milestone.farmerConfirmed = true;
      milestone.enterpriseConfirmed = true;
      await this.completeMilestone(escrow, milestone);
      escrow.status = escrow.releasedAmount >= escrow.totalAmount ? 'fully_released' : 'partially_released';
    } else if (resolution === 'enterprise') {
      // Refund remaining to enterprise
      const remainingAmount = escrow.depositedAmount - escrow.releasedAmount;
      if (remainingAmount > 0) {
        const enterprise = await User.findById(escrow.enterpriseId);
        if (enterprise) {
          const enterpriseBalanceBefore = enterprise.virtualBalance;
          enterprise.virtualBalance += remainingAmount;
          await enterprise.save({ validateBeforeSave: false });

          await this.recordPaymentTransaction({
            userId: enterprise._id,
            type: 'refund',
            amount: remainingAmount,
            balanceBefore: enterpriseBalanceBefore,
            balanceAfter: enterprise.virtualBalance,
            description: `Hoàn trả ký quỹ — tranh chấp mốc ${dispute.milestoneStep}`,
            metadata: {
              escrowId: escrow._id.toString(),
              contractId: escrow.contractId.toString(),
              milestoneStep: dispute.milestoneStep,
            },
          });
        }

        escrow.refundedAmount += remainingAmount;
        escrow.status = 'refunded';

        escrow.transactions.push({
          type: 'refund',
          amount: remainingAmount,
          fromUserId: escrow.farmerId,
          toUserId: escrow.enterpriseId,
          milestoneStep: dispute.milestoneStep,
          description: `Hoàn trả ${remainingAmount.toLocaleString('vi-VN')} VND cho doanh nghiệp — Tranh chấp được giải quyết`,
          createdAt: new Date(),
        });
      }

      // Cancel the contract
      const contract = await Contract.findById(escrow.contractId);
      if (contract) {
        contract.status = 'cancelled';
        contract.cancelledAt = new Date();
        contract.cancelReason = `Tranh chấp giải quyết có lợi cho doanh nghiệp`;
        await contract.save();
      }
    }

    await escrow.save();
    return dispute;
  }

  /**
   * Get escrow details by contract ID
   */
  static async getByContractId(
    contractId: string,
    userId: string
  ): Promise<IEscrow> {
    const escrow = await Escrow.findOne({ contractId })
      .populate('farmerId', 'fullName email phone reputationScore')
      .populate('enterpriseId', 'fullName email phone reputationScore');

    if (!escrow) {
      throw new AppError('Escrow không tồn tại cho hợp đồng này', 404);
    }

    // Only parties can view
    const isParty =
      refToId(escrow.farmerId) === userId ||
      refToId(escrow.enterpriseId) === userId;

    if (!isParty) {
      throw new AppError('Bạn không có quyền xem escrow này', 403);
    }

    return escrow;
  }

  /**
   * Get escrow by ID
   */
  static async getById(escrowId: string, userId: string): Promise<IEscrow> {
    const escrow = await Escrow.findById(escrowId)
      .populate('farmerId', 'fullName email phone reputationScore')
      .populate('enterpriseId', 'fullName email phone reputationScore');

    if (!escrow) {
      throw new AppError('Escrow không tồn tại', 404);
    }

    const isParty =
      refToId(escrow.farmerId) === userId ||
      refToId(escrow.enterpriseId) === userId;

    if (!isParty) {
      throw new AppError('Bạn không có quyền xem escrow này', 403);
    }

    return escrow;
  }

  /**
   * List all escrows for a user
   */
  static async listByUser(
    userId: string,
    role: 'farmer' | 'enterprise'
  ): Promise<IEscrow[]> {
    const query =
      role === 'farmer'
        ? { farmerId: userId }
        : { enterpriseId: userId };

    return Escrow.find(query)
      .populate('contractId', 'contractCode productName totalValue status')
      .populate('farmerId', 'fullName')
      .populate('enterpriseId', 'fullName')
      .sort({ createdAt: -1 });
  }

  /**
   * Get all disputes for admin
   */
  static async listDisputes(
    status?: string
  ): Promise<IDispute[]> {
    const query = status ? { status } : {};
    return Dispute.find(query)
      .populate('contractId', 'contractCode productName totalValue')
      .populate('raisedBy', 'fullName role')
      .populate('againstUserId', 'fullName role')
      .sort({ createdAt: -1 });
  }

  /**
   * Get disputes for a specific user
   */
  static async listUserDisputes(userId: string): Promise<IDispute[]> {
    return Dispute.find({
      $or: [{ raisedBy: userId }, { againstUserId: userId }],
    })
      .populate('contractId', 'contractCode productName totalValue')
      .populate('raisedBy', 'fullName role')
      .populate('againstUserId', 'fullName role')
      .sort({ createdAt: -1 });
  }
}
