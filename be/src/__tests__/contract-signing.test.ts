import Contract, { IContract } from '../models/Contract.model';
import User, { IUser } from '../models/User.model';
import { ContractService } from '../services/contract.service';
import { sendSignOtpEmail } from '../services/email.service';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';

jest.mock('../services/email.service', () => ({
  sendSignOtpEmail: jest.fn(),
}));

jest.mock('../services/notification.service', () => ({
  NotificationService: { create: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../services/escrow.service', () => ({
  EscrowService: { createEscrowForContract: jest.fn().mockResolvedValue(undefined) },
}));

describe('Electronic contract signing', () => {
  let farmer: IUser;
  let enterprise: IUser;
  let contract: IContract;
  let sentOtp = '';
  const mockedSendOtp = jest.mocked(sendSignOtpEmail);

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    sentOtp = '';
    mockedSendOtp.mockImplementation(async (_email, _fullName, otp) => {
      sentOtp = otp;
    });

    farmer = await User.create({
      email: 'farmer-sign@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Test',
      lastName: 'Farmer',
      fullName: 'Test Farmer',
    });
    enterprise = await User.create({
      email: 'enterprise-sign@test.local',
      password: 'password123',
      role: 'enterprise',
      firstName: 'Test',
      lastName: 'Enterprise',
      fullName: 'Test Enterprise',
    });
    contract = await Contract.create({
      contractCode: 'PRE-TEST-SIGN',
      farmerId: farmer._id,
      enterpriseId: enterprise._id,
      farmerName: farmer.fullName,
      enterpriseName: enterprise.fullName,
      productName: 'Gao ST25',
      quantity: 1,
      unit: 'tan',
      pricePerUnit: 1000,
      totalValue: 0,
      commission: 0,
      commissionRate: 3,
      depositAmount: 500,
      depositPercentage: 50,
      paymentTerms: '50_50',
      deliveryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'pending',
      signedByFarmer: false,
      signedByEnterprise: false,
    });
  });

  it('requires a valid OTP and records matching content hashes for both signers', async () => {
    await ContractService.requestSignOtp(contract.id, farmer.id);
    expect(sentOtp).toMatch(/^\d{6}$/);

    await expect(
      ContractService.sign(contract.id, farmer.id, 'farmer', '000000')
    ).rejects.toThrow('Mã OTP không đúng');

    await ContractService.sign(contract.id, farmer.id, 'farmer', sentOtp, {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    let updated = await Contract.findById(contract.id);
    expect(updated?.signedByFarmer).toBe(true);
    expect(updated?.signatures).toHaveLength(1);
    expect(updated?.signatures[0].signerEmail).toBe(farmer.email);
    expect(updated?.signatures[0].ipAddress).toBe('127.0.0.1');

    await ContractService.requestSignOtp(contract.id, enterprise.id);
    await ContractService.sign(contract.id, enterprise.id, 'enterprise', sentOtp);

    updated = await Contract.findById(contract.id);
    expect(updated?.signedByEnterprise).toBe(true);
    expect(updated?.status).toBe('approved');
    expect(updated?.signatures).toHaveLength(2);
    expect(updated?.signatures[0].contractHash).toBe(updated?.signatures[1].contractHash);
  });

  it('rejects signing if the contract content changed after OTP was issued', async () => {
    await ContractService.requestSignOtp(contract.id, farmer.id);
    contract.productName = 'Updated product name';
    await contract.save();

    await expect(
      ContractService.sign(contract.id, farmer.id, 'farmer', sentOtp)
    ).rejects.toThrow('Nội dung hợp đồng đã thay đổi');

    const updated = await Contract.findById(contract.id);
    expect(updated?.signedByFarmer).toBe(false);
    expect(updated?.signatures).toHaveLength(0);
  });
});
