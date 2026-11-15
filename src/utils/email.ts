import nodemailer from 'nodemailer';

const isEmailConfigured = (): boolean => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  if (!isEmailConfigured()) {
    console.log('📧 [EMAIL - not sent, SMTP not configured]');
    console.log(`   To: ${to}\n   Subject: ${subject}\n   Body: ${html.replace(/<[^>]+>/g, ' ')}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email sending failed:', (error as Error).message);
  }
};

export const sendSms = async (phone: string, message: string): Promise<void> => {
  console.log(`📱 [SMS - simulated] To: ${phone} | ${message}`);
};

export const emailTemplate = (title: string, content: string): string => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#1e3a8a;color:#fff;padding:16px 24px;font-size:20px;font-weight:bold">BookHaven</div>
    <div style="padding:24px;color:#111827">
      <h2 style="margin-top:0">${title}</h2>
      ${content}
    </div>
    <div style="background:#f3f4f6;padding:12px 24px;font-size:12px;color:#6b7280">
      BookHaven Online Bookstore · Island-wide delivery within 5 days
    </div>
  </div>`;