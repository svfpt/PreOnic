import User from '../models/User.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { PaymentService } from '../services/payment.service';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';

describe('PaymentService topup', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    process.env.SEPAY_MERCHANT_ID = 'test-merchant';
    process.env.SEPAY_SECRET_KEY = 'test-secret';
    process.env.SEPAY_ACCOUNT_NUMBER = '1234567890';
    process.env.SEPAY_BANK_CODE = 'VCB';
    process.env.SEPAY_ACCOUNT_NAME = 'PREONIC TEST';
    process.env.PUBLIC_API_URL = 'http://localhost:8080';
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

    const result = await PaymentService.createTopup(String(user._id), 20000, 'Test topup');
    expect(result.paymentMethod).toBe('sepay');

    const transaction = await PaymentTransaction.findOne({
      userId: user._id,
      type: 'topup',
    });

    expect(transaction).not.toBeNull();
    expect(transaction?.status).toBe('pending');
    expect(transaction?.amount).toBe(20000);
  });

  it('credits virtual balance and records a demo topup transaction', async () => {
    const user = await User.create({
      email: 'demo-pay@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Demo',
      lastName: 'User',
      fullName: 'Demo User',
      virtualBalance: 5000,
    });

    const result = await PaymentService.demoTopup(String(user._id), 25000);
    const updatedUser = await User.findById(user._id);
    const transaction = await PaymentTransaction.findOne({
      userId: user._id,
      type: 'topup',
    });

    expect(result.newBalance).toBe(30000);
    expect(updatedUser?.virtualBalance).toBe(30000);
    expect(transaction?.status).toBe('completed');
    expect(transaction?.paymentMethod).toBe('demo');
    expect(transaction?.balanceBefore).toBe(5000);
    expect(transaction?.balanceAfter).toBe(30000);
  });

  it('rejects demo topups outside the allowed amount range', async () => {
    const user = await User.create({
      email: 'demo-limit@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Demo',
      lastName: 'Limit',
      fullName: 'Demo Limit',
    });

    await expect(PaymentService.demoTopup(String(user._id), 999)).rejects.toThrow();
    await expect(PaymentService.demoTopup(String(user._id), 500000001)).rejects.toThrow();
    await expect(PaymentService.demoTopup(String(user._id), 1000.5)).rejects.toThrow();
  });

  it('does not allow demo top-ups in production', async () => {
    const user = await User.create({
      email: 'demo-production@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Demo',
      lastName: 'Production',
      fullName: 'Demo Production',
    });
    const previousNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';
    try {
      await expect(PaymentService.demoTopup(String(user._id), 1000)).rejects.toThrow(
        'Nạp tiền demo chỉ khả dụng trong môi trường thử nghiệm'
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
