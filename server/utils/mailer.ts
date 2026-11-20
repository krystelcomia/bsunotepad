import nodemailer from 'nodemailer';

export interface MailDeliveryResult {
  deliveryMode: 'smtp' | 'dev_preview';
  previewOtp?: string;
  previewLink?: string;
}

function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === '1',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return null;
}

export async function sendVerificationEmail(params: {
  to: string;
  fullName: string;
  otp: string;
  verifyUrl: string;
}): Promise<MailDeliveryResult> {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@inkora.app';

  if (transporter) {
    await transporter.sendMail({
      from: `"INKORA" <${from}>`,
      to: params.to,
      subject: 'Verify your INKORA Gmail address',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5dff4;border-radius:16px;">
          <h2 style="color:#4C1D95;margin:0 0 8px;">Verify your INKORA account</h2>
          <p style="color:#334155;font-size:14px;line-height:1.6;">
            Hi ${params.fullName}, enter this 6-digit verification code or click the button below to verify <strong>${params.to}</strong>:
          </p>
          <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#5B21B6;background:#F5F3FF;padding:14px 20px;border-radius:12px;text-align:center;margin:18px 0;">
            ${params.otp}
          </div>
          <p style="text-align:center;margin:20px 0;">
            <a href="${params.verifyUrl}" style="background:#5B21B6;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
              Verify Gmail Address
            </a>
          </p>
          <p style="color:#64748b;font-size:12px;">This code and link expire in 15 minutes.</p>
        </div>
      `,
    });
    return { deliveryMode: 'smtp' };
  }

  if (process.env.INKORA_HIDE_DEV_OTP === '1') {
    return { deliveryMode: 'dev_preview' };
  }

  return {
    deliveryMode: 'dev_preview',
    previewOtp: params.otp,
    previewLink: params.verifyUrl,
  };
}

export async function sendPasswordResetEmail(params: {
  to: string;
  fullName: string;
  otp: string;
  resetUrl: string;
}): Promise<MailDeliveryResult> {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.GMAIL_USER || 'no-reply@inkora.app';

  if (transporter) {
    await transporter.sendMail({
      from: `"INKORA" <${from}>`,
      to: params.to,
      subject: 'Reset your INKORA password',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5dff4;border-radius:16px;">
          <h2 style="color:#4C1D95;margin:0 0 8px;">Password Reset Request</h2>
          <p style="color:#334155;font-size:14px;line-height:1.6;">
            Hi ${params.fullName}, use this 6-digit code or click the reset link below to choose a new password for <strong>${params.to}</strong>:
          </p>
          <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#5B21B6;background:#F5F3FF;padding:14px 20px;border-radius:12px;text-align:center;margin:18px 0;">
            ${params.otp}
          </div>
          <p style="text-align:center;margin:20px 0;">
            <a href="${params.resetUrl}" style="background:#2563EB;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
              Reset Password
            </a>
          </p>
          <p style="color:#64748b;font-size:12px;">If you did not request this, you can safely ignore this email. Expires in 15 minutes.</p>
        </div>
      `,
    });
    return { deliveryMode: 'smtp' };
  }

  if (process.env.INKORA_HIDE_DEV_OTP === '1') {
    return { deliveryMode: 'dev_preview' };
  }

  return {
    deliveryMode: 'dev_preview',
    previewOtp: params.otp,
    previewLink: params.resetUrl,
  };
}
