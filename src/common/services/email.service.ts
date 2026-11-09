import nodemailer, { Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../utils/logger";

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter | null {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      return null;
    }

    if (!this.transporter) {
      const cleanPass = env.SMTP_PASS.replace(/\s+/g, "");
      const isGmail = env.SMTP_HOST.includes("gmail") || env.SMTP_USER.includes("@gmail.com");

      this.transporter = isGmail
        ? nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: env.SMTP_USER.trim(),
              pass: cleanPass,
            },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
          })
        : nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465 || env.SMTP_SECURE,
            auth: {
              user: env.SMTP_USER.trim(),
              pass: cleanPass,
            },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
            tls: {
              rejectUnauthorized: false,
            },
          });
    }

    return this.transporter;
  }

  /**
   * Gửi mã OTP xác thực về Email người dùng qua giao thức SMTP thực
   */
  public static async sendOtpEmail(toEmail: string, otpCode: string): Promise<SendEmailResult> {
    const transporter = this.getTransporter();

    // Nếu chưa cấu hình tài khoản SMTP trong file .env
    if (!transporter) {
      logger.warn(
        { toEmail, otpCode },
        "[EMAIL SERVICE] Chưa cấu hình SMTP_USER và SMTP_PASS trong file .env. Hệ thống đang chạy ở chế độ mô phỏng."
      );
      return {
        sent: false,
        simulated: true,
        error: "Chưa cấu hình tài khoản gửi email SMTP trong file .env",
      };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mã xác thực Grab</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9fa; margin: 0; padding: 24px 12px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #eef0f2; }
          .header { background: #00B14F; padding: 32px 24px; text-align: center; color: #ffffff; }
          .brand-title { font-size: 36px; font-weight: 900; letter-spacing: -1px; margin: 0; line-height: 1; }
          .brand-sub { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #e8f8ee; margin-top: 8px; display: block; }
          .body { padding: 36px 28px; color: #1c2430; }
          .greeting { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 12px; }
          .intro { font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 28px; }
          .otp-card { background: #f0fdf4; border: 2px dashed #00B14F; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0; }
          .otp-badge { font-size: 12px; font-weight: 800; color: #00853E; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
          .otp-digits { font-family: 'Courier New', Courier, monospace; font-size: 44px; font-weight: 900; letter-spacing: 12px; color: #00B14F; margin: 0; text-indent: 12px; }
          .otp-expiry { font-size: 13px; color: #047857; font-weight: 600; margin-top: 12px; }
          .notice { background: #fffbeb; border-radius: 12px; border: 1px solid #fef3c7; padding: 14px 16px; margin-top: 28px; font-size: 13px; color: #92400e; line-height: 1.5; }
          .footer { background: #fbfcfd; padding: 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f1f3f5; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="brand-title">Grab</h1>
            <span class="brand-sub">HỆ THỐNG XÁC THỰC BẢO MẬT</span>
          </div>
          <div class="body">
            <div class="greeting">Xin chào bạn,</div>
            <p class="intro">
              Mã xác thực một lần (OTP) của bạn để truy cập nền tảng <strong>Grab Platform</strong> là:
            </p>
            <div class="otp-card">
              <div class="otp-badge">MÃ XÁC THỰC OTP</div>
              <div class="otp-digits">${otpCode}</div>
              <div class="otp-expiry">⏱️ Có hiệu lực trong vòng <strong>5 phút</strong></div>
            </div>
            <div class="notice">
              🔒 <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai (kể cả nhân viên Grab). Grab không bao giờ yêu cầu bạn cung cấp mã OTP qua điện thoại hoặc tin nhắn.
            </div>
          </div>
          <div class="footer">
            Email này được gửi tự động từ máy chủ xác thực Grab Platform.<br>
            © 2026 Grab Vietnam. Mọi quyền được bảo lưu.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const senderEmail = env.SMTP_USER.trim();
      const senderFrom = `"Grab Vietnam" <${senderEmail}>`;

      const info = await transporter.sendMail({
        from: senderFrom,
        to: toEmail,
        subject: `[Grab Platform] Mã xác thực OTP của bạn: ${otpCode}`,
        text: `Mã xác thực Grab của bạn là: ${otpCode}. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
        html: htmlContent,
      });

      logger.info(
        { toEmail, messageId: info.messageId },
        "[EMAIL SERVICE] Đã gửi mã OTP thực thành công qua SMTP"
      );

      return {
        sent: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      logger.error(
        { toEmail, error: err.message },
        "[EMAIL SERVICE] Thất bại khi gửi email qua SMTP"
      );
      return {
        sent: false,
        simulated: true,
        error: err.message,
      };
    }
  }
}
