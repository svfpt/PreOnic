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

describe('Contract performance and termination terms', () => {
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
      email: 'farmer-terms@test.local',
      password: 'password123',
      role: 'farmer',
      firstName: 'Test',
      lastName: 'Farmer',
      fullName: 'Test Farmer',
    });
    enterprise = await User.create({
      email: 'enterprise-terms@test.local',
      password: 'password123',
      role: 'enterprise',
      firstName: 'Test',
      lastName: 'Enterprise',
      fullName: 'Test Enterprise',
    });
    contract = await Contract.create({
      contractCode: 'PRE-TEST-TERMS',
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
      breachCompensationRate: 8,
      paymentTerms: '50_50',
      deliveryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'pending',
      signedByFarmer: false,
      signedByEnterprise: false,
    });
  });

  it('prevents either party from cancelling after one party has signed', async () => {
    contract.signedByEnterprise = true;
    await contract.save();

    await expect(
      ContractService.cancel(contract.id, farmer.id, 'Muốn hủy')
    ).rejects.toThrow('Không thể đơn phương hủy hợp đồng');
  });

  it('prevents rejecting a contract after the other party has signed', async () => {
    contract.signedByEnterprise = true;
    await contract.save();

    await expect(
      ContractService.reject(contract.id, farmer.id, 'Không tiếp tục')
    ).rejects.toThrow('Không thể từ chối sau khi một bên đã ký');
  });

  it('includes the compensation rate in the content verified during signing', async () => {
    await ContractService.requestSignOtp(contract.id, farmer.id);
    contract.breachCompensationRate = 12;
    await contract.save();

    await expect(
      ContractService.sign(contract.id, farmer.id, 'farmer', sentOtp)
    ).rejects.toThrow('Nội dung hợp đồng đã thay đổi');
  });
});
