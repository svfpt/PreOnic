import mongoose from 'mongoose';
import { randomInt } from 'crypto';
import { PayOS } from '@payos/node';
import User from '../models/User.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { AppError } from '../middlewares/error.middleware';
import { PAYMENT_LIMITS } from '../constants';
import { createLogger } from '../utils/logger';

const log = createLogger('Payment');

const gatewayError = (error: unknown): AppError => {
  const detail = error as { name?: string; code?: string; status?: number };
  // Do not log SDK request objects, headers or credentials.
  log.warn('payOS request failed', {
    name: detail?.name,
    code: detail?.code,
    status: detail?.status,
  });
  return new AppError(
    'Không thể kết nối payOS lúc này. Vui lòng kiểm tra lại giao dịch sau, không chuyển tiền lần nữa.',
    502,
  );
};

// Initialize lazily: importing routes must not require payment credentials.
export const getPayOS = () => {
  const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID?.trim();
  const PAYOS_API_KEY = process.env.PAYOS_API_KEY?.trim();
  const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY?.trim();
  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
    throw new AppError(
      'Chưa cấu hình payOS. Vui lòng điền PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong .env',
      503,
    );
  }
  return new PayOS({
    clientId: PAYOS_CLIENT_ID,
    apiKey: PAYOS_API_KEY,
    checksumKey: PAYOS_CHECKSUM_KEY,
    timeout: 15000,
    maxRetries: 0,
  });
};

const validateOrderCode = (orderCode: number) => {
  if (!Number.isSafeInteger(orderCode) || orderCode <= 0)
    throw new AppError('Mã giao dịch không hợp lệ', 400);
};

export class PaymentService {
  static async createTopup(
    userId: string,
    amount: number,
    description?: string,
  ) {
    if (
      !Number.isSafeInteger(amount) ||
      amount < PAYMENT_LIMITS.MIN_TOPUP_VND ||
      amount > PAYMENT_LIMITS.MAX_TOPUP_VND
    ) {
      throw new AppError(
        'Số tiền nạp phải là số nguyên từ 10.000 đến 500.000.000 VND',
        400,
      );
    }
    const payos = getPayOS();
    const user = await User.findById(userId);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);
    const topology = await mongoose.connection
      .db!.admin()
      .command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') {
      throw new AppError(
        'Thanh toán payOS cần MongoDB replica set hoặc Atlas để cập nhật ví an toàn',
        503,
      );
    }
    let frontend: string;
    try {
      const url = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Invalid protocol');
      frontend = url.origin;
    } catch {
      throw new AppError('FRONTEND_URL chưa được cấu hình hợp lệ', 503);
    }
    const orderCode = Date.now() * 1000 + randomInt(1000);
    const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;
    const transaction = await PaymentTransaction.create({
      userId,
      type: 'topup',
      amount,
      status: 'pending',
      paymentMethod: 'payos',
      orderCode,
      description:
        typeof description === 'string' && description.trim()
          ? description.trim().slice(0, 255)
          : `Nạp ${amount.toLocaleString('vi-VN')} VND qua payOS`,
      balanceBefore: user.virtualBalance,
      balanceAfter: user.virtualBalance,
      metadata: { expiredAt },
    });
    // Keep pending on a network error: payOS may have created the link already.
    // Verification by orderCode can reconcile the outcome later.
    let link;
    try {
      link = await payos.paymentRequests.create({
        orderCode,
        amount,
        description: `PON${String(orderCode).slice(-6)}`,
        returnUrl: `${frontend}/payment/success`,
        cancelUrl: `${frontend}/payment/cancel`,
        expiredAt,
      });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![408, 409, 429].includes(status)
      ) {
        await PaymentTransaction.updateOne(
          { _id: transaction._id, status: 'pending' },
          { $set: { status: 'failed' } },
        );
      }
      gatewayError(error);
      throw new AppError(
        'Không thể tạo liên kết payOS. Kiểm tra lịch sử giao dịch trước khi thử lại.',
        502,
      );
    }
    let validLink = false;
    try {
      const checkoutUrl = new URL(link.checkoutUrl);
      validLink =
        checkoutUrl.protocol === 'https:' &&
        checkoutUrl.hostname === 'pay.payos.vn' &&
        !checkoutUrl.username &&
        !checkoutUrl.password &&
        !checkoutUrl.port &&
        link.orderCode === orderCode &&
        link.amount === amount;
    } catch {
      /* Treat missing or malformed URLs as an invalid gateway response. */
    }
    if (!validLink) {
      throw new AppError(
        'Thông tin liên kết payOS không hợp lệ. Vui lòng kiểm tra lại giao dịch.',
        502,
      );
    }
    await PaymentTransaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          metadata: {
            expiredAt,
            paymentLinkId: link.paymentLinkId,
            checkoutUrl: link.checkoutUrl,
          },
        },
      },
    );
    return {
      paymentMethod: 'payos',
      orderCode,
      transactionId: transaction._id,
      amount,
      checkoutUrl: link.checkoutUrl,
      expiresInMinutes: 15,
      expiredAt,
    };
  }

  private static async ownedTopup(orderCode: number, userId: string) {
    validateOrderCode(orderCode);
    const transaction = await PaymentTransaction.findOne({
      orderCode,
      userId,
      type: 'topup',
      paymentMethod: 'payos',
    });
    if (!transaction) throw new AppError('Giao dịch không tồn tại', 404);
    return transaction;
  }

  static async handleWebhook(
    payload: Parameters<PayOS['webhooks']['verify']>[0],
  ) {
    const payos = getPayOS();
    let data;
    try {
      data = await payos.webhooks.verify(payload);
    } catch {
      throw new AppError('Chữ ký webhook payOS không hợp lệ', 401);
    }
    if (payload.code !== '00' || payload.success !== true || data.code !== '00')
      return { success: true, ignored: true };
    const transaction = await PaymentTransaction.findOne({
      orderCode: data.orderCode,
      type: 'topup',
      paymentMethod: 'payos',
    });
    // payOS sends a signed sample when confirming the webhook endpoint.
    if (!transaction) return { success: true, ignored: true };
    if (data.currency !== 'VND')
      throw new AppError('Loại tiền thanh toán không hợp lệ', 400);
    if (
      transaction.metadata?.paymentLinkId &&
      transaction.metadata.paymentLinkId !== data.paymentLinkId
    ) {
      throw new AppError('Liên kết thanh toán không khớp', 400);
    }
    // Read the authoritative aggregate status, including split payments and late transfers.
    return this.reconcile(transaction, payos);
  }

  private static async reconcile(
    transaction: InstanceType<typeof PaymentTransaction>,
    payos: PayOS,
  ) {
    if (transaction.status === 'completed') return this.result(transaction);
    let link;
    try {
      link = await payos.paymentRequests.get(transaction.orderCode!);
    } catch (error) {
      throw gatewayError(error);
    }
    if (
      link.orderCode !== transaction.orderCode ||
      link.amount !== transaction.amount ||
      (transaction.metadata?.paymentLinkId &&
        transaction.metadata.paymentLinkId !== link.id)
    ) {
      throw new AppError('Thông tin thanh toán payOS không khớp', 409);
    }
    if (link.status === 'PAID') {
      if (
        !Number.isSafeInteger(link.amountPaid) ||
        link.amountPaid < transaction.amount ||
        link.amountRemaining !== 0
      ) {
        throw new AppError('Số tiền thanh toán payOS không khớp', 409);
      }
      return this.completeTopup(transaction, link.id);
    }
    if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(link.status)) {
      await PaymentTransaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: { status: link.status === 'FAILED' ? 'failed' : 'cancelled' },
        },
      );
    }
    const current = await PaymentTransaction.findById(transaction._id);
    return this.result(current!);
  }

  static async verifyAndProcess(orderCode: number, userId: string) {
    const transaction = await this.ownedTopup(orderCode, userId);
    if (transaction.status === 'completed') return this.result(transaction);
    return this.reconcile(transaction, getPayOS());
  }

  private static result(transaction: InstanceType<typeof PaymentTransaction>) {
    return {
      success: transaction.status === 'completed',
      status: transaction.status,
      transaction,
      newBalance: transaction.balanceAfter,
    };
  }

  private static async completeTopup(
    transaction: InstanceType<typeof PaymentTransaction>,
    gatewayRef: string,
  ) {
    // Requires a replica set (Atlas or local replSet). Both writes commit together.
    // MongoDB retries write conflicts when webhook and return-page verification race.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const claimed = await PaymentTransaction.findOneAndUpdate(
          { _id: transaction._id, status: { $ne: 'completed' } },
          {
            $set: { status: 'completed', completedAt: new Date(), gatewayRef },
          },
          { new: true, session },
        );
        if (!claimed) return;
        const user = await User.findByIdAndUpdate(
          claimed.userId,
          { $inc: { virtualBalance: claimed.amount, __v: 1 } },
          { new: true, session },
        );
        if (!user) throw new AppError('Người dùng không tồn tại', 404);
        claimed.balanceBefore = user.virtualBalance - claimed.amount;
        claimed.balanceAfter = user.virtualBalance;
        await claimed.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return this.result((await PaymentTransaction.findById(transaction._id))!);
  }

  static async cancelTopup(orderCode: number, userId: string) {
    const transaction = await this.ownedTopup(orderCode, userId);
    if (transaction.status === 'completed') return this.result(transaction);
    const payos = getPayOS();
    try {
      await payos.paymentRequests.cancel(
        orderCode,
        'Người dùng hủy thanh toán',
      );
    } catch (error) {
      // Payment can finish while the cancellation request is in flight.
      const result = await this.reconcile(transaction, payos);
      if (result.success || result.status === 'cancelled') return result;
      throw gatewayError(error);
    }
    return this.reconcile(transaction, payos);
  }

  /**
   * Demo top-up (instant, no real payment)
   */
  static async demoTopup(userId: string, amount: number) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        'Nạp tiền demo chỉ khả dụng trong môi trường thử nghiệm',
        403,
      );
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);

    if (
      !Number.isSafeInteger(amount) ||
      amount < PAYMENT_LIMITS.MIN_DEMO_TOPUP_VND ||
      amount > PAYMENT_LIMITS.MAX_TOPUP_VND
    ) {
      throw new AppError(
        `Số tiền nạp demo phải là số nguyên từ ${PAYMENT_LIMITS.MIN_DEMO_TOPUP_VND.toLocaleString('vi-VN')} đến ${PAYMENT_LIMITS.MAX_TOPUP_VND.toLocaleString('vi-VN')} VND`,
        400,
      );
    }

    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const wallet = await User.findByIdAndUpdate(
          userId,
          { $inc: { virtualBalance: amount, __v: 1 } },
          { new: true, session },
        );
        if (!wallet) throw new AppError('Người dùng không tồn tại', 404);
        const [transaction] = await PaymentTransaction.create(
          [
            {
              userId,
              type: 'topup',
              amount,
              status: 'completed',
              paymentMethod: 'demo',
              description: `[Demo] Nạp ${amount.toLocaleString('vi-VN')} VND`,
              balanceBefore: wallet.virtualBalance - amount,
              balanceAfter: wallet.virtualBalance,
              completedAt: new Date(),
            },
          ],
          { session },
        );
        result = { transaction, newBalance: wallet.virtualBalance };
      });
    } finally {
      await session.endSession();
    }
    return result!;
  }

  /**
   * Get transaction history for a user
   */
  static async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: string,
  ) {
    const query: any = { userId };
    if (type) query.type = type;

    const total = await PaymentTransaction.countDocuments(query);
    const transactions = await PaymentTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get balance + quick stats
   */
  static async getWalletInfo(userId: string) {
    const user = await User.findById(userId).select(
      'virtualBalance fullName role',
    );
    if (!user) throw new AppError('Người dùng không tồn tại', 404);

    const [totalTopup, totalSpent, recentTransactions] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: { userId: user._id, type: 'topup', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.aggregate([
        {
          $match: {
            userId: user._id,
            type: { $in: ['escrow_deposit', 'commission', 'withdrawal'] },
            status: 'completed',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    return {
      balance: user.virtualBalance,
      fullName: user.fullName,
      role: user.role,
      stats: {
        totalTopup: totalTopup[0]?.total || 0,
        totalSpent: totalSpent[0]?.total || 0,
      },
      recentTransactions,
    };
  }
}
