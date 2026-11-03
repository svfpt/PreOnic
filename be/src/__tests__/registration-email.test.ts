import { getRegistrationEmailConfig, sendRegistrationOtp } from '../services/email.service';
import nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../utils/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
const originalEnv = { ...process.env };
beforeEach(() => {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'BREVO_API_KEY', 'EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD']) delete process.env[key];
});
afterEach(() => { process.env = { ...originalEnv }; });

test('rejects missing delivery settings instead of providing a verification bypass', () => {
  expect(() => getRegistrationEmailConfig()).toThrow('chưa cấu hình');
});

test('accepts Brevo with a verified sender without requiring SMTP credentials', () => {
  process.env.BREVO_API_KEY = 'mock-key';
  expect(() => getRegistrationEmailConfig()).toThrow('chưa cấu hình');
  process.env.SMTP_FROM = 'PreOnic <sender@example.com>';
  expect(getRegistrationEmailConfig().user).toBe('sender@example.com');
});

test('sends six-digit codes through configured SMTP and escapes the account name', async () => {
  process.env.SMTP_HOST = 'smtp.example.com'; process.env.SMTP_USER = 'sender@example.com'; process.env.SMTP_PASS = 'mock-password';
  const sendMail = jest.fn().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  await sendRegistrationOtp('user@example.com', '<img src=x>', '012345');
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com', html: expect.stringContaining('012345') }));
  expect(sendMail.mock.calls[0][0].html).toContain('&lt;img src=x&gt;');
  expect(sendMail.mock.calls[0][0].html).not.toContain('<img');
});
