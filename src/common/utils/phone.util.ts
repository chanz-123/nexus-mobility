export class PhoneUtil {
  private static readonly VN_PHONE_REGEX = /^0(3|5|7|8|9)[0-9]{8}$/;

  /**
   * Chuẩn hóa số điện thoại Việt Nam về định dạng chuẩn 10 số (VD: 0901234567)
   * Tự động xử lý +84, 84, khoảng trắng, dấu gạch ngang, dấu ngoặc
   */
  public static normalize(phone: string): string {
    if (!phone) return "";
    let cleaned = phone.trim().replace(/[\s().-]/g, "");
    if (cleaned.startsWith("+84")) {
      cleaned = "0" + cleaned.slice(3);
    } else if (cleaned.startsWith("84") && cleaned.length === 11) {
      cleaned = "0" + cleaned.slice(2);
    } else if (/^[35789][0-9]{8}$/.test(cleaned)) {
      // Tự động thêm số 0 đầu nếu người dùng nhập 9 chữ số di động VN
      cleaned = "0" + cleaned;
    }
    return cleaned;
  }

  /**
   * Kiểm tra định dạng số điện thoại di động Việt Nam hợp lệ (10 số, đầu số 03, 05, 07, 08, 09)
   */
  public static isValid(phone: string): boolean {
    const normalized = this.normalize(phone);
    return this.VN_PHONE_REGEX.test(normalized);
  }

  /**
   * Ẩn số điện thoại để bảo vệ quyền riêng tư nội bộ (VD: 0901234567 -> 090****567)
   */
  public static mask(phone?: string | null): string {
    if (!phone) return "***";
    const normalized = this.normalize(phone);
    if (normalized.length < 7) return "***";
    const prefix = normalized.slice(0, 3);
    const suffix = normalized.slice(-3);
    return `${prefix}****${suffix}`;
  }
}
