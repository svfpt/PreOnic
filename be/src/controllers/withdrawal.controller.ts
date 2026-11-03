import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { WithdrawalService } from '../services/withdrawal.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { successResponse } from '../utils/response.util';

// ===== User =====

// POST /payment/withdrawals — tạo đơn xin rút tiền
export const createWithdrawal = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const request = await WithdrawalService.createRequest(
      req.user!.id,
      req.body,
    );
    res
      .status(201)
      .json(
        successResponse(
          { request },
          'Đã gửi yêu cầu rút tiền. Vui lòng chờ quản trị viên duyệt.',
        ),
      );
  },
);

// GET /payment/withdrawals — danh sách đơn rút của chính user + số dư khả dụng
export const getMyWithdrawals = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const data = await WithdrawalService.getUserRequests(req.user!.id);
    res.status(200).json(successResponse(data));
  },
);

// ===== Admin =====

// GET /admin/withdrawals — danh sách tất cả đơn (lọc theo status)
export const adminListWithdrawals = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit as string) || 20),
    );
    const status = req.query.status as string | undefined;
    const data = await WithdrawalService.listAll(status, page, limit);
    res.status(200).json(successResponse(data));
  },
);

// Approval authorizes a payout; only payOS confirmation completes the request.
export const adminApproveWithdrawal = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const request = await WithdrawalService.approve(
      req.params.id,
      req.user!.id,
      req.body.adminNote,
    );
    res
      .status(200)
      .json(
        successResponse(
          { request },
          request.status === 'completed'
            ? 'payOS đã xác nhận chuyển tiền thành công'
            : 'Yêu cầu đã được phê duyệt. Đang chuyển tiền hoặc đối soát kết quả.',
        ),
      );
  },
);

export const adminSyncWithdrawal = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const request = await WithdrawalService.sync(req.params.id);
    res.status(200).json(successResponse({ request }));
  },
);

export const getWithdrawalBanks = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    res
      .status(200)
      .json(successResponse({ banks: WithdrawalService.getBanks() }));
  },
);

// PATCH /admin/withdrawals/:id/reject — từ chối đơn
export const adminRejectWithdrawal = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const request = await WithdrawalService.reject(
      req.params.id,
      req.user!.id,
      req.body.adminNote,
    );
    res
      .status(200)
      .json(successResponse({ request }, 'Đã từ chối đơn rút tiền.'));
  },
);
