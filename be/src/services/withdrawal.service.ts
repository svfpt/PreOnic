import mongoose, { ClientSession } from 'mongoose';
import { randomUUID } from 'crypto';
import { Payout } from '@payos/node';
import WithdrawalRequest, {
  IWithdrawalRequest,
} from '../models/WithdrawalRequest.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import Notification from '../models/Notification.model';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';
import { getPayoutClient, requirePayoutEnabled } from '../config/payos-payout';
import { PAYMENT_LIMITS, DEFAULT_PAGE_SIZE } from '../constants';
import banks from '../data/banks.json';

export interface CreateWithdrawalBody {
  amount: number;
  bankName: string;
  bankBin?: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  note?: string;
}
const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const validateId = (id: string) => {
  if (!mongoose.isValidObjectId(id))
    throw new AppError('Mã yêu cầu không hợp lệ', 400);
};

export class WithdrawalService {
  static getBanks() {
    return banks;
  }

  private static resolveBank(
    body: Pick<CreateWithdrawalBody, 'bankBin' | 'bankName'>,
  ) {
    const bank = body.bankBin
      ? banks.find((item) => item.bin === body.bankBin)
      : banks.find(
          (item) =>
            normalized(item.shortName) ===
              normalized(text(body.bankName, 150)) ||
            normalized(item.name) === normalized(text(body.bankName, 150)),
        );
    if (!bank)
      throw new AppError(
        'Vui lòng chọn ngân hàng nhận tiền trong danh sách hỗ trợ',
        400,
      );
    return bank;
  }

  private static async reserve(
    request: IWithdrawalRequest,
    session: ClientSession,
  ) {
    if (request.fundsReserved) return;
    const wallet = await User.findOneAndUpdate(
      { _id: request.userId, virtualBalance: { $gte: request.amount } },
      { $inc: { virtualBalance: -request.amount, __v: 1 } },
      { new: true, session },
    );
    if (!wallet)
      throw new AppError(
        'Số dư khả dụng không đủ để giữ tiền cho yêu cầu rút',
        400,
      );
    await PaymentTransaction.create(
      [
        {
          userId: request.userId,
          type: 'withdrawal',
          amount: request.amount,
          status: 'pending',
          paymentMethod: 'payos',
          description: `Giữ tiền rút về ${request.bankName}`,
          balanceBefore: wallet.virtualBalance + request.amount,
          balanceAfter: wallet.virtualBalance,
          metadata: { withdrawalRequestId: String(request._id) },
        },
      ],
      { session },
    );
    request.fundsReserved = true;
    await request.save({ session });
  }

  // Reserve existing pending requests before allowing more withdrawals by the same user.
  static async reserveLegacyRequests(userId: string) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const legacy = await WithdrawalRequest.find({
          userId,
          status: 'pending',
          fundsReserved: { $ne: true },
        })
          .sort({ createdAt: 1 })
          .session(session);
        for (const request of legacy) await this.reserve(request, session);
      });
    } finally {
      await session.endSession();
    }
  }

  static async createRequest(
    userId: string,
    body: CreateWithdrawalBody,
  ): Promise<IWithdrawalRequest> {
    const amount = Number(body.amount);
    if (
      !Number.isSafeInteger(amount) ||
      amount < PAYMENT_LIMITS.MIN_TOPUP_VND ||
      amount > PAYMENT_LIMITS.MAX_TOPUP_VND
    ) {
      throw new AppError(
        'Số tiền rút phải là số nguyên từ 10.000 đến 500.000.000 VND',
        400,
      );
    }
    const bank = this.resolveBank(body);
    const account = text(body.bankAccountNumber, 40);
    const holder = text(body.bankAccountHolder, 120);
    if (!/^\d{4,30}$/.test(account) || holder.length < 2)
      throw new AppError('Thông tin tài khoản ngân hàng không hợp lệ', 400);
    await this.reserveLegacyRequests(userId);
    const session = await mongoose.startSession();
    let request!: IWithdrawalRequest;
    try {
      await session.withTransaction(async () => {
        [request] = await WithdrawalRequest.create(
          [
            {
              userId,
              amount,
              bankName: bank.shortName,
              bankBin: bank.bin,
              bankAccountNumber: account,
              bankAccountHolder: holder,
              note: text(body.note, 500),
              status: 'pending',
            },
          ],
          { session },
        );
        await this.reserve(request, session);
      });
    } finally {
      await session.endSession();
    }
    return request;
  }

  static async getUserRequests(userId: string) {
    const [requests, user] = await Promise.all([
      WithdrawalRequest.find({ userId }).sort({ createdAt: -1 }),
      User.findById(userId).select('virtualBalance'),
    ]);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);
    const active = requests.filter((request) =>
      ['pending', 'processing'].includes(request.status),
    );
    const pendingTotal = active.reduce(
      (sum, request) => sum + request.amount,
      0,
    );
    const unreserved = active
      .filter((request) => !request.fundsReserved)
      .reduce((sum, request) => sum + request.amount, 0);
    return {
      requests,
      balance: user.virtualBalance + pendingTotal - unreserved,
      pendingTotal,
      available: Math.max(0, user.virtualBalance - unreserved),
    };
  }

  static async listAll(status?: string, page = 1, limit = DEFAULT_PAGE_SIZE) {
    if (
      status &&
      !['pending', 'processing', 'completed', 'rejected', 'failed'].includes(
        status,
      )
    )
      throw new AppError('Trạng thái không hợp lệ', 400);
    const filter = status ? { status } : {};
    const [requests, total] = await Promise.all([
      WithdrawalRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'fullName role virtualBalance')
        .populate('processedBy', 'fullName'),
      WithdrawalRequest.countDocuments(filter),
    ]);
    return {
      requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async approve(requestId: string, adminId: string, adminNote?: string) {
    validateId(requestId);
    const { client, channel } = requirePayoutEnabled();
    const preview = await WithdrawalRequest.findById(requestId);
    if (!preview) throw new AppError('Đơn rút tiền không tồn tại', 404);
    if (preview.status === 'pending') {
      let account;
      try {
        account = await client.payoutsAccount.balance();
      } catch {
        throw new AppError(
          'Không kiểm tra được nguồn tiền kênh chi payOS. Kiểm tra bộ khóa, IP được phép và trạng thái kênh chi.',
          503,
        );
      }
      const balance = Number(account.balance);
      if (account.currency !== 'VND' || !Number.isFinite(balance))
        throw new AppError('Số dư nguồn chi payOS không hợp lệ', 503);
      if (balance < preview.amount)
        throw new AppError(
          'Nguồn tiền chi payOS không đủ. Cần nạp bổ sung trước khi phê duyệt.',
          400,
        );
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const request =
          await WithdrawalRequest.findById(requestId).session(session);
        if (!request) throw new AppError('Đơn rút tiền không tồn tại', 404);
        if (request.status === 'processing' || request.status === 'completed')
          return;
        if (request.status !== 'pending')
          throw new AppError('Đơn này đã được xử lý', 409);
        const bank = this.resolveBank(request);
        await this.reserve(request, session);
        request.bankBin = bank.bin;
        request.status = 'processing';
        request.processedBy = new mongoose.Types.ObjectId(adminId);
        request.adminNote = text(adminNote, 500);
        request.payoutReference = `withdraw-${request._id}`;
        request.idempotencyKey = randomUUID();
        request.payoutChannel = channel;
        await request.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return this.sync(requestId);
  }

  static async reject(requestId: string, adminId: string, adminNote?: string) {
    validateId(requestId);
    const reason = text(adminNote, 500);
    if (!reason) throw new AppError('Vui lòng nhập lý do từ chối', 400);
    await this.finish(requestId, 'rejected', 'pending', reason, adminId);
    return (await WithdrawalRequest.findById(requestId))!;
  }

  private static async finish(
    requestId: string,
    status: 'completed' | 'failed' | 'rejected',
    expected: 'pending' | 'processing',
    note?: string,
    adminId?: string,
  ) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const request = await WithdrawalRequest.findOne({
          _id: requestId,
          status: expected,
        }).session(session);
        if (!request) {
          const existing =
            await WithdrawalRequest.findById(requestId).session(session);
          if (!existing) throw new AppError('Đơn rút tiền không tồn tại', 404);
          if (existing.status === status) return;
          throw new AppError(
            'Yêu cầu đã được xử lý hoặc đang chuyển tiền, không thể thay đổi',
            409,
          );
        }
        if (status === 'completed' && !request.fundsReserved)
          throw new AppError('Yêu cầu chưa giữ số dư, cần đối soát', 409);
        if (status !== 'completed' && request.fundsReserved) {
          const wallet = await User.findByIdAndUpdate(
            request.userId,
            { $inc: { virtualBalance: request.amount, __v: 1 } },
            { new: true, session },
          );
          if (!wallet) throw new AppError('Người dùng không tồn tại', 404);
          await PaymentTransaction.create(
            [
              {
                userId: request.userId,
                type: 'refund',
                amount: request.amount,
                status: 'completed',
                paymentMethod: 'internal',
                description: 'Giải phóng tiền giữ cho yêu cầu rút',
                balanceBefore: wallet.virtualBalance - request.amount,
                balanceAfter: wallet.virtualBalance,
                completedAt: new Date(),
                metadata: { withdrawalRequestId: requestId },
              },
            ],
            { session },
          );
        }
        await PaymentTransaction.updateOne(
          {
            type: 'withdrawal',
            'metadata.withdrawalRequestId': requestId,
            status: 'pending',
          },
          {
            $set: {
              status:
                status === 'completed'
                  ? 'completed'
                  : status === 'rejected'
                    ? 'cancelled'
                    : 'failed',
              completedAt: new Date(),
              gatewayRef: request.payoutId,
            },
          },
          { session },
        );
        request.status = status;
        request.fundsReserved = false;
        request.processedAt = new Date();
        if (adminId) request.processedBy = new mongoose.Types.ObjectId(adminId);
        if (note) request.adminNote = note;
        await request.save({ session });
        await Notification.create(
          [
            {
              userId: request.userId,
              type: 'system',
              severity: status === 'completed' ? 'info' : 'warning',
              title:
                status === 'completed'
                  ? 'Rút tiền thành công'
                  : status === 'rejected'
                    ? 'Yêu cầu rút bị từ chối'
                    : 'Chuyển tiền thất bại',
              message:
                status === 'completed'
                  ? `Đã chuyển ${request.amount.toLocaleString('vi-VN')} VND về ngân hàng của bạn.`
                  : `Yêu cầu ${request.amount.toLocaleString('vi-VN')} VND không thực hiện. Tiền đang giữ đã được giải phóng.${note ? ' ' + note : ''}`,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private static async applyPayout(
    request: IWithdrawalRequest,
    payout: Payout,
  ) {
    if (!payout.id || payout.referenceId !== request.payoutReference)
      throw new AppError('Mã lệnh chi không khớp, cần đối soát', 409);
    const transactions = payout.transactions || [];
    if (transactions.length > 1)
      throw new AppError('Lệnh chi có nhiều giao dịch, cần đối soát', 409);
    const transaction = transactions[0];
    if (
      transaction &&
      (transaction.referenceId !== request.payoutReference ||
        transaction.amount !== request.amount ||
        transaction.toBin !== request.bankBin ||
        transaction.toAccountNumber !== request.bankAccountNumber)
    ) {
      throw new AppError(
        'Thông tin người nhận hoặc số tiền không khớp, cần đối soát',
        409,
      );
    }
    await WithdrawalRequest.updateOne(
      { _id: request._id, status: 'processing' },
      {
        $set: {
          payoutId: payout.id,
          lastCheckedAt: new Date(),
          lastError: '',
        },
      },
    );
    request.payoutId = payout.id;
    if (transaction?.state === 'SUCCEEDED')
      await this.finish(String(request._id), 'completed', 'processing');
    else if (
      transaction &&
      ['FAILED', 'CANCELLED', 'REVERSED'].includes(transaction.state)
    ) {
      await this.finish(
        String(request._id),
        'failed',
        'processing',
        'payOS xác nhận lệnh chuyển tiền không thành công',
      );
    } else if (
      !transaction &&
      ['REJECTED', 'CANCELLED', 'FAILED'].includes(payout.approvalState)
    ) {
      await this.finish(
        String(request._id),
        'failed',
        'processing',
        'payOS từ chối hoặc hủy lệnh chi',
      );
    }
  }

  // Never resend an uncertain create request. Reconcile using its durable reference instead.
  static async sync(requestId: string) {
    validateId(requestId);
    let request = await WithdrawalRequest.findById(requestId);
    if (!request) throw new AppError('Đơn rút tiền không tồn tại', 404);
    if (request.status !== 'processing') return request;
    try {
      const { client, channel } = getPayoutClient();
      if (channel !== request.payoutChannel)
        throw new AppError(
          'Kênh chi đã thay đổi. Cần đối soát bằng kênh chi gốc.',
          409,
        );
      if (!request.dispatchAttemptedAt) {
        requirePayoutEnabled();
        const claimed = await WithdrawalRequest.findOneAndUpdate(
          {
            _id: requestId,
            status: 'processing',
            dispatchAttemptedAt: { $exists: false },
          },
          { $set: { dispatchAttemptedAt: new Date() } },
          { new: true },
        );
        if (!claimed) return (await WithdrawalRequest.findById(requestId))!;
        request = claimed;
        const payout = await client.payouts.create(
          {
            referenceId: request.payoutReference!,
            amount: request.amount,
            description: `Rut tien ${String(request._id).slice(-8)}`,
            toBin: request.bankBin!,
            toAccountNumber: request.bankAccountNumber,
          },
          request.idempotencyKey!,
        );
        await this.applyPayout(request, payout);
      } else if (request.payoutId) {
        await this.applyPayout(
          request,
          await client.payouts.get(request.payoutId),
        );
      } else {
        const page = await client.payouts.list({
          referenceId: request.payoutReference,
          limit: 10,
        });
        const matches = page.data.filter(
          (payout) => payout.referenceId === request!.payoutReference,
        );
        if (matches.length !== 1)
          throw new AppError(
            'Chưa xác định kết quả lệnh chi. Đang đối soát, không tạo lệnh mới.',
            409,
          );
        await this.applyPayout(request, matches[0]);
      }
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : 'Chưa xác định kết quả từ payOS. Hệ thống đang đối soát và giữ tiền để tránh chuyển trùng.';
      await WithdrawalRequest.updateOne(
        { _id: requestId, status: 'processing' },
        { $set: { lastError: message, lastCheckedAt: new Date() } },
      );
    }
    return (await WithdrawalRequest.findById(requestId))!;
  }

  static async reconcilePending() {
    const requests = await WithdrawalRequest.find({ status: 'processing' })
      .sort({ lastCheckedAt: 1 })
      .limit(50)
      .select('_id');
    for (const request of requests) await this.sync(String(request._id));
  }
}
