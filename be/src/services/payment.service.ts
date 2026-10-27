import User from '../models/User.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { AppError } from '../middlewares/error.middleware';
import { PAYMENT_LIMITS } from '../constants';
import { createLogger } from '../utils/logger';

const log = createLogger('Payment');

const ORDER_CODE_SUFFIX_LENGTH = 8;
const ORDER_CODE_RANDOM_DIGITS = 3;
const SEPAY_TRANSFER_PREFIX = 'PON';

interface SePayWebhookPayload {
  id: number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string | null;
  content?: string;
  transferType?: string;
  transferAmount?: number | string;
  accumulated?: number | string;
  subAccount?: string | null;
  referenceCode?: string | null;
  description?: string;
}

interface SePayConfig {
  merchantId: string;
  secretKey: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  webhookUrl: string;
}

const generateOrderCode = (): number =>
  Number(
    `${Date.now().toString().slice(-ORDER_CODE_SUFFIX_LENGTH)}${Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(ORDER_CODE_RANDOM_DIGITS, '0')}`
  );

const buildTransferCode = (orderCode: number): string =>
  `${SEPAY_TRANSFER_PREFIX}${orderCode}`;

const getWebhookBaseUrl = (): string => {
  const rawUrl =
    process.env.PUBLIC_API_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.APP_PUBLIC_URL ||
    '';

  return rawUrl.trim().replace(/\/$/, '');
};

const getSePayConfig = (): SePayConfig => {
  const merchantId = process.env.SEPAY_MERCHANT_ID?.trim() || '';
  const secretKey =
    process.env.SEPAY_SECRET_KEY?.trim() ||
    process.env.SEPAY_API_KEY?.trim() ||
    '';
  const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER?.trim() || '';
  const bankCode = process.env.SEPAY_BANK_CODE?.trim() || '';
  const accountName = process.env.SEPAY_ACCOUNT_NAME?.trim() || '';
  const webhookBaseUrl = getWebhookBaseUrl();

  if (!merchantId || !secretKey) {
    throw new AppError(
      'SePay chưa được cấu hình đầy đủ. Vui lòng thiết lập SEPAY_MERCHANT_ID và SEPAY_SECRET_KEY trong .env',
      500
    );
  }

  if (!accountNumber || !bankCode || !accountName) {
    throw new AppError(
      'SePay thiếu thông tin nhận tiền. Vui lòng thiết lập SEPAY_ACCOUNT_NUMBER, SEPAY_BANK_CODE, SEPAY_ACCOUNT_NAME trong .env',
      500
    );
  }

  if (!webhookBaseUrl) {
    throw new AppError(
      'Chưa có PUBLIC_API_URL để nhận webhook SePay. Vui lòng cấu hình URL public cho backend trước khi bật SePay.',
      500
    );
  }

  return {
    merchantId,
    secretKey,
    accountNumber,
    bankCode,
    accountName,
    webhookUrl: `${webhookBaseUrl}/api/v1/payment/webhook`,
  };
};

const parseTransferAmount = (amount: number | string | undefined): number => {
  const parsedAmount = Number(amount);
  return Number.isFinite(parsedAmount) ? parsedAmount : 0;
};

const extractTransferCode = (content: string | undefined): string | null => {
  if (!content) return null;
  // Một số app ngân hàng chèn khoảng trắng/gạch ngang vào nội dung chuyển khoản
  // (vd "PON 12345678901" hoặc "PON-1234 5678 901") nên phải loại bỏ trước khi match.
  const normalizedContent = content.toUpperCase().replace(/[\s\-_.]/g, '');
  const match = normalizedContent.match(/PON(\d{11})/);
  return match ? `${SEPAY_TRANSFER_PREFIX}${match[1]}` : null;
};

const extractOrderCodeFromTransferCode = (transferCode: string): number =>
  Number(transferCode.replace(SEPAY_TRANSFER_PREFIX, ''));

const buildQrCodeUrl = (
  config: SePayConfig,
  amount: number,
  transferCode: string
): string => {
  const qrUrl = new URL('https://qr.sepay.vn/img');
  qrUrl.searchParams.set('acc', config.accountNumber);
  qrUrl.searchParams.set('bank', config.bankCode);
  qrUrl.searchParams.set('amount', String(amount));
  qrUrl.searchParams.set('des', transferCode);
  qrUrl.searchParams.set('template', 'compact');
  return qrUrl.toString();
};

const isAuthorizedWebhook = (authorizationHeader: string | undefined): boolean => {
  const secretKey =
    process.env.SEPAY_WEBHOOK_SECRET?.trim() ||
    process.env.SEPAY_SECRET_KEY?.trim() ||
    process.env.SEPAY_API_KEY?.trim() ||
    '';

  // Fail-closed: nếu server chưa cấu hình secret nào thì từ chối webhook thay vì
  // tự động chấp nhận — thiếu cấu hình không được phép mở toang endpoint cộng tiền.
  if (!secretKey) {
    log.error(
      'SEPAY_WEBHOOK_SECRET/SEPAY_SECRET_KEY chưa được cấu hình — từ chối webhook SePay để tránh giả mạo'
    );
    return false;
  }

  if (!authorizationHeader) {
    return false;
  }

  const normalizedHeader = authorizationHeader.trim();
  return normalizedHeader === `Apikey ${secretKey}`;
};

export class PaymentService {
  /**
   * Real payment gateway is temporarily disabled while migrating to SePay.
   */
  static async createTopup(
    userId: string,
    amount: number,
    description?: string
  ) {
    const sepayConfig = getSePayConfig();
    const user = await User.findById(userId);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);

    if (amount < PAYMENT_LIMITS.MIN_TOPUP_VND) {
      throw new AppError('Số tiền nạp tối thiểu là 10.000 VND', 400);
    }
    if (amount > PAYMENT_LIMITS.MAX_TOPUP_VND) {
      throw new AppError('Số tiền nạp tối đa là 500.000.000 VND', 400);
    }

    const orderCode = generateOrderCode();
    const transferCode = buildTransferCode(orderCode);

    const transaction = await PaymentTransaction.create({
      userId,
      type: 'topup',
      amount,
      status: 'pending',
      paymentMethod: 'sepay',
      orderCode,
      description: description || `Nạp ${amount.toLocaleString('vi-VN')} VND qua SePay`,
      balanceBefore: user.virtualBalance,
      balanceAfter: user.virtualBalance,
      metadata: {
        merchantId: sepayConfig.merchantId,
        transferCode,
        webhookUrl: sepayConfig.webhookUrl,
        qrCodeUrl: buildQrCodeUrl(sepayConfig, amount, transferCode),
      },
    });

    return {
      paymentMethod: 'sepay',
      orderCode,
      transferCode,
      transactionId: transaction._id,
      amount,
      expiresInMinutes: 15,
      bankInfo: {
        bankCode: sepayConfig.bankCode,
        accountNumber: sepayConfig.accountNumber,
        accountName: sepayConfig.accountName,
      },
      qrCodeUrl: buildQrCodeUrl(sepayConfig, amount, transferCode),
      webhookUrl: sepayConfig.webhookUrl,
      note: 'Chuyển khoản đúng số tiền và đúng nội dung để hệ thống tự động cộng ví.',
    };
  }

  /**
   * Webhook endpoint placeholder for upcoming SePay integration.
   */
  static async handleWebhook(
    webhookData: SePayWebhookPayload,
    authorizationHeader?: string
  ) {
    if (!isAuthorizedWebhook(authorizationHeader)) {
      log.warn('Webhook SePay bị từ chối do Authorization không hợp lệ', {
        sepayId: webhookData?.id,
      });
      throw new AppError('Webhook SePay không hợp lệ', 401);
    }

    if (webhookData.transferType !== 'in') {
      return { success: true, ignored: true, reason: 'not_incoming_transfer' };
    }

    const transferCode = extractTransferCode(webhookData.content);
    if (!transferCode) {
      log.warn('Webhook SePay bị bỏ qua: không trích được mã giao dịch từ nội dung chuyển khoản', {
        sepayId: webhookData.id,
        content: webhookData.content,
      });
      return { success: true, ignored: true, reason: 'missing_transfer_code' };
    }

    const orderCode = extractOrderCodeFromTransferCode(transferCode);
    const transaction = await PaymentTransaction.findOne({
      orderCode,
      type: 'topup',
      paymentMethod: 'sepay',
    });

    if (!transaction) {
      log.warn('Webhook SePay bị bỏ qua: không tìm thấy giao dịch khớp orderCode', {
        sepayId: webhookData.id,
        orderCode,
        content: webhookData.content,
      });
      return { success: true, ignored: true, reason: 'transaction_not_found' };
    }

    if (transaction.status === 'completed') {
      return { success: true, ignored: true, reason: 'already_processed' };
    }

    const transferAmount = parseTransferAmount(webhookData.transferAmount);
    if (transferAmount !== transaction.amount) {
      log.error('Webhook SePay bị bỏ qua: số tiền chuyển khoản không khớp giao dịch — cần đối soát thủ công', {
        sepayId: webhookData.id,
        orderCode,
        expectedAmount: transaction.amount,
        transferAmount,
      });

      transaction.metadata = {
        ...(transaction.metadata || {}),
        lastWebhookMismatch: {
          sepayId: webhookData.id,
          transferAmount,
          content: webhookData.content,
          at: new Date().toISOString(),
        },
      };
      await transaction.save();

      return { success: true, ignored: true, reason: 'amount_mismatch' };
    }

    return this.processCompletedTopup(transaction, webhookData);
  }

  /**
   * Verify endpoint placeholder for upcoming SePay integration.
   */
  static async verifyAndProcess(_orderCode: number) {
    const transaction = await PaymentTransaction.findOne({
      orderCode: _orderCode,
      type: 'topup',
    });

    if (!transaction) {
      throw new AppError('Giao dịch không tồn tại', 404);
    }

    if (transaction.status === 'completed') {
      return {
        success: true,
        transaction,
        newBalance: transaction.balanceAfter,
      };
    }

    return {
      success: false,
      status: transaction.status,
      transaction,
      message: transaction.status === 'pending'
        ? 'Giao dịch đang chờ SePay xác nhận chuyển khoản'
        : 'Giao dịch chưa hoàn tất',
    };
  }

  private static async processCompletedTopup(
    transaction: InstanceType<typeof PaymentTransaction>,
    webhookData: SePayWebhookPayload
  ) {
    const user = await User.findById(transaction.userId);
    if (!user) {
      throw new AppError('Người dùng không tồn tại', 404);
    }

    const balanceBefore = user.virtualBalance;
    user.virtualBalance += transaction.amount;
    await user.save({ validateBeforeSave: false });

    transaction.status = 'completed';
    transaction.balanceBefore = balanceBefore;
    transaction.balanceAfter = user.virtualBalance;
    transaction.completedAt = new Date();
    transaction.gatewayRef = String(webhookData.id);
    transaction.metadata = {
      ...(transaction.metadata || {}),
      sepayTransactionId: webhookData.id,
      gateway: webhookData.gateway,
      transactionDate: webhookData.transactionDate,
      accountNumber: webhookData.accountNumber,
      transferType: webhookData.transferType,
      referenceCode: webhookData.referenceCode,
      description: webhookData.description,
      receivedContent: webhookData.content,
      receivedAmount: parseTransferAmount(webhookData.transferAmount),
      processedBy: 'sepay_webhook',
    };
    await transaction.save();

    return {
      success: true,
      transaction,
      newBalance: user.virtualBalance,
    };
  }

  /**
   * Demo top-up (instant, no real payment)
   */
  static async demoTopup(userId: string, amount: number) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Nạp tiền demo chỉ khả dụng trong môi trường thử nghiệm', 403);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('Người dùng không tồn tại', 404);

    if (
      !Number.isSafeInteger(amount)
      || amount < PAYMENT_LIMITS.MIN_DEMO_TOPUP_VND
      || amount > PAYMENT_LIMITS.MAX_TOPUP_VND
    ) {
      throw new AppError(
        `Số tiền nạp demo phải là số nguyên từ ${PAYMENT_LIMITS.MIN_DEMO_TOPUP_VND.toLocaleString('vi-VN')} đến ${PAYMENT_LIMITS.MAX_TOPUP_VND.toLocaleString('vi-VN')} VND`,
        400
      );
    }

    const balanceBefore = user.virtualBalance;
    user.virtualBalance += amount;
    await user.save({ validateBeforeSave: false });

    const transaction = await PaymentTransaction.create({
      userId,
      type: 'topup',
      amount,
      status: 'completed',
      paymentMethod: 'demo',
      description: `[Demo] Nạp ${amount.toLocaleString('vi-VN')} VND`,
      balanceBefore,
      balanceAfter: user.virtualBalance,
      completedAt: new Date(),
    });

    return {
      transaction,
      newBalance: user.virtualBalance,
    };
  }

  /**
   * Get transaction history for a user
   */
  static async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: string
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
    const user = await User.findById(userId).select('virtualBalance fullName role');
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
            type: { $in: ['escrow_deposit', 'commission'] },
            status: 'completed',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.find({ userId: user._id, status: 'completed' })
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
      recentTransactions: await PaymentTransaction.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5),
    };
  }

  /**
   * Cancel a locally stored pending topup.
   */
  static async cancelTopup(orderCode: number, userId: string) {
    const transaction = await PaymentTransaction.findOne({ orderCode, userId });
    if (!transaction) throw new AppError('Giao dịch không tồn tại', 404);
    if (transaction.status !== 'pending') {
      throw new AppError('Chỉ có thể hủy giao dịch đang chờ', 400);
    }

    transaction.status = 'cancelled';
    transaction.metadata = {
      ...(transaction.metadata || {}),
      cancelledReason: 'Cancelled by user before SePay confirmation',
    };
    await transaction.save();

    return transaction;
  }
}
