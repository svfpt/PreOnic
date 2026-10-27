import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { PaymentService } from '../services/payment.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../constants';
import { successResponse } from '../utils/response.util';

// Chuẩn hóa tham số phân trang để controller không phải lặp lại logic parse ở nhiều nơi.
const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

/**
 * POST /payment/topup — Create a top-up request for the active payment gateway
 */
export const createTopup = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { amount, description } = req.body;
    const result = await PaymentService.createTopup(
      req.user!.id,
      Number(amount),
      description
    );
    res.status(200).json(successResponse(result, 'Tạo liên kết thanh toán thành công'));
  }
);

/**
 * POST /payment/topup/verify — Verify payment after return from gateway
 */
export const verifyTopup = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { orderCode } = req.body;
    const result = await PaymentService.verifyAndProcess(Number(orderCode));
    res.status(200).json(successResponse(result, result.success ? 'Nạp tiền thành công' : 'Giao dịch chưa hoàn tất'));
  }
);

/**
 * POST /payment/webhook — Payment gateway webhook handler
 */
export const handleWebhook = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await PaymentService.handleWebhook(
      req.body,
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined
    );
    res.status(200).json({ success: true });
  }
);

/**
 * POST /payment/demo-topup — Demo instant top-up (no real payment)
 */
export const demoTopup = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { amount } = req.body;
    const result = await PaymentService.demoTopup(req.user!.id, Number(amount));
    res.status(200).json(successResponse(result, 'Nạp tiền demo thành công'));
  }
);

/**
 * GET /payment/wallet — Get wallet info + stats
 */
export const getWalletInfo = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const result = await PaymentService.getWalletInfo(req.user!.id);
    res.status(200).json(successResponse(result));
  }
);

/**
 * GET /payment/transactions — Get transaction history
 */
export const getTransactions = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
    const limit = parsePositiveInteger(req.query.limit, DEFAULT_PAGE_SIZE);
    const type = req.query.type as string | undefined;
    const result = await PaymentService.getTransactions(
      req.user!.id,
      page,
      limit,
      type
    );
    res.status(200).json(successResponse(result));
  }
);

/**
 * POST /payment/cancel — Cancel a pending topup
 */
export const cancelTopup = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { orderCode } = req.body;
    const result = await PaymentService.cancelTopup(
      Number(orderCode),
      req.user!.id
    );
    res.status(200).json(successResponse(result, 'Đã hủy giao dịch'));
  }
);
