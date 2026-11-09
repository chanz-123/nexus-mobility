export class EmailUtil {
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  /**
   * Kiểm tra định dạng email hợp lệ
   */
  public static isValid(email: string): boolean {
    if (!email) return false;
    return this.EMAIL_REGEX.test(email.trim().toLowerCase());
  }

  /**
   * Chuẩn hóa email về chữ thường và xóa khoảng trắng thừa
   */
  public static normalize(email: string): string {
    return email ? email.trim().toLowerCase() : "";
  }

  /**
   * Ẩn một phần email để hiển thị an toàn (VD: nguyenvana@gmail.com -> ng*****a@gmail.com)
   */
  public static mask(email?: string | null): string {
    if (!email) return "***";
    const normalized = this.normalize(email);
    const parts = normalized.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return "***";

    const userPart = parts[0];
    const domainPart = parts[1];
    if (userPart.length <= 2) {
      return `${userPart[0]}*@${domainPart}`;
    }
    const prefix = userPart.slice(0, 2);
    const suffix = userPart.slice(-1);
    return `${prefix}*****${suffix}@${domainPart}`;
  }
}
