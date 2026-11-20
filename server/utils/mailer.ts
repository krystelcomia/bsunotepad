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
      subject: 'Beripikahin ang iyong INKORA Gmail address',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:16px;background:#ffffff;">
          <h2 style="color:#1e3a8a;margin:0 0 8px;">Beripikahin ang iyong INKORA account</h2>
          <p style="color:#334155;font-size:14px;line-height:1.6;">
            Kumusta ${params.fullName}, ilagay ang 6-digit na verification code o pindutin ang button sa ibaba upang beripikahin ang <strong>${params.to}</strong>:
          </p>
          <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#1d4ed8;background:#eff6ff;padding:14px 20px;border-radius:12px;text-align:center;margin:18px 0;">
            ${params.otp}
          </div>
          <p style="text-align:center;margin:20px 0;">
            <a href="${params.verifyUrl}" style="background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
              Beripikahin ang Gmail Address
            </a>
          </p>
          <p style="color:#64748b;font-size:12px;">Mag-e-expire ang code at link na ito sa loob ng 15 minuto.</p>
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
      subject: 'I-reset ang iyong password sa INKORA',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:16px;background:#ffffff;">
          <h2 style="color:#1e3a8a;margin:0 0 8px;">Kahilingan sa Pag-reset ng Password</h2>
          <p style="color:#334155;font-size:14px;line-height:1.6;">
            Kumusta ${params.fullName}, gamitin ang 6-digit code na ito o pindutin ang link sa ibaba upang magtakda ng bagong password para sa <strong>${params.to}</strong>:
          </p>
          <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#1d4ed8;background:#eff6ff;padding:14px 20px;border-radius:12px;text-align:center;margin:18px 0;">
            ${params.otp}
          </div>
          <p style="text-align:center;margin:20px 0;">
            <a href="${params.resetUrl}" style="background:#2563EB;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
              I-reset ang Password
            </a>
          </p>
          <p style="color:#64748b;font-size:12px;">Kung hindi ikaw ang humiling nito, maaari mong balewalain ang email na ito. Mag-e-expire ito sa loob ng 15 minuto.</p>
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
