import User from '../models/User.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { PaymentService } from '../services/payment.service';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';
import { PayOS } from '@payos/node';

jest.mock('@payos/node');
const create = jest.fn();
const get = jest.fn();
const cancel = jest.fn();
const verify = jest.fn();

describe('PaymentService topup', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    process.env.PAYOS_CLIENT_ID = 'test-client';
    process.env.PAYOS_API_KEY = 'test-key';
    process.env.PAYOS_CHECKSUM_KEY = 'test-checksum';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    (PayOS as jest.MockedClass<typeof PayOS>).mockImplementation(
      () =>
        ({
          paymentRequests: { create, get, cancel },
          webhooks: { verify },
        }) as unknown as PayOS,
    );
    create.mockImplementation(async (request) => ({
      ...request,
      paymentLinkId: 'link-1',
      checkoutUrl: 'https://pay.payos.vn/web/link-1',
    }));
  });

  it('creates a pending topup transaction', async () => {
    const user = await User.create({
      email: 'pay@test.local',
      password: 'password123',
      role: 'enterprise',
      firstName: 'Pay',
      lastName: 'User',
      fullName: 'Pay User',
    });

    const result = await PaymentService.createTopup(
      String(user._id),
      20000,
      'Test topup',
    );
    expect(result.paymentMethod).toBe('payos');
    expect(result.checkoutUrl).toBe('https://pay.payos.vn/web/link-1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 20000,
        returnUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      }),
    );

    const transaction = await PaymentTransaction.findOne({
      userId: user._id,
      type: 'topup',
    });

    expect(transaction).not.toBeNull();
    expect(transaction?.status).toBe('pending');
    expect(transaction?.amount).toBe(20000);
  });

  const setupTopup = async () => {
    const user = await User.create({
      email: 'gateway@test.local',
      password: 'password123',
      role: 'enterprise',
      firstName: 'Pay',
      lastName: 'Test',
      fullName: 'Pay Test',
      virtualBalance: 5000,
    });
    const topup = await PaymentService.createTopup(String(user._id), 20000);
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 20000,
      amountPaid: 20000,
      amountRemaining: 0,
      status: 'PAID',
    });
    verify.mockResolvedValue({
      orderCode: topup.orderCode,
      amount: 20000,
      paymentLinkId: 'link-1',
      currency: 'VND',
      code: '00',
    });
    return { user, topup };
  };
  const webhook = {
    code: '00',
    success: true,
    desc: 'success',
    data: {},
    signature: 'test',
  } as Parameters<typeof PaymentService.handleWebhook>[0];

  it('credits exactly once when webhook and verification race and retries arrive', async () => {
    const { user, topup } = await setupTopup();
    await Promise.all([
      PaymentService.handleWebhook(webhook),
      PaymentService.verifyAndProcess(topup.orderCode, String(user._id)),
      PaymentService.handleWebhook(webhook),
    ]);
    await PaymentService.handleWebhook(webhook);
    expect((await User.findById(user._id))?.virtualBalance).toBe(25000);
    expect(
      (await PaymentTransaction.findOne({ orderCode: topup.orderCode }))
        ?.status,
    ).toBe('completed');
  });

  it('rejects verification and cancellation by another user', async () => {
    const { topup } = await setupTopup();
    const otherId = '000000000000000000000001';
    await expect(
      PaymentService.verifyAndProcess(topup.orderCode, otherId),
    ).rejects.toThrow('Giao dịch không tồn tại');
    await expect(
      PaymentService.cancelTopup(topup.orderCode, otherId),
    ).rejects.toThrow('Giao dịch không tồn tại');
    expect(get).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook signatures without crediting', async () => {
    const { user } = await setupTopup();
    verify.mockRejectedValue(new Error('invalid signature'));
    await expect(PaymentService.handleWebhook(webhook)).rejects.toThrow(
      'Chữ ký webhook payOS không hợp lệ',
    );
    expect((await User.findById(user._id))?.virtualBalance).toBe(5000);
  });

  it('does not credit pending or mismatched payments', async () => {
    const { user, topup } = await setupTopup();
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 20000,
      status: 'PENDING',
    });
    expect(
      (await PaymentService.verifyAndProcess(topup.orderCode, String(user._id)))
        .success,
    ).toBe(false);
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 10000,
      amountPaid: 20000,
      amountRemaining: 0,
      status: 'PAID',
    });
    await expect(
      PaymentService.verifyAndProcess(topup.orderCode, String(user._id)),
    ).rejects.toThrow('Thông tin thanh toán payOS không khớp');
    expect((await User.findById(user._id))?.virtualBalance).toBe(5000);
  });

  it('cancels the remote link before marking the local transaction cancelled', async () => {
    const { user, topup } = await setupTopup();
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 20000,
      status: 'CANCELLED',
    });
    const result = await PaymentService.cancelTopup(
      topup.orderCode,
      String(user._id),
    );
    expect(cancel).toHaveBeenCalledWith(topup.orderCode, expect.any(String));
    expect(result.status).toBe('cancelled');
    expect((await User.findById(user._id))?.virtualBalance).toBe(5000);
  });

  it('rejects fractional and invalid real topup amounts before calling payOS', async () => {
    for (const amount of [NaN, Infinity, 9999, 10000.5, 500000001]) {
      await expect(
        PaymentService.createTopup('000000000000000000000001', amount),
      ).rejects.toThrow();
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('rolls back transaction completion if the wallet cannot be credited', async () => {
    const { user, topup } = await setupTopup();
    await User.deleteOne({ _id: user._id });
    await expect(PaymentService.handleWebhook(webhook)).rejects.toThrow(
      'Người dùng không tồn tại',
    );
    expect(
      (await PaymentTransaction.findOne({ orderCode: topup.orderCode }))
        ?.status,
    ).toBe('pending');
  });

  it('credits a late confirmed payment after cancellation exactly once', async () => {
    const { user, topup } = await setupTopup();
    await PaymentTransaction.updateOne(
      { orderCode: topup.orderCode },
      { status: 'cancelled' },
    );
    await PaymentService.handleWebhook(webhook);
    await PaymentService.handleWebhook(webhook);
    expect((await User.findById(user._id))?.virtualBalance).toBe(25000);
  });

  it('does not mark cancelled locally if remote cancellation fails', async () => {
    const { user, topup } = await setupTopup();
    cancel.mockRejectedValue(new Error('gateway unavailable'));
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 20000,
      status: 'PENDING',
    });
    await expect(
      PaymentService.cancelTopup(topup.orderCode, String(user._id)),
    ).rejects.toThrow('Không thể kết nối payOS');
    expect(
      (await PaymentTransaction.findOne({ orderCode: topup.orderCode }))
        ?.status,
    ).toBe('pending');
  });

  it('reconciles a payment that finishes during remote cancellation', async () => {
    const { user, topup } = await setupTopup();
    cancel.mockRejectedValue(new Error('already paid'));
    const result = await PaymentService.cancelTopup(
      topup.orderCode,
      String(user._id),
    );
    expect(result.success).toBe(true);
    expect((await User.findById(user._id))?.virtualBalance).toBe(25000);
  });

  it('does not leave rejected creation requests pending', async () => {
    const { user } = await setupTopup();
    create.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { status: 401 }),
    );
    await expect(
      PaymentService.createTopup(String(user._id), 30000),
    ).rejects.toThrow('Không thể tạo liên kết');
    expect(
      (await PaymentTransaction.findOne({ userId: user._id, amount: 30000 }))
        ?.status,
    ).toBe('failed');
  });

  it('keeps uncertain creation requests available for reconciliation', async () => {
    const { user } = await setupTopup();
    create.mockRejectedValue(new Error('timeout'));
    await expect(
      PaymentService.createTopup(String(user._id), 30000),
    ).rejects.toThrow('Không thể tạo liên kết');
    expect(
      (await PaymentTransaction.findOne({ userId: user._id, amount: 30000 }))
        ?.status,
    ).toBe('pending');
  });

  it('ignores signed sample webhooks without querying payment links', async () => {
    verify.mockResolvedValue({ orderCode: 123, code: '00' });
    expect(await PaymentService.handleWebhook(webhook)).toEqual({
      success: true,
      ignored: true,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps underpaid orders pending and rejects invalid paid totals', async () => {
    const { user, topup } = await setupTopup();
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 20000,
      amountPaid: 10000,
      amountRemaining: 10000,
      status: 'UNDERPAID',
    });
    expect(
      (await PaymentService.verifyAndProcess(topup.orderCode, String(user._id)))
        .status,
    ).toBe('pending');
    get.mockResolvedValue({
      id: 'link-1',
      orderCode: topup.orderCode,
      amount: 20000,
      amountPaid: 10000,
      amountRemaining: 0,
      status: 'PAID',
    });
    await expect(
      PaymentService.verifyAndProcess(topup.orderCode, String(user._id)),
    ).rejects.toThrow('Số tiền thanh toán payOS không khớp');
    expect((await User.findById(user._id))?.virtualBalance).toBe(5000);
  });

  it('handles multiple wallet credits concurrently without losing money', async () => {
    const { user, topup } = await setupTopup();
    const second = await PaymentService.createTopup(String(user._id), 30000);
    get.mockImplementation(async (orderCode) => ({
      id: 'link-1', orderCode, amount: orderCode === topup.orderCode ? 20000 : 30000,
      amountPaid: orderCode === topup.orderCode ? 20000 : 30000,
      amountRemaining: 0, status: 'PAID',
    }));
    await Promise.all([
      PaymentService.verifyAndProcess(topup.orderCode, String(user._id)),
      PaymentService.verifyAndProcess(second.orderCode, String(user._id)),
    ]);
    expect((await User.findById(user._id))?.virtualBalance).toBe(55000);
    expect(
      await PaymentTransaction.countDocuments({
        userId: user._id,
        status: 'completed',
      }),
    ).toBe(2);
  });

  it('keeps the bank transfer description within nine characters', async () => {
    await setupTopup();
    expect(create.mock.calls[0][0].description.length).toBeLessThanOrEqual(9);
  });

  it.each(['javascript:alert(1)', 'https://example.com/pay', 'not-a-url'])(
    'rejects invalid checkout URL %s', async (checkoutUrl) => {
      const { user } = await setupTopup();
      create.mockImplementation(async (request) => ({ ...request, checkoutUrl, paymentLinkId: 'bad-link' }));
      await expect(PaymentService.createTopup(String(user._id), 30000)).rejects.toThrow('Thông tin liên kết payOS không hợp lệ');
      expect((await User.findById(user._id))?.virtualBalance).toBe(5000);
    }
  );

  it('returns a controlled gateway error when payment lookup is unavailable', async () => {
    const { user, topup } = await setupTopup();
    get.mockRejectedValue(new Error('network timeout'));
    await expect(PaymentService.verifyAndProcess(topup.orderCode, String(user._id))).rejects.toMatchObject({ statusCode: 502 });
    expect((await User.findById(user._id))?.virtualBalance).toBe(5000);
    expect((await PaymentTransaction.findOne({ orderCode: topup.orderCode }))?.status).toBe('pending');
  });

});
