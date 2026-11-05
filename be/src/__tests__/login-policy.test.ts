import express from 'express';
import { AddressInfo } from 'net';
import User from '../models/User.model';
import { AuthService } from '../services/auth.service';
import { authLimiter } from '../middlewares/rateLimit.middleware';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db';
jest.mock('../utils/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
const credentials = { emailOrPhone: 'login@example.com', password: 'Password123!' };
const originalEnv = { ...process.env };
describe('Login without account lockout', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'login-test'; process.env.JWT_REFRESH_SECRET = 'login-refresh';
    await User.create({ email: credentials.emailOrPhone, password: credentials.password, fullName: 'Login Test',
      firstName: 'Login', lastName: 'Test', role: 'farmer', isVerified: true });
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  it('does not lock an account after more than twenty incorrect passwords', async () => {
    for (let i = 0; i < 21; i++) {
      await expect(AuthService.login({ ...credentials, password: 'wrong-password' })).rejects.toMatchObject({ statusCode: 401 });
    }
    const user = await User.findOne({ email: credentials.emailOrPhone }).select('+loginAttempts +lockUntil');
    expect(user!.loginAttempts).toBe(0);
    expect(user!.lockUntil).toBeUndefined();
    expect((await AuthService.login(credentials)).tokens.accessToken).toBeTruthy();
  });

  it('ignores a previously stored lock and clears it on successful login', async () => {
    await User.updateOne({ email: credentials.emailOrPhone }, { $set: { loginAttempts: 20,
      lockUntil: new Date(Date.now() + 900000) } });
    await expect(AuthService.login({ ...credentials, password: 'wrong-password' })).rejects.toMatchObject({ statusCode: 401 });
    expect((await AuthService.login(credentials)).tokens.accessToken).toBeTruthy();
    const user = await User.findOne({ email: credentials.emailOrPhone }).select('+loginAttempts +lockUntil');
    expect(user!.loginAttempts).toBe(0);
    expect(user!.lockUntil).toBeUndefined();
  });

  it('still blocks excessive requests from one IP in production', async () => {
    const app = express();
    app.post('/login', authLimiter, (_req, res) => { res.status(401).json({ success: false }); });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/login`;
      for (let i = 0; i < 10; i++) expect((await fetch(url, { method: 'POST' })).status).toBe(401);
      expect((await fetch(url, { method: 'POST' })).status).toBe(429);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
