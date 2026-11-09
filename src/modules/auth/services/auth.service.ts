import { AuthRepository } from "../repositories/auth.repository";
import { RegisterDto, LoginDto, LoginOtpDto, RefreshTokenDto } from "../dtos/auth.dto";
import { OtpService } from "./otp.service";
import { PasswordUtil } from "../../../common/utils/password.util";
import { JwtUtil } from "../../../common/utils/jwt.util";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
} from "../../../common/exceptions/app-error";
import { TrangThaiNguoiDung, VaiTro } from "@prisma/client";
import { logger } from "../../../common/utils/logger";

export class AuthService {
  constructor(private readonly authRepository: AuthRepository = new AuthRepository()) {}

  /**
   * Yêu cầu gửi mã OTP về Email thực hoặc Số điện thoại
   */
  public async sendOtp(identifier: string) {
    return OtpService.sendOtp(identifier);
  }

  /**
   * Xác thực mã OTP
   */
  public verifyOtp(identifier: string, otpCode: string) {
    const isValid = OtpService.verifyOtp(identifier, otpCode);
    return {
      success: isValid,
      message: "Xác thực mã OTP thành công",
    };
  }

  /**
   * Đăng ký tài khoản mới (hỗ trợ Khách hàng, Tài xế, Quản trị viên bằng Email hoặc Số điện thoại)
   */
  public async register(dto: RegisterDto) {
    // 1. Kiểm tra Email đã tồn tại chưa (nếu có cung cấp)
    if (dto.email) {
      const existingEmail = await this.authRepository.findByEmail(dto.email);
      if (existingEmail) {
        throw new ConflictError("Địa chỉ email này đã được đăng ký trong hệ thống");
      }
    }

    // 2. Kiểm tra Số điện thoại đã tồn tại chưa (nếu có cung cấp)
    if (dto.soDienThoai) {
      const existingPhone = await this.authRepository.findByPhone(dto.soDienThoai);
      if (existingPhone) {
        throw new ConflictError("Số điện thoại này đã được đăng ký trong hệ thống");
      }
    }

    // 3. Xác thực OTP nếu có gửi kèm (hoặc bắt buộc trong production)
    if (dto.otpCode) {
      const targetIdentifier = (dto as any).otpIdentifier || dto.email || dto.soDienThoai!;
      OtpService.verifyOtp(targetIdentifier, dto.otpCode);
    }

    // 4. Băm mật khẩu bằng bcrypt
    const hashedPassword = await PasswordUtil.hash(dto.matKhau);

    // 5. Tạo tài khoản trong Database Transaction
    const user = await this.authRepository.createUserWithProfile(dto, hashedPassword);

    // Nếu đăng ký vai trò Quản trị viên, tài khoản ở trạng thái TAM_KHOA (chờ duyệt) và chưa cấp JWT token
    if (user.vaiTro === VaiTro.QUAN_TRI_VIEN) {
      logger.info(
        { userId: user.id, email: user.email, phone: user.soDienThoai },
        "Tài khoản Quản trị viên mới được tạo và đang chờ Quản trị viên hiện tại phê duyệt"
      );

      return {
        user: {
          id: user.id,
          soDienThoai: user.soDienThoai,
          email: user.email,
          hoTen: user.hoTen,
          vaiTro: user.vaiTro,
          trangThai: user.trangThai,
          profile: user.quanTriVien,
        },
        pendingApproval: true,
        message:
          "Đăng ký tài khoản Quản trị viên thành công! Tài khoản đang chờ Quản trị viên hiện tại duyệt trước khi có thể đăng nhập.",
      };
    }

    // 6. Sinh cặp JWT Tokens (Access Token + Refresh Token)
    const tokens = JwtUtil.generateTokens({
      userId: user.id,
      soDienThoai: user.soDienThoai,
      email: user.email,
      vaiTro: user.vaiTro,
    });

    // 7. Lưu hash của Refresh Token để quản lý phiên (Token Rotation)
    const refreshTokenHash = await PasswordUtil.hash(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(user.id, refreshTokenHash);

    logger.info(
      { userId: user.id, vaiTro: user.vaiTro, email: user.email, phone: user.soDienThoai },
      "Người dùng đăng ký thành công"
    );

    return {
      user: {
        id: user.id,
        soDienThoai: user.soDienThoai,
        email: user.email,
        hoTen: user.hoTen,
        vaiTro: user.vaiTro,
        profile: user.khachHang || user.taiXe || user.quanTriVien,
      },
      tokens,
    };
  }

  /**
   * Đăng nhập linh hoạt với Email HOẶC Số điện thoại & Mật khẩu
   */
  public async login(dto: LoginDto) {
    // 1. Tìm người dùng theo Email hoặc Số điện thoại
    const user = await this.authRepository.findByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedError("Email/Số điện thoại hoặc mật khẩu không chính xác");
    }

    // 2. Kiểm tra trạng thái tài khoản
    if (user.trangThai === TrangThaiNguoiDung.TAM_KHOA) {
      if (user.vaiTro === VaiTro.QUAN_TRI_VIEN) {
        throw new ForbiddenError(
          "Tài khoản Quản trị viên của bạn đang chờ Quản trị viên hiện tại phê duyệt trước khi có thể đăng nhập."
        );
      }
      throw new ForbiddenError("Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ quản trị viên.");
    }

    // 3. Kiểm tra mật khẩu
    const isPasswordValid = await PasswordUtil.compare(dto.matKhau, user.matKhauHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Email/Số điện thoại hoặc mật khẩu không chính xác");
    }

    // 4. Sinh cặp JWT Tokens mới
    const tokens = JwtUtil.generateTokens({
      userId: user.id,
      soDienThoai: user.soDienThoai,
      email: user.email,
      vaiTro: user.vaiTro,
    });

    // 5. Cập nhật Refresh Token Hash
    const refreshTokenHash = await PasswordUtil.hash(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(user.id, refreshTokenHash);

    logger.info(
      { userId: user.id, vaiTro: user.vaiTro, identifier: dto.identifier },
      "Người dùng đăng nhập thành công"
    );

    return {
      user: {
        id: user.id,
        soDienThoai: user.soDienThoai,
        email: user.email,
        hoTen: user.hoTen,
        vaiTro: user.vaiTro,
        profile: user.khachHang || user.taiXe || user.quanTriVien,
      },
      tokens,
    };
  }

  /**
   * Đăng nhập không cần mật khẩu bằng mã OTP (Passwordless OTP Login - Chuẩn Grab thực tế)
   */
  public async loginWithOtp(dto: LoginOtpDto) {
    // 1. Xác thực tính chính xác của mã OTP
    OtpService.verifyOtp(dto.identifier, dto.otpCode);

    // 2. Tìm người dùng trong hệ thống
    let user = await this.authRepository.findByIdentifier(dto.identifier);

    // 3. Nếu chưa có tài khoản, tự động khởi tạo tài khoản Khách hàng mới (như Grab thực tế)
    if (!user) {
      const isEmail = dto.isEmail ?? dto.identifier.includes("@");
      const defaultName: string =
        (isEmail
          ? dto.identifier.split("@")[0]
          : `Khách hàng ${dto.identifier.slice(-4)}`) || "Khách hàng Grab";
      const randomPassword = await PasswordUtil.hash(Math.random().toString(36).slice(-10));

      user = await this.authRepository.createUserWithProfile(
        {
          soDienThoai: isEmail ? undefined : dto.identifier,
          email: isEmail ? dto.identifier : undefined,
          hoTen: defaultName,
          matKhau: randomPassword,
          vaiTro: VaiTro.KHACH_HANG,
        },
        randomPassword
      );
    }

    if (user.trangThai === TrangThaiNguoiDung.TAM_KHOA) {
      if (user.vaiTro === VaiTro.QUAN_TRI_VIEN) {
        throw new ForbiddenError(
          "Tài khoản Quản trị viên của bạn đang chờ Quản trị viên hiện tại phê duyệt trước khi có thể đăng nhập."
        );
      }
      throw new ForbiddenError("Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ quản trị viên.");
    }

    // 4. Sinh cặp JWT Tokens
    const tokens = JwtUtil.generateTokens({
      userId: user.id,
      soDienThoai: user.soDienThoai,
      email: user.email,
      vaiTro: user.vaiTro,
    });

    const refreshTokenHash = await PasswordUtil.hash(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(user.id, refreshTokenHash);

    logger.info(
      { userId: user.id, vaiTro: user.vaiTro, identifier: dto.identifier },
      "Người dùng đăng nhập thành công bằng mã OTP"
    );

    return {
      user: {
        id: user.id,
        soDienThoai: user.soDienThoai,
        email: user.email,
        hoTen: user.hoTen,
        vaiTro: user.vaiTro,
        profile: user.khachHang || user.taiXe || user.quanTriVien,
      },
      tokens,
    };
  }

  /**
   * Làm mới Access Token bằng Refresh Token (Token Rotation)
   */
  public async refreshTokens(dto: RefreshTokenDto) {
    // 1. Verify Refresh Token
    const payload = JwtUtil.verifyRefreshToken(dto.refreshToken);

    // 2. Tìm người dùng và kiểm tra tính hợp lệ
    const user = await this.authRepository.findById(payload.userId);
    if (!user || user.trangThai === TrangThaiNguoiDung.TAM_KHOA) {
      throw new UnauthorizedError("Người dùng không hợp lệ hoặc tài khoản đã bị khóa");
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedError("Phiên làm việc đã bị hủy, vui lòng đăng nhập lại");
    }

    // 3. So khớp hash Refresh Token (Phát hiện tấn công dùng lại token)
    const isMatch = await PasswordUtil.compare(dto.refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      await this.authRepository.updateRefreshToken(user.id, null);
      throw new UnauthorizedError("Refresh token không hợp lệ hoặc đã bị tái sử dụng trái phép");
    }

    // 4. Sinh cặp token mới (Token Rotation)
    const tokens = JwtUtil.generateTokens({
      userId: user.id,
      soDienThoai: user.soDienThoai,
      email: user.email,
      vaiTro: user.vaiTro,
    });

    // 5. Cập nhật hash mới
    const newRefreshHash = await PasswordUtil.hash(tokens.refreshToken);
    await this.authRepository.updateRefreshToken(user.id, newRefreshHash);

    return tokens;
  }

  /**
   * Đăng xuất (Thu hồi Refresh Token)
   */
  public async logout(userId: string) {
    await this.authRepository.updateRefreshToken(userId, null);
    return { success: true, message: "Đăng xuất thành công" };
  }

  /**
   * Lấy thông tin cá nhân hiện tại
   */
  public async getProfile(userId: string) {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Không tìm thấy thông tin người dùng");
    }

    return {
      id: user.id,
      soDienThoai: user.soDienThoai,
      email: user.email,
      hoTen: user.hoTen,
      vaiTro: user.vaiTro,
      trangThai: user.trangThai,
      createdAt: user.createdAt,
      profile: user.khachHang || user.taiXe || user.quanTriVien,
    };
  }

  /**
   * Lấy danh sách các tài khoản Quản trị viên đang chờ phê duyệt
   */
  public async getPendingAdmins() {
    const list = await this.authRepository.getPendingAdmins();
    return list.map((user) => ({
      id: user.id,
      soDienThoai: user.soDienThoai,
      email: user.email,
      hoTen: user.hoTen,
      vaiTro: user.vaiTro,
      trangThai: user.trangThai,
      createdAt: user.createdAt,
      quanTriVien: user.quanTriVien,
    }));
  }

  /**
   * Phê duyệt tài khoản Quản trị viên mới bởi Quản trị viên hiện tại
   */
  public async approveAdmin(adminUserId: string, targetUserId: string) {
    const targetUser = await this.authRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError("Không tìm thấy tài khoản quản trị viên yêu cầu duyệt");
    }

    if (targetUser.vaiTro !== VaiTro.QUAN_TRI_VIEN) {
      throw new BadRequestError("Tài khoản này không phải là Quản trị viên");
    }

    if (targetUser.trangThai === TrangThaiNguoiDung.HOAT_DONG) {
      throw new ConflictError("Tài khoản Quản trị viên này đã được duyệt trước đó");
    }

    const updated = await this.authRepository.approveAdmin(targetUserId);

    logger.info(
      { approverAdminId: adminUserId, approvedAdminId: targetUserId, email: targetUser.email },
      "Quản trị viên đã phê duyệt tài khoản Quản trị viên mới thành công"
    );

    return {
      message: `Đã phê duyệt thành công tài khoản Quản trị viên cho ${targetUser.hoTen}`,
      user: {
        id: updated.id,
        hoTen: updated.hoTen,
        email: updated.email,
        soDienThoai: updated.soDienThoai,
        trangThai: updated.trangThai,
      },
    };
  }

  /**
   * Từ chối / Xóa yêu cầu đăng ký Quản trị viên
   */
  public async rejectAdmin(adminUserId: string, targetUserId: string) {
    const targetUser = await this.authRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError("Không tìm thấy tài khoản quản trị viên yêu cầu duyệt");
    }

    if (targetUser.id === adminUserId) {
      throw new BadRequestError("Không thể từ chối chính tài khoản của bạn");
    }

    await this.authRepository.rejectAdmin(targetUserId);

    logger.info(
      { rejecterAdminId: adminUserId, rejectedAdminId: targetUserId },
      "Quản trị viên đã từ chối yêu cầu đăng ký Quản trị viên"
    );

    return {
      message: `Đã từ chối tài khoản Quản trị viên của ${targetUser.hoTen}`,
    };
  }
}
