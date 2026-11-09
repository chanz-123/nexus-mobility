import bcrypt from "bcryptjs";

export class PasswordUtil {
  private static readonly SALT_ROUNDS = 10;

  public static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  public static async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
