import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import { ContractService } from '../services/contract.service';

/**
 * Create a new contract
 * POST /api/v1/contracts
 */
export const createContract = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const contract = await ContractService.create(req.body, req.user!.id, req.user!.role);

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Tạo hợp đồng thành công!',
      data: { contract },
    });
  }
);

/**
 * Get contract by ID
 * GET /api/v1/contracts/:id
 */
export const getContract = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const contract = await ContractService.getById(
      req.params.id,
      req.user!.id
    );

    res.status(200).json({
      success: true,
      status: 'success',
      data: { contract },
    });
  }
);

/**
 * List user's contracts
 * GET /api/v1/contracts
 */
export const listContracts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const status = req.query.status as string | undefined;
    const contracts = await ContractService.listByUser(
      req.user!.id,
      req.user!.role,
      status
    );

    res.status(200).json({
      success: true,
      status: 'success',
      data: { contracts, total: contracts.length },
    });
  }
);

/**
 * Request OTP for contract signing (enterprise only)
 * POST /api/v1/contracts/:id/request-sign-otp
 */
export const requestSignOtp = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await ContractService.requestSignOtp(req.params.id, req.user!.id);

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Mã OTP đã được gửi đến email của bạn',
    });
  }
);

/**
 * Sign a contract
 * POST /api/v1/contracts/:id/sign
 */
export const signContract = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const contract = await ContractService.sign(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body.otp
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Ký hợp đồng thành công!',
      data: { contract },
    });
  }
);

/**
 * Cancel a contract
 * POST /api/v1/contracts/:id/cancel
 */
export const cancelContract = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const contract = await ContractService.cancel(
      req.params.id,
      req.user!.id,
      req.body.reason || 'Không có lý do'
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Hủy hợp đồng thành công!',
      data: { contract },
    });
  }
);

/**
 * Reject a contract (farmer rejects before signing)
 * POST /api/v1/contracts/:id/reject
 */
export const rejectContract = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const contract = await ContractService.reject(
      req.params.id,
      req.user!.id,
      req.body.reason || 'Không có lý do'
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Từ chối hợp đồng thành công!',
      data: { contract },
    });
  }
);
