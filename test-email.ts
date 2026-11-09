import { EmailService } from "./src/common/services/email.service";
import { env } from "./src/config/env";
import { EmailUtil } from "./src/common/utils/email.util";

async function main() {
  const targetEmail = process.argv[2] || env.SMTP_USER;

  console.log("==============================================================================");
  console.log("       CÔNG CỤ KIỂM TRA GỬI EMAIL THỰC TẾ (GRAB PLATFORM SMTP TEST)           ");
  console.log("==============================================================================");
  console.log(`📡 Máy chủ SMTP:    ${env.SMTP_HOST}:${env.SMTP_PORT} (Secure: ${env.SMTP_SECURE})`);
  console.log(`👤 Tài khoản gửi:   ${env.SMTP_USER || "[CHƯA CẤU HÌNH - ĐANG ĐỂ TRỐNG]"}`);
  console.log(`🔑 Mật khẩu app:    ${env.SMTP_PASS ? "******** (Đã có - Tự động lọc sạch khoảng trắng)" : "[CHƯA CẤU HÌNH - ĐANG ĐỂ TRỐNG]"}`);
  console.log(`🏷️ Người gửi (From): ${env.SMTP_FROM}`);
  console.log("------------------------------------------------------------------------------");

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.error("❌ LỖI: Chưa cấu hình SMTP_USER và SMTP_PASS trong file .env!");
    console.log("\n👉 Hướng dẫn kích hoạt gửi email thực:");
    console.log("1. Mở file .env ở thư mục gốc d:\\grab-platform\\.env");
    console.log("2. Điền email của bạn vào: SMTP_USER=\"email-cua-ban@gmail.com\"");
    console.log("3. Tạo mật khẩu ứng dụng 16 ký tự tại https://myaccount.google.com/apppasswords");
    console.log("4. Điền mã 16 ký tự vào:   SMTP_PASS=\"xxxx xxxx xxxx xxxx\"");
    console.log("5. Chạy lại lệnh: npx tsx test-email.ts dia-chi-nhan@gmail.com");
    process.exit(1);
  }

  if (!targetEmail || !EmailUtil.isValid(targetEmail)) {
    console.error("❌ Vui lòng truyền địa chỉ email nhận hợp lệ. Ví dụ: npx tsx test-email.ts your-email@gmail.com");
    process.exit(1);
  }

  console.log(`📧 Đang thử gửi mã OTP đến hòm thư thực: ${targetEmail}...`);
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

  const result = await EmailService.sendOtpEmail(targetEmail, testOtp);

  if (result.sent) {
    console.log(`\n🎉 THÀNH CÔNG RỰC RỠ!`);
    console.log(`✅ Mã OTP [${testOtp}] đã được gửi thành công đến ${targetEmail}`);
    console.log(`📬 Message ID: ${result.messageId}`);
    console.log(`👉 Vui lòng mở Hộp thư đến (hoặc mục Spam/Quảng cáo) của ${targetEmail} để kiểm tra!`);
  } else {
    console.error(`\n❌ THẤT BẠI: Không thể gửi email qua SMTP!`);
    console.error(`Chi tiết lỗi: ${result.error}`);
    if (result.error?.includes("Invalid login") || result.error?.includes("535-5.7.8")) {
      console.log("\n💡 Gợi ý khắc phục: Tài khoản hoặc Mật khẩu ứng dụng (App Password) không chính xác.");
      console.log("Hãy đảm bảo bạn đã tạo App Password tại https://myaccount.google.com/apppasswords");
    }
  }
  console.log("==============================================================================");
}

main().catch(console.error);
