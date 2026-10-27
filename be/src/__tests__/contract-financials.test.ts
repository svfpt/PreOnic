import Contract from '../models/Contract.model';
import User from '../models/User.model';
import { UNIT_TO_KG } from '../constants';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';

describe('Contract total value calculation', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('calculates totalValue using unit conversion', async () => {
    const farmer = await User.create({
      email: 'farmer@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Test',
      lastName: 'Farmer',
      fullName: 'Test Farmer',
    });

    const enterprise = await User.create({
      email: 'enterprise@test.local',
      password: 'password123',
      role: 'enterprise',
      firstName: 'Test',
      lastName: 'Enterprise',
      fullName: 'Test Enterprise',
    });

    const quantity = 2;
    const pricePerUnit = 1000;
    const unit = 'tan';

    const contract = await Contract.create({
      contractCode: 'PRE-TEST-0001',
      farmerId: farmer._id,
      enterpriseId: enterprise._id,
      farmerName: farmer.fullName,
      enterpriseName: enterprise.fullName,
      productName: 'Gao ST25',
      quantity,
      unit,
      pricePerUnit,
      totalValue: 0,
      commission: 0,
      commissionRate: 3,
      depositAmount: 0,
      depositPercentage: 50,
      paymentTerms: '50_50',
      deliveryDate: new Date(),
      status: 'draft',
      signedByFarmer: false,
      signedByEnterprise: false,
    });

    const expectedTotal = quantity * pricePerUnit * UNIT_TO_KG[unit];
    expect(contract.totalValue).toBe(expectedTotal);
  });
});
