// Email service tách riêng từ auth.service.ts theo nguyên tắc SRP.
// Trách nhiệm duy nhất: cấu hình SMTP, gửi email, render template HTML.

import { createLogger } from '../utils/logger';

const log = createLogger('Email');

const DEFAULT_SMTP_PORT = 587;
const FRONTEND_URL_FALLBACK = 'http://localhost:3000';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

// Đọc cấu hình SMTP từ biến môi trường. Nếu includeLegacyEnv=true thì hỗ trợ tên cũ
// EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD để tương thích ngược.
function normalizeEnvValue(value?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSmtpConfig(includeLegacyEnv: boolean = false): SmtpConfig | null {
  const host = normalizeEnvValue(process.env.SMTP_HOST) || (includeLegacyEnv ? normalizeEnvValue(process.env.EMAIL_HOST) : undefined);
  const user = normalizeEnvValue(process.env.SMTP_USER) || (includeLegacyEnv ? normalizeEnvValue(process.env.EMAIL_USER) : undefined);
  const pass = normalizeEnvValue(process.env.SMTP_PASS) || (includeLegacyEnv ? normalizeEnvValue(process.env.EMAIL_PASSWORD) : undefined);

  if (!host || !user || !pass) {
    return null;
  }

  const portValue = normalizeEnvValue(process.env.SMTP_PORT) || (includeLegacyEnv ? normalizeEnvValue(process.env.EMAIL_PORT) : undefined) || String(DEFAULT_SMTP_PORT);
  const secureValue = normalizeEnvValue(process.env.SMTP_SECURE) || 'false';

  return {
    host,
    user,
    pass: pass.replace(/\s+/g, ''),
    port: Number(portValue),
    secure: secureValue.toLowerCase() === 'true',
    from: normalizeEnvValue(process.env.SMTP_FROM) || `"PreOnic" <${user}>`,
  };
}

// Các lỗi kết nối/timeout SMTP thường gặp khi host (vd Render) chặn cổng 587.
const SMTP_CONNECTION_ERRORS = ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'EDNS', 'EAI_AGAIN'];

async function sendVia(
  config: SmtpConfig,
  port: number,
  secure: boolean,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  await transporter.sendMail({ from: config.from, to, subject, html });
}

// Tách "Tên <email>" thành { name, email }. Dùng để dựng sender cho Brevo.
function parseFrom(from: string, fallbackEmail: string): { name: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>]+)\s*>\s*$/);
  if (match) {
    return { name: match[1].trim() || 'PreOnic', email: match[2].trim() };
  }
  // from chỉ là 1 địa chỉ email trần
  const bare = from.trim();
  return { name: 'PreOnic', email: bare.includes('@') ? bare : fallbackEmail };
}

// Gửi mail qua Brevo HTTP API (port 443) — KHÔNG bị host (Render Free) chặn như SMTP.
// Yêu cầu env BREVO_API_KEY và sender (SMTP_FROM/SMTP_USER) đã được verify trên Brevo.
async function sendViaBrevo(config: SmtpConfig, to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY as string;
  const sender = parseFrom(config.from, config.user);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${detail}`);
  }
}

export async function sendEmail(config: SmtpConfig, to: string, subject: string, html: string): Promise<void> {
  // Ưu tiên Brevo HTTP API nếu được cấu hình (bắt buộc trên Render Free vì SMTP bị chặn).
  if (process.env.BREVO_API_KEY) {
    try {
      log.info(`Brevo: gửi mail tới ${to} qua HTTP API...`);
      await sendViaBrevo(config, to, subject, html);
      log.info(`Brevo: gửi mail tới ${to} THÀNH CÔNG.`);
      return;
    } catch (err: any) {
      log.error(`Brevo gửi mail tới ${to} thất bại: ${err?.message}`, err);
      throw err;
    }
  }

  // Không có Brevo → dùng SMTP (phù hợp local dev; trên Render Free sẽ bị chặn).
  try {
    log.info(`SMTP: gửi mail tới ${to} qua cổng ${config.port} (secure=${config.secure})...`);
    await sendVia(config, config.port, config.secure, to, subject, html);
    log.info(`SMTP: gửi mail tới ${to} THÀNH CÔNG qua cổng ${config.port}.`);
  } catch (err: any) {
    const code = err?.code as string | undefined;
    const isConnIssue = !!code && SMTP_CONNECTION_ERRORS.includes(code);
    // Một số host (Render…) chặn/giới hạn cổng 587 STARTTLS. Thử lại qua 465 SSL.
    const alreadyTried465 = config.port === 465 && config.secure;

    if (isConnIssue && !alreadyTried465) {
      log.warn(`SMTP cổng ${config.port} lỗi (${code}: ${err?.message}). Thử lại qua cổng 465 (SSL)...`);
      try {
        await sendVia(config, 465, true, to, subject, html);
        log.info(`SMTP: gửi mail tới ${to} THÀNH CÔNG qua cổng 465 (fallback).`);
        return;
      } catch (err2: any) {
        log.error(
          `SMTP cổng 465 cũng lỗi (${err2?.code}: ${err2?.message}). ` +
          `Nhiều khả năng host (Render Free) đang CHẶN toàn bộ cổng SMTP — cần chuyển sang gửi mail qua HTTP API.`,
          err2
        );
        throw err2;
      }
    }
    log.error(`SMTP gửi mail tới ${to} thất bại (${code}: ${err?.message}).`, err);
    throw err;
  }
}

function buildVerificationEmailHtml(fullName: string, verifyUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">PreOnic</h1>
        <p style="margin: 5px 0 0;">Nền tảng kết nối nông nghiệp bền vững</p>
      </div>
      <div style="padding: 32px; background: #f9f9f9;">
        <h2 style="color: #333;">Xin chào ${fullName}!</h2>
        <p style="color: #555; line-height: 1.6;">
          Cảm ơn bạn đã đăng ký tài khoản PreOnic. Vui lòng nhấn nút bên dưới để xác minh địa chỉ email của bạn.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}"
            style="background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px;
                   text-decoration: none; font-weight: bold; font-size: 16px;">
            Xác minh email
          </a>
        </div>
        <p style="color: #777; font-size: 13px;">
          Nếu nút không hoạt động, hãy copy đường link này vào trình duyệt:<br/>
          <a href="${verifyUrl}" style="color: #16a34a;">${verifyUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
        </p>
      </div>
    </div>
  `;
}

export function buildPasswordResetEmailHtml(fullName: string, resetUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">PreOnic</h1>
        <p style="margin: 5px 0 0;">Nền tảng kết nối nông nghiệp bền vững</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2 style="color: #333;">Đặt lại mật khẩu</h2>
        <p style="color: #555;">Xin chào <strong>${fullName}</strong>,</p>
        <p style="color: #555;">Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản PreOnic. Link có hiệu lực trong <strong>10 phút</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Đặt lại mật khẩu</a>
        </div>
        <p style="color: #555; font-size: 13px;">Hoặc dán link: <span style="word-break: break-all; color: #16a34a;">${resetUrl}</span></p>
        <p style="color: #555;">Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">Email tự động từ hệ thống PreOnic. Vui lòng không trả lời.</p>
      </div>
    </div>
  `;
}

export function buildVerificationUrl(token: string): string {
  return `${process.env.FRONTEND_URL || FRONTEND_URL_FALLBACK}/verify-email?token=${token}`;
}

// Gửi email xác minh tài khoản. Nếu chưa cấu hình SMTP hoặc SMTP lỗi, vẫn trả về URL
// để dev/test có thể mở trực tiếp link xác minh và kiểm tra luồng mà không cần SMTP thật.
export async function sendVerificationEmail(email: string, fullName: string, token: string): Promise<string> {
  const verifyUrl = buildVerificationUrl(token);
  const smtpConfig = getSmtpConfig(true);

  if (!smtpConfig) {
    log.warn(
      `[SMTP] Thiếu cấu hình SMTP. Đối với Gmail, hãy dùng App Password 16 ký tự (không có khoảng trắng) trong SMTP_PASS. ` +
      `Verification URL for ${email}: ${verifyUrl}`
    );
    return verifyUrl;
  }

  try {
    await sendEmail(
      smtpConfig,
      email,
      '[PreOnic] Xác minh địa chỉ email của bạn',
      buildVerificationEmailHtml(fullName, verifyUrl)
    );
    return verifyUrl;
  } catch (err: any) {
    log.error(`Gửi email xác minh cho ${email} thất bại: ${err?.message || String(err)}`, err);
    log.warn(`Verification URL fallback for ${email}: ${verifyUrl}`);
    return verifyUrl;
  }
}

export async function sendSignOtpEmail(email: string, fullName: string, otp: string, contractCode: string): Promise<void> {
  const smtpConfig = getSmtpConfig(true);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">PreOnic</h1>
        <p style="margin: 5px 0 0;">Ký hợp đồng điện tử</p>
      </div>
      <div style="padding: 32px; background: #f9f9f9;">
        <h2 style="color: #333;">Xin chào ${fullName}!</h2>
        <p style="color: #555;">Bạn đã yêu cầu ký hợp đồng <strong>${contractCode}</strong>. Nhập mã OTP bên dưới để xác nhận chữ ký điện tử của bạn.</p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: #111827; color: #4ade80; font-size: 36px; font-weight: 900; letter-spacing: 10px; padding: 18px 32px; border-radius: 10px; font-family: monospace;">
            ${otp}
          </div>
        </div>
        <p style="color: #777; font-size: 13px; text-align: center;">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">Nếu bạn không yêu cầu ký hợp đồng này, vui lòng bỏ qua email và liên hệ hỗ trợ ngay.</p>
      </div>
    </div>
  `;

  if (!smtpConfig) {
    log.info(`[MOCK] Sign OTP for ${email} (${contractCode}): ${otp}`);
    return;
  }

  await sendEmail(smtpConfig, email, `[PreOnic] Mã OTP ký hợp đồng ${contractCode}`, html);
}

export async function sendPasswordResetEmail(email: string, fullName: string, resetUrl: string): Promise<void> {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    log.info(`[MOCK] Password reset URL for ${email}: ${resetUrl}`);
    return;
  }
  await sendEmail(
    smtpConfig,
    email,
    '[PreOnic] Đặt lại mật khẩu',
    buildPasswordResetEmailHtml(fullName, resetUrl)
  );
}
