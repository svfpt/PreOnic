// Nghiệp vụ Rút tiền: User gửi đơn -> Admin duyệt -> hệ thống trừ số dư.
import mongoose from 'mongoose';
import WithdrawalRequest, { IWithdrawalRequest } from '../models/WithdrawalRequest.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';
import { NotificationService } from './notification.service';
import { PAYMENT_LIMITS, DEFAULT_PAGE_SIZE } from '../constants';

const MIN_WITHDRAWAL_VND = PAYMENT_LIMITS.MIN_TOPUP_VND; // 10.000 VND

export interface CreateWithdrawalBody {
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  note?: string;
}

export class WithdrawalService {
  // Tổng số tiền đang bị "treo" trong các đơn rút chờ duyệt (để không cho rút vượt số dư).
  private static async getPendingTotal(userId: string): Promise<number> {
    const rows = await WithdrawalRequest.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return rows[0]?.total || 0;
  }

  static async createRequest(userId: string, body: CreateWithdrawalBody): Promise<IWithdrawalRequest> {
    const amount = Math.round(Number(body.amount));
    if (!amount || amount < MIN_WITHDRAWAL_VND) {
      throw new AppError(`Số tiền rút tối thiểu ${MIN_WITHDRAWAL_VND.toLocaleString('vi-VN')} VND`, 400);
    }
    if (!body.bankName?.trim() || !body.bankAccountNumber?.trim() || !body.bankAccountHolder?.trim()) {
      throw new AppError('Vui lòng nhập đầy đủ thông tin ngân hàng nhận tiền', 400);
    }

    const user = await User.findById(userId).select('virtualBalance');
    if (!user) throw new AppError('Người dùng không tồn tại', 404);

    const pending = await this.getPendingTotal(userId);
    const available = user.virtualBalance - pending;
    if (amount > available) {
      throw new AppError(
        `Số dư khả dụng không đủ. Khả dụng: ${available.toLocaleString('vi-VN')} VND (đã trừ ${pending.toLocaleString('vi-VN')} VND đang chờ duyệt)`,
        400
      );
    }

    return WithdrawalRequest.create({
      userId,
      amount,
      bankName: body.bankName.trim(),
      bankAccountNumber: body.bankAccountNumber.trim(),
      bankAccountHolder: body.bankAccountHolder.trim(),
      note: body.note?.trim(),
      status: 'pending',
    });
  }

  static async getUserRequests(userId: string) {
    const requests = await WithdrawalRequest.find({ userId }).sort({ createdAt: -1 });
    const user = await User.findById(userId).select('virtualBalance');
    const pending = await this.getPendingTotal(userId);
    return {
      requests,
      balance: user?.virtualBalance || 0,
      pendingTotal: pending,
      available: (user?.virtualBalance || 0) - pending,
    };
  }

  // ===== Admin =====
  static async listAll(status?: string, page = 1, limit = DEFAULT_PAGE_SIZE) {
    const filter: any = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      WithdrawalRequest.find(filter)
        .sort({ status: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName role virtualBalance')
        .populate('processedBy', 'fullName'),
      WithdrawalRequest.countDocuments(filter),
    ]);
    return { requests, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Admin xác nhận đã chuyển khoản -> trừ số dư user và ghi nhận giao dịch.
  static async complete(requestId: string, adminId: string, adminNote?: string): Promise<IWithdrawalRequest> {
    const reqDoc = await WithdrawalRequest.findById(requestId);
    if (!reqDoc) throw new AppError('Đơn rút tiền không tồn tại', 404);
    if (reqDoc.status !== 'pending') {
      throw new AppError('Đơn này đã được xử lý', 400);
    }

    const user = await User.findById(reqDoc.userId);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);
    if (user.virtualBalance < reqDoc.amount) {
      throw new AppError('Số dư của người dùng không đủ để hoàn tất rút tiền', 400);
    }

    const balanceBefore = user.virtualBalance;
    user.virtualBalance -= reqDoc.amount;
    await user.save({ validateBeforeSave: false });

    await PaymentTransaction.create({
      userId: user._id,
      type: 'withdrawal',
      amount: reqDoc.amount,
      status: 'completed',
      paymentMethod: 'bank_transfer',
      description: `Rút tiền về ${reqDoc.bankName} - ${reqDoc.bankAccountNumber}`,
      balanceBefore,
      balanceAfter: user.virtualBalance,
      completedAt: new Date(),
      metadata: {
        withdrawalRequestId: String(reqDoc._id),
        bankAccountHolder: reqDoc.bankAccountHolder,
        processedBy: adminId,
      },
    });

    reqDoc.status = 'completed';
    reqDoc.adminNote = adminNote?.trim();
    reqDoc.processedBy = adminId as any;
    reqDoc.processedAt = new Date();
    await reqDoc.save();

    await NotificationService.create({
      userId: String(reqDoc.userId),
      type: 'system',
      title: 'Yêu cầu rút tiền đã hoàn tất',
      message: `Đơn rút ${reqDoc.amount.toLocaleString('vi-VN')} VND về ${reqDoc.bankName} (${reqDoc.bankAccountNumber}) đã được chuyển khoản. Số dư hiện tại: ${user.virtualBalance.toLocaleString('vi-VN')} VND.`,
      severity: 'info',
    });

    return reqDoc;
  }

  static async reject(requestId: string, adminId: string, adminNote?: string): Promise<IWithdrawalRequest> {
    const reqDoc = await WithdrawalRequest.findById(requestId);
    if (!reqDoc) throw new AppError('Đơn rút tiền không tồn tại', 404);
    if (reqDoc.status !== 'pending') {
      throw new AppError('Đơn này đã được xử lý', 400);
    }

    reqDoc.status = 'rejected';
    reqDoc.adminNote = adminNote?.trim();
    reqDoc.processedBy = adminId as any;
    reqDoc.processedAt = new Date();
    await reqDoc.save();

    await NotificationService.create({
      userId: String(reqDoc.userId),
      type: 'system',
      title: 'Yêu cầu rút tiền bị từ chối',
      message: `Đơn rút ${reqDoc.amount.toLocaleString('vi-VN')} VND đã bị từ chối.${adminNote ? ' Lý do: ' + adminNote : ''} Số dư của bạn không thay đổi.`,
      severity: 'warning',
    });

    return reqDoc;
  }
}
