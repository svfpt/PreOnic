import Contract from '../models/Contract.model';
import User from '../models/User.model';
import Escrow from '../models/Escrow.model';
import PaymentTransaction from '../models/PaymentTransaction.model';
import { EscrowService } from '../services/escrow.service';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';

describe('Escrow payment transactions', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('records escrow_deposit payment transaction on deposit', async () => {
    const farmer = await User.create({
      email: 'farmer2@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Farmer',
      lastName: 'Two',
      fullName: 'Farmer Two',
    });

    const enterprise = await User.create({
      email: 'enterprise2@test.local',
      password: 'password123',
      role: 'enterprise',
      firstName: 'Enterprise',
      lastName: 'Two',
      fullName: 'Enterprise Two',
      virtualBalance: 2000000,
    });

    const contract = await Contract.create({
      contractCode: 'PRE-TEST-0002',
      farmerId: farmer._id,
      enterpriseId: enterprise._id,
      farmerName: farmer.fullName,
      enterpriseName: enterprise.fullName,
      productName: 'Ca phe',
      quantity: 1,
      unit: 'tan',
      pricePerUnit: 1000,
      totalValue: 0,
      commission: 0,
      commissionRate: 3,
      depositAmount: 1000000,
      depositPercentage: 50,
      paymentTerms: '50_50',
      deliveryDate: new Date(),
      status: 'approved',
      signedByFarmer: true,
      signedByEnterprise: true,
    });

    const escrow = await EscrowService.createEscrowForContract(contract);
    await EscrowService.deposit(String(escrow._id), String(enterprise._id), 1000000);

    const transactions = await PaymentTransaction.find({
      userId: enterprise._id,
      type: 'escrow_deposit',
    });

    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBe(1000000);
    expect(transactions[0].status).toBe('completed');
  });
});
