import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { EscrowService } from '../services/escrow.service';
import User from '../models/User.model';

/**
 * Create escrow for a contract
 * POST /api/v1/escrow
 */
export const createEscrow = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const escrow = await EscrowService.createEscrow(
      req.body.contractId,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Tạo escrow thành công!',
      data: { escrow },
    });
  }
);

/**
 * Enterprise deposits money
 * POST /api/v1/escrow/:id/deposit
 */
export const deposit = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const escrow = await EscrowService.deposit(
      req.params.id,
      req.user!.id,
      req.body.amount
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Đặt cọc ký quỹ thành công!',
      data: { escrow },
    });
  }
);

/**
 * Farmer confirms milestone
 * POST /api/v1/escrow/:id/farmer-confirm
 */
export const farmerConfirm = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const escrow = await EscrowService.farmerConfirmMilestone(
      req.params.id,
      req.user!.id,
      req.body.milestoneStep,
      req.body.evidence
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Nông dân xác nhận mốc thành công!',
      data: { escrow },
    });
  }
);

/**
 * Enterprise confirms milestone
 * POST /api/v1/escrow/:id/enterprise-confirm
 */
export const enterpriseConfirm = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const escrow = await EscrowService.enterpriseConfirmMilestone(
      req.params.id,
      req.user!.id,
      req.body.milestoneStep,
      req.body.evidence
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Doanh nghiệp xác nhận mốc thành công!',
      data: { escrow },
    });
  }
);

/**
 * Raise a dispute
 * POST /api/v1/escrow/:id/dispute
 */
export const raiseDispute = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (req.user!.role === 'admin') {
      throw new AppError('Admin không thể tạo khiếu nại thay cho các bên trong hợp đồng', 403);
    }

    const dispute = await EscrowService.raiseDispute(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body.milestoneStep,
      req.body.reason,
      req.body.evidence || []
    );

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Khiếu nại đã được tạo. Admin sẽ xem xét.',
      data: { dispute },
    });
  }
);

/**
 * Get escrow by contract ID
 * GET /api/v1/escrow/contract/:contractId
 */
export const getByContract = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const escrow = await EscrowService.getByContractId(
      req.params.contractId,
      req.user!.id
    );

    res.status(200).json({
      success: true,
      status: 'success',
      data: { escrow },
    });
  }
);

/**
 * Get escrow by ID
 * GET /api/v1/escrow/:id
 */
export const getEscrow = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const escrow = await EscrowService.getById(
      req.params.id,
      req.user!.id
    );

    res.status(200).json({
      success: true,
      status: 'success',
      data: { escrow },
    });
  }
);

/**
 * List user's escrows
 * GET /api/v1/escrow
 */
export const listEscrows = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (req.user!.role === 'admin') {
      throw new AppError('Admin không thể truy vấn escrow theo vai trò người dùng', 403);
    }

    const escrows = await EscrowService.listByUser(
      req.user!.id,
      req.user!.role
    );

    res.status(200).json({
      success: true,
      status: 'success',
      data: { escrows, total: escrows.length },
    });
  }
);

/**
 * List user's disputes
 * GET /api/v1/escrow/disputes
 */
export const listUserDisputes = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const disputes = await EscrowService.listUserDisputes(req.user!.id);

    res.status(200).json({
      success: true,
      status: 'success',
      data: { disputes, total: disputes.length },
    });
  }
);

/**
 * Admin: Resolve dispute
 * POST /api/v1/escrow/disputes/:id/resolve
 * (Restricted to admin)
 */
export const resolveDispute = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const dispute = await EscrowService.resolveDispute(
      req.params.id,
      req.body.resolution,
      req.body.adminNotes || ''
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Khiếu nại đã được giải quyết!',
      data: { dispute },
    });
  }
);

/**
 * Get user's virtual balance
 * GET /api/v1/escrow/balance
 */
export const getBalance = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const user = await User.findById(req.user!.id).select('virtualBalance fullName role');
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 404);
    }

    res.status(200).json({
      success: true,
      status: 'success',
      data: {
        balance: user.virtualBalance,
        fullName: user.fullName,
        role: user.role,
      },
    });
  }
);
