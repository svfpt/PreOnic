import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import User from '../models/User.model';
import { AuthService } from '../services/auth.service';
import { EmailOtpService } from '../services/email-otp.service';
import * as emailService from '../services/email.service';
import authRoutes from '../routes/auth.routes';
import { errorHandler } from '../middlewares/error.middleware';
import { clearTestDb, connectTestDb, disconnectTestDb } from './helpers/db';

jest.mock('../utils/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
const body = { fullName: 'OTP Test', email: 'otp@example.com', phone: '0901234567', password: 'Password123!',
  confirmPassword: 'Password123!', role: 'farmer' as const, agreeTerms: true };
let server: Server;
let base: string;
let deliver: jest.SpyInstance;
let ready: jest.SpyInstance;
const code = () => deliver.mock.calls.at(-1)![2] as string;
const wrong = () => code() === '000000' ? '111111' : '000000';
async function post(path: string, data: unknown) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return { response, body: await response.json() as any };
}
async function allowResend() {
  await User.updateOne({ email: body.email }, { $set: { emailOtpSentAt: new Date(Date.now() - 61000) } });
}

describe('Registration email OTP', () => {
  beforeAll(async () => {
    await connectTestDb();
    const app = express(); app.use(express.json()); app.use('/auth', authRoutes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/auth`;
  });
  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    process.env.JWT_SECRET = 'otp-test-secret'; process.env.JWT_REFRESH_SECRET = 'otp-refresh-test';
    ready = jest.spyOn(emailService, 'getRegistrationEmailConfig').mockReturnValue({ host: 'mock', port: 587, secure: false, user: 'test', pass: 'test', from: 'test' });
    deliver = jest.spyOn(emailService, 'sendRegistrationOtp').mockResolvedValue(undefined);
  });

  it('registers without issuing tokens, cookies, OTP or a verification URL', async () => {
    const result = await post('/register', body);
    expect(result.response.status).toBe(201);
    expect(result.response.headers.get('set-cookie')).toBeNull();
    expect(result.body).toMatchObject({ requiresVerification: true, data: { email: body.email } });
    expect(JSON.stringify(result.body)).not.toMatch(/verificationUrl|accessToken|refreshToken|emailOtpHash/);
    expect(JSON.stringify(result.body)).not.toContain(code());
    const saved = await User.findOne({ email: body.email }).select('+emailOtpHash');
    expect(saved!.isVerified).toBe(false);
    expect(saved!.emailOtpHash).toHaveLength(64);
    expect(saved!.emailOtpHash).not.toBe(code());
  });

  it('checks password first, blocks unverified login, then allows login after OTP once', async () => {
    await AuthService.register(body);
    await expect(AuthService.login({ emailOrPhone: body.email, password: 'incorrect' })).rejects.toMatchObject({ statusCode: 401 });
    await expect(AuthService.login({ emailOrPhone: body.email, password: body.password })).rejects.toMatchObject({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED' });
    const verified = await post('/verify-email', { email: body.email, otp: code() });
    expect(verified.response.status).toBe(200);
    expect(verified.response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(verified.body.data.accessToken).toBeTruthy();
    expect(verified.body.data.user.isVerified).toBe(true);
    expect(verified.body.data.user.refreshToken).toBeUndefined();
    expect((await fetch(base + '/me', { headers: { Authorization: `Bearer ${verified.body.data.accessToken}` } })).status).toBe(200);
    await expect(EmailOtpService.verify(body.email, code())).rejects.toMatchObject({ statusCode: 400 });
    const result = await AuthService.login({ emailOrPhone: body.email, password: body.password });
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.user.toJSON()).not.toHaveProperty('refreshToken');
    const saved = await User.findOne({ email: body.email }).select('+emailOtpHash +refreshToken');
    expect(saved!.emailOtpHash).toBeUndefined();
    expect(saved!.refreshToken).toBeTruthy();
  });

  it('rejects an expired code', async () => {
    await AuthService.register(body);
    await User.updateOne({ email: body.email }, { $set: { emailOtpExpiresAt: new Date(Date.now() - 1) } });
    await expect(EmailOtpService.verify(body.email, code())).rejects.toMatchObject({ statusCode: 400 });
    expect((await User.findOne({ email: body.email }))!.isVerified).toBe(false);
  });

  it('locks after five wrong guesses including concurrent guesses', async () => {
    await AuthService.register(body);
    await Promise.allSettled(Array.from({ length: 8 }, () => EmailOtpService.verify(body.email, wrong())));
    const saved = await User.findOne({ email: body.email }).select('+emailOtpAttempts');
    expect(saved!.emailOtpAttempts).toBe(5);
    await expect(EmailOtpService.verify(body.email, code())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('enforces resend cooldown atomically and invalidates the previous code', async () => {
    await AuthService.register(body);
    const old = code();
    await EmailOtpService.send(body.email);
    expect(deliver).toHaveBeenCalledTimes(1);
    await allowResend();
    await Promise.all([EmailOtpService.send(body.email), EmailOtpService.send(body.email)]);
    expect(deliver).toHaveBeenCalledTimes(2);
    // Hash also binds the email, and the previous challenge is replaced.
    if (old !== code()) await expect(EmailOtpService.verify(body.email, old)).rejects.toMatchObject({ statusCode: 400 });
    await EmailOtpService.verify(body.email, code());
  });

  it('limits deliveries to five per hour, then permits a new window', async () => {
    await AuthService.register(body);
    for (let i = 0; i < 5; i++) { await allowResend(); await EmailOtpService.send(body.email); }
    expect(deliver).toHaveBeenCalledTimes(5);
    await User.updateOne({ email: body.email }, { $set: { emailOtpWindowAt: new Date(Date.now() - 3600001) } });
    await EmailOtpService.send(body.email);
    expect(deliver).toHaveBeenCalledTimes(6);
  });

  it('fails closed before creating an account when delivery is not configured', async () => {
    ready.mockImplementation(() => { throw new Error('Missing email settings'); });
    await expect(AuthService.register(body)).rejects.toThrow('Missing email settings');
    expect(await User.countDocuments()).toBe(0);
  });

  it('invalidates a code when email delivery fails and allows recovery', async () => {
    deliver.mockRejectedValueOnce(new Error('SMTP failure'));
    await expect(AuthService.register(body)).rejects.toMatchObject({ statusCode: 503 });
    await expect(EmailOtpService.verify(body.email, code())).rejects.toMatchObject({ statusCode: 400 });
    await allowResend(); await EmailOtpService.send(body.email);
    await EmailOtpService.verify(body.email, code());
  });

  it('allows public resend and uses the same response for unknown or verified emails', async () => {
    const unknown = await post('/resend-verification', { email: body.email });
    expect(unknown.response.status).toBe(200);
    expect(deliver).not.toHaveBeenCalled();
    await AuthService.register(body);
    await EmailOtpService.verify(body.email, code());
    const verified = await post('/resend-verification', { email: body.email });
    expect(verified.body).toEqual(unknown.body);
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed input and legacy verification links', async () => {
    expect((await post('/verify-email', { email: { $ne: null }, otp: '123456' })).response.status).toBe(400);
    expect((await post('/verify-email', { email: body.email, otp: '123' })).response.status).toBe(400);
    expect((await fetch(base + '/verify-email/old-token')).status).toBe(410);
  });

  it('blocks previously issued JWTs and refresh tokens for unverified users', async () => {
    await AuthService.register(body);
    const user = (await User.findOne({ email: body.email }))!;
    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET!);
    const refresh = jwt.sign({ id: String(user._id) }, process.env.JWT_REFRESH_SECRET!);
    await User.updateOne({ _id: user._id }, { $set: { refreshToken: refresh } });
    expect((await fetch(base + '/me', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(403);
    await expect(AuthService.refreshToken(refresh)).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });

  it('does not let Google login bypass OTP for an existing unverified account', async () => {
    await AuthService.register(body);
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { email: body.email, sub: 'google-test', email_verified: true } });
    await expect(AuthService.googleLogin({ accessToken: 'mock-token' })).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect((await User.findOne({ email: body.email }).select('+googleId'))!.googleId).toBeUndefined();
  });

  it('rejects Google email claims that are not verified by Google', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { email: body.email, sub: 'google-test', email_verified: false } });
    await expect(AuthService.googleLogin({ accessToken: 'mock-token' })).rejects.toMatchObject({ statusCode: 401 });
    expect(await User.countDocuments()).toBe(0);
  });
});
