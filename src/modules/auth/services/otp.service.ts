import { logger } from "../../../common/utils/logger";
import { PhoneUtil } from "../../../common/utils/phone.util";
import { EmailUtil } from "../../../common/utils/email.util";
import { BadRequestError } from "../../../common/exceptions/app-error";
import { EmailService } from "../../../common/services/email.service";

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface SendOtpResult {
  success: boolean;
  channel: "EMAIL" | "PHONE";
  recipient: string;
  realEmailSent?: boolean;
  simulatedCode?: string;
  expiresInSeconds: number;
  message: string;
}

export class OtpService {
  // In-memory OTP storage: identifier (normalized phone or email) -> OtpEntry
  private static readonly otpStore = new Map<string, OtpEntry>();
  private static readonly OTP_TTL_MS = 5 * 60 * 1000; // 5 phút
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  /**
   * Sinh mã OTP 6 số ngẫu nhiên, lưu vào bộ nhớ và gửi về Email thực hoặc SMS
   */
  public static async sendOtp(identifier: string): Promise<SendOtpResult> {
    if (!identifier || !identifier.trim()) {
      throw new BadRequestError("Vui lòng cung cấp email hoặc số điện thoại để nhận mã OTP");
    }

    const cleanId = identifier.trim();
    const isEmail = cleanId.includes("@") || /[a-zA-Z]/.test(cleanId);
    let normalized: string;
    let channel: "EMAIL" | "PHONE";
    let maskedRecipient: string;

    if (isEmail) {
      if (!EmailUtil.isValid(cleanId)) {
        throw new BadRequestError("Địa chỉ email không đúng định dạng (VD: ban@gmail.com)");
      }
      normalized = EmailUtil.normalize(cleanId);
      channel = "EMAIL";
      maskedRecipient = EmailUtil.mask(normalized);
    } else {
      if (!PhoneUtil.isValid(cleanId)) {
        throw new BadRequestError("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03, 05, 07, 08, 09)");
      }
      normalized = PhoneUtil.normalize(cleanId);
      channel = "PHONE";
      maskedRecipient = PhoneUtil.mask(normalized);
    }

    // Sinh mã 6 số (100000 -> 999999)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + this.OTP_TTL_MS;

    this.otpStore.set(normalized, {
      code: otpCode,
      expiresAt,
      attempts: 0,
    });

    let realEmailSent = false;
    let resultMessage = "";

    if (channel === "EMAIL") {
      const emailResult = await EmailService.sendOtpEmail(normalized, otpCode);
      realEmailSent = emailResult.sent;

      if (realEmailSent) {
        resultMessage = `Mã xác thực OTP đã được gửi đến email ${maskedRecipient}. Vui lòng kiểm tra hộp thư!`;
      } else {
        resultMessage = `Đã mô phỏng gửi mã OTP đến email ${maskedRecipient}. (Hệ thống chưa cấu hình SMTP trong .env)`;
      }
    } else {
      logger.info(
        { phone: maskedRecipient, otp: process.env.NODE_ENV !== "production" ? otpCode : "[HIDDEN]" },
        `[SMS GATEWAY SIMULATION] Đã gửi mã OTP đến ${maskedRecipient}`
      );
      resultMessage = `Mã xác thực OTP đã được gửi đến số điện thoại ${maskedRecipient}!`;
    }

    return {
      success: true,
      channel,
      recipient: maskedRecipient,
      realEmailSent,
      simulatedCode: process.env.NODE_ENV !== "production" ? otpCode : undefined,
      expiresInSeconds: 300,
      message: resultMessage,
    };
  }

  /**
   * Kiểm tra tính hợp lệ của mã OTP theo Email hoặc Số điện thoại
   */
  public static verifyOtp(identifier: string, inputCode: string): boolean {
    if (!identifier || !inputCode) {
      throw new BadRequestError("Thiếu thông tin xác thực mã OTP");
    }

    const cleanId = identifier.trim();
    const isEmail = cleanId.includes("@") || /[a-zA-Z]/.test(cleanId);
    const normalized = isEmail ? EmailUtil.normalize(cleanId) : PhoneUtil.normalize(cleanId);

    const entry = this.otpStore.get(normalized);

    if (!entry) {
      throw new BadRequestError("Mã OTP chưa được yêu cầu hoặc đã hết hạn. Vui lòng lấy mã mới.");
    }

    if (Date.now() > entry.expiresAt) {
      this.otpStore.delete(normalized);
      throw new BadRequestError("Mã OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu mã mới.");
    }

    entry.attempts += 1;
    if (entry.attempts > this.MAX_VERIFY_ATTEMPTS) {
      this.otpStore.delete(normalized);
      throw new BadRequestError("Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu mã mới.");
    }

    if (entry.code !== inputCode.trim()) {
      throw new BadRequestError(`Mã OTP không chính xác. Còn lại ${this.MAX_VERIFY_ATTEMPTS - entry.attempts} lần thử.`);
    }

    // Xác thực thành công: xóa OTP để không tái sử dụng (Single-use)
    this.otpStore.delete(normalized);
    return true;
  }
}
