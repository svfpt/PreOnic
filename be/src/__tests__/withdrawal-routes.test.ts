import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { PayOS } from '@payos/node';
import adminRoutes from '../routes/admin.routes';
import paymentRoutes from '../routes/payment.routes';
import { errorHandler } from '../middlewares/error.middleware';
import User from '../models/User.model';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';

jest.mock('@payos/node');
jest.mock('../utils/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
const create = jest.fn();
let server: Server;
let base: string;
let farmerToken: string;
let adminToken: string;
const body = { amount: 10000, bankName: 'Vietcombank', bankBin: '970436', bankAccountNumber: '1234567890', bankAccountHolder: 'TEST USER' };

describe('Withdrawal route authorization and workflow', () => {
  beforeAll(async () => {
    await connectTestDb();
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/payment', paymentRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    process.env.JWT_SECRET = 'route-test-secret';
    process.env.PAYOS_PAYOUT_ENABLED = 'true';
    process.env.PAYOS_PAYOUT_CLIENT_ID = 'test-client';
    process.env.PAYOS_PAYOUT_API_KEY = 'test-api';
    process.env.PAYOS_PAYOUT_CHECKSUM_KEY = 'test-checksum';
    const [farmer, admin] = await User.create([
      { email: 'farmer-route@test.local', password: 'password123', role: 'farmer', firstName: 'Test', lastName: 'Farmer', fullName: 'Test Farmer', virtualBalance: 50000 },
      { email: 'admin-route@test.local', password: 'password123', role: 'admin', firstName: 'Test', lastName: 'Admin', fullName: 'Test Admin' },
    ]);
    farmerToken = jwt.sign({ id: String(farmer._id) }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
    (PayOS as jest.MockedClass<typeof PayOS>).mockImplementation(() => ({
      payouts: { create }, payoutsAccount: { balance: async () => ({ balance: '1000000', currency: 'VND' }) },
    } as unknown as PayOS));
    create.mockImplementation(async data => ({ id: 'payout-route', referenceId: data.referenceId,
      approvalState: 'COMPLETED', transactions: [{ ...data, state: 'SUCCEEDED' }] }));
  });
  afterEach(() => { process.env.PAYOS_PAYOUT_ENABLED = 'false'; });

  async function request(route: string, token?: string, data?: unknown, method = 'GET') {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const raw = await response.text();
    let result: any;
    try { result = JSON.parse(raw); } catch { result = {}; }
    return { status: response.status, body: result };
  }

  it('requires login and prevents users from approving withdrawals', async () => {
    expect((await request('/payment/withdrawals')).status).toBe(401);
    expect((await request('/admin/withdrawals', farmerToken)).status).toBe(403);
    const created = await request('/payment/withdrawals', farmerToken, body, 'POST');
    const id = created.body.data.request._id;
    expect((await request(`/admin/withdrawals/${id}/approve`, farmerToken, {}, 'PATCH')).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('reserves funds on request then completes only through admin and payOS', async () => {
    const created = await request('/payment/withdrawals', farmerToken, body, 'POST');
    expect(created.status).toBe(201);
    expect(created.body.data.request.status).toBe('pending');
    const held = await request('/payment/withdrawals', farmerToken);
    expect(held.body.data.available).toBe(40000);
    const id = created.body.data.request._id;
    const approved = await request(`/admin/withdrawals/${id}/approve`, adminToken, {}, 'PATCH');
    expect(approved.status).toBe(200);
    expect(approved.body.data.request.status).toBe('completed');
    expect(create).toHaveBeenCalledTimes(1);
    expect((await request(`/admin/withdrawals/${id}/complete`, adminToken, {}, 'PATCH')).status).toBe(404);
  });

  it('allows admin rejection with a reason and returns the hold', async () => {
    const created = await request('/payment/withdrawals', farmerToken, body, 'POST');
    const id = created.body.data.request._id;
    expect((await request(`/admin/withdrawals/${id}/reject`, adminToken, {}, 'PATCH')).status).toBe(400);
    expect((await request(`/admin/withdrawals/${id}/reject`, adminToken, { adminNote: 'Sai thông tin' }, 'PATCH')).status).toBe(200);
    expect((await request('/payment/withdrawals', farmerToken)).body.data.available).toBe(50000);
    expect(create).not.toHaveBeenCalled();
  });
});
