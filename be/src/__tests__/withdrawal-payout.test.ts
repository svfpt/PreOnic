import { PayOS } from '@payos/node';
import User from '../models/User.model';
import WithdrawalRequest from '../models/WithdrawalRequest.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { WithdrawalService } from '../services/withdrawal.service';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';

jest.mock('@payos/node');
const create = jest.fn();
const get = jest.fn();
const list = jest.fn();
const balance = jest.fn();
const admin = '000000000000000000000001';
const body = {
  amount: 80000,
  bankName: 'Vietcombank',
  bankBin: '970436',
  bankAccountNumber: '1234567890',
  bankAccountHolder: 'NGUYEN VAN A',
};

const payout = (data: any, state = 'PROCESSING') => ({
  id: 'payout-test',
  referenceId: data.referenceId,
  approvalState: state === 'SUCCEEDED' ? 'COMPLETED' : 'PROCESSING',
  transactions: [{ ...data, referenceId: data.referenceId, state }],
});

describe('Automatic withdrawal payouts', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    process.env.PAYOS_PAYOUT_ENABLED = 'true';
    process.env.PAYOS_PAYOUT_CLIENT_ID = 'payout-client';
    process.env.PAYOS_PAYOUT_API_KEY = 'payout-api';
    process.env.PAYOS_PAYOUT_CHECKSUM_KEY = 'payout-checksum';
    (PayOS as jest.MockedClass<typeof PayOS>).mockImplementation(
      () =>
        ({
          payouts: { create, get, list },
          payoutsAccount: { balance },
        }) as unknown as PayOS,
    );
    create.mockImplementation(async (data) => payout(data));
    list.mockResolvedValue({ data: [] });
    balance.mockResolvedValue({ balance: '1000000', currency: 'VND' });
  });
  afterEach(() => {
    process.env.PAYOS_PAYOUT_ENABLED = 'false';
  });

  async function user() {
    return User.create({
      email: 'withdraw@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      virtualBalance: 100000,
    });
  }
  async function setup() {
    const wallet = await user();
    const request = await WithdrawalService.createRequest(
      String(wallet._id),
      body,
    );
    return { wallet, request };
  }

  it('reserves funds immediately and rejects concurrent overdraws', async () => {
    const wallet = await user();
    const results = await Promise.allSettled([
      WithdrawalService.createRequest(String(wallet._id), body),
      WithdrawalService.createRequest(String(wallet._id), body),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(20000);
    const info = await WithdrawalService.getUserRequests(String(wallet._id));
    expect(info.available).toBe(20000);
    expect(info.pendingTotal).toBe(80000);
    expect(create).not.toHaveBeenCalled();
  });

  it('two admins approving the same request send only one payout', async () => {
    const { wallet, request } = await setup();
    await Promise.all([
      WithdrawalService.approve(String(request._id), admin),
      WithdrawalService.approve(String(request._id), admin),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toMatch(/^[a-f0-9-]{36}$/);
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(20000);
    expect(
      await PaymentTransaction.countDocuments({ type: 'withdrawal' }),
    ).toBe(1);
  });

  it('marks completed only after payOS confirms success and never debits twice', async () => {
    const { wallet, request } = await setup();
    create.mockImplementation(async (data) => payout(data, 'SUCCEEDED'));
    expect(
      (await WithdrawalService.approve(String(request._id), admin)).status,
    ).toBe('completed');
    expect(
      (await WithdrawalService.approve(String(request._id), admin)).status,
    ).toBe('completed');
    expect(create).toHaveBeenCalledTimes(1);
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(20000);
    expect(
      await PaymentTransaction.countDocuments({
        type: 'withdrawal',
        status: 'completed',
      }),
    ).toBe(1);
  });

  it('reconciles an uncertain submission by reference without sending again', async () => {
    const { request } = await setup();
    create.mockRejectedValue(new Error('network timeout'));
    const processing = await WithdrawalService.approve(
      String(request._id),
      admin,
    );
    expect(processing.status).toBe('processing');
    const data = {
      referenceId: processing.payoutReference,
      amount: body.amount,
      toBin: body.bankBin,
      toAccountNumber: body.bankAccountNumber,
    };
    list.mockResolvedValue({ data: [payout(data, 'SUCCEEDED')] });
    expect((await WithdrawalService.sync(String(request._id))).status).toBe(
      'completed',
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('keeps funds held when no remote outcome is known and refuses rejection', async () => {
    const { wallet, request } = await setup();
    create.mockRejectedValue(new Error('network timeout'));
    await WithdrawalService.approve(String(request._id), admin);
    await WithdrawalService.sync(String(request._id));
    await expect(
      WithdrawalService.reject(String(request._id), admin, 'cancel'),
    ).rejects.toThrow();
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(20000);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('releases funds exactly once after a confirmed failure', async () => {
    const { wallet, request } = await setup();
    create.mockImplementation(async (data) => payout(data, 'FAILED'));
    expect(
      (await WithdrawalService.approve(String(request._id), admin)).status,
    ).toBe('failed');
    await WithdrawalService.sync(String(request._id));
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(100000);
    expect(await PaymentTransaction.countDocuments({ type: 'refund' })).toBe(1);
  });

  it('refunds a rejected pending request and records the reason', async () => {
    const { wallet, request } = await setup();
    await WithdrawalService.reject(
      String(request._id),
      admin,
      'Sai thông tin ngân hàng',
    );
    await WithdrawalService.reject(
      String(request._id),
      admin,
      'Sai thông tin ngân hàng',
    );
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(100000);
    expect(await PaymentTransaction.countDocuments({ type: 'refund' })).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not approve or release mismatched remote transactions', async () => {
    const { wallet, request } = await setup();
    create.mockImplementation(async (data) =>
      payout({ ...data, toAccountNumber: '99999999' }, 'SUCCEEDED'),
    );
    const result = await WithdrawalService.approve(String(request._id), admin);
    expect(result.status).toBe('processing');
    expect(result.lastError).toContain('không khớp');
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(20000);
  });

  it('keeps a request pending when the payout account is unavailable or insufficient', async () => {
    const { request } = await setup();
    balance.mockRejectedValueOnce(new Error('invalid API key'));
    await expect(
      WithdrawalService.approve(String(request._id), admin),
    ).rejects.toMatchObject({ statusCode: 503 });
    balance.mockResolvedValue({ balance: '100', currency: 'VND' });
    await expect(
      WithdrawalService.approve(String(request._id), admin),
    ).rejects.toThrow('Nguồn tiền chi payOS không đủ');
    expect((await WithdrawalRequest.findById(request._id))?.status).toBe(
      'pending',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not dispatch with payouts disabled or using changed channel credentials', async () => {
    const { request } = await setup();
    process.env.PAYOS_PAYOUT_ENABLED = 'false';
    await expect(
      WithdrawalService.approve(String(request._id), admin),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(create).not.toHaveBeenCalled();
    process.env.PAYOS_PAYOUT_ENABLED = 'true';
    create.mockRejectedValue(new Error('timeout'));
    await WithdrawalService.approve(String(request._id), admin);
    process.env.PAYOS_PAYOUT_CLIENT_ID = 'another-channel';
    expect(
      (await WithdrawalService.sync(String(request._id))).lastError,
    ).toContain('Kênh chi đã thay đổi');
    expect(list).not.toHaveBeenCalled();
  });

  it('reserves legacy pending requests without sending any transfer', async () => {
    const wallet = await user();
    await WithdrawalRequest.create({
      ...body,
      amount: 20000,
      userId: wallet._id,
    });
    await WithdrawalService.reserveLegacyRequests(String(wallet._id));
    await WithdrawalService.reserveLegacyRequests(String(wallet._id));
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(80000);
    expect(
      await PaymentTransaction.countDocuments({ type: 'withdrawal' }),
    ).toBe(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('prevents stale document saves from overwriting a wallet hold', async () => {
    const wallet = await user();
    const stale = await User.findById(wallet._id);
    await WithdrawalService.createRequest(String(wallet._id), body);
    stale!.virtualBalance -= 50000;
    await expect(stale!.save()).rejects.toMatchObject({ name: 'VersionError' });
    expect((await User.findById(wallet._id))?.virtualBalance).toBe(20000);
  });

  it.each([NaN, Infinity, 9999, 10000.5, 500000001])(
    'rejects invalid amount %s',
    async (amount) => {
      const wallet = await user();
      await expect(
        WithdrawalService.createRequest(String(wallet._id), {
          ...body,
          amount,
        }),
      ).rejects.toThrow();
      expect((await User.findById(wallet._id))?.virtualBalance).toBe(100000);
    },
  );
});
