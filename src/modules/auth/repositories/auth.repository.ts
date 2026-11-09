import { prisma } from "../../../config/prisma";
import { VaiTro, TrangThaiKhaDung, TrangThaiNguoiDung } from "@prisma/client";

export class AuthRepository {
  /**
   * Tìm người dùng theo số điện thoại (chỉ lấy người dùng chưa bị xóa mềm)
   */
  public async findByPhone(soDienThoai: string) {
    return prisma.nguoiDung.findFirst({
      where: {
        soDienThoai,
        deletedAt: null,
      },
      include: {
        khachHang: true,
        taiXe: true,
        quanTriVien: true,
      },
    });
  }

  /**
   * Tìm người dùng theo email (chỉ lấy người dùng chưa bị xóa mềm)
   */
  public async findByEmail(email: string) {
    return prisma.nguoiDung.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: {
        khachHang: true,
        taiXe: true,
        quanTriVien: true,
      },
    });
  }

  /**
   * Tìm người dùng thông minh theo Identifier (tự động nhận diện Email hoặc Số điện thoại)
   */
  public async findByIdentifier(identifier: string) {
    const trimmed = identifier.trim();
    if (trimmed.includes("@") || /[a-zA-Z]/.test(trimmed)) {
      return this.findByEmail(trimmed);
    }
    return this.findByPhone(trimmed);
  }

  /**
   * Tìm người dùng theo ID
   */
  public async findById(id: string) {
    return prisma.nguoiDung.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        khachHang: true,
        taiXe: true,
        quanTriVien: true,
      },
    });
  }

  /**
   * Đăng ký người dùng mới bằng Database Transaction (ACID)
   * Tạo NguoiDung đồng thời tạo bản ghi tương ứng trong bảng KhachHang/TaiXe/QuanTriVien
   */
  public async createUserWithProfile(
    dto: {
      soDienThoai?: string | null;
      email?: string | null;
      hoTen: string;
      matKhau?: string;
      vaiTro: VaiTro;
      soGiayPhepLaiXe?: string;
      bienSoXe?: string;
      loaiDichVu?: any;
      phongBan?: string;
      chucVu?: string;
    },
    hashedPassword: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi NguoiDung (nếu là Quản trị viên, khởi tạo ở trạng thái TAM_KHOA chờ duyệt)
      const user = await tx.nguoiDung.create({
        data: {
          soDienThoai: dto.soDienThoai || null,
          email: dto.email || null,
          hoTen: dto.hoTen,
          matKhauHash: hashedPassword,
          vaiTro: dto.vaiTro,
          trangThai:
            dto.vaiTro === VaiTro.QUAN_TRI_VIEN
              ? TrangThaiNguoiDung.TAM_KHOA
              : TrangThaiNguoiDung.HOAT_DONG,
        },
      });

      // 2. Tạo profile theo vai trò
      if (dto.vaiTro === VaiTro.KHACH_HANG) {
        await tx.khachHang.create({
          data: {
            nguoiDungId: user.id,
          },
        });
      } else if (dto.vaiTro === VaiTro.TAI_XE) {
        await tx.taiXe.create({
          data: {
            nguoiDungId: user.id,
            soGiayPhepLaiXe: dto.soGiayPhepLaiXe!,
            bienSoXe: dto.bienSoXe!,
            loaiDichVu: dto.loaiDichVu!,
            trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG,
          },
        });
      } else if (dto.vaiTro === VaiTro.QUAN_TRI_VIEN) {
        await tx.quanTriVien.create({
          data: {
            nguoiDungId: user.id,
            phongBan: dto.phongBan || "Vận hành",
            chucVu: dto.chucVu || "Chuyên viên điều phối",
          },
        });
      }

      // Query lại đầy đủ với profile
      return tx.nguoiDung.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          khachHang: true,
          taiXe: true,
          quanTriVien: true,
        },
      });
    });
  }

  /**
   * Cập nhật Refresh Token Hash
   */
  public async updateRefreshToken(userId: string, refreshTokenHash: string | null): Promise<void> {
    await prisma.nguoiDung.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  /**
   * Lấy danh sách các tài khoản Quản trị viên đang chờ phê duyệt
   */
  public async getPendingAdmins() {
    return prisma.nguoiDung.findMany({
      where: {
        vaiTro: VaiTro.QUAN_TRI_VIEN,
        trangThai: TrangThaiNguoiDung.TAM_KHOA,
        deletedAt: null,
      },
      include: {
        quanTriVien: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Phê duyệt tài khoản Quản trị viên (chuyển sang HOAT_DONG)
   */
  public async approveAdmin(userId: string) {
    return prisma.nguoiDung.update({
      where: { id: userId },
      data: {
        trangThai: TrangThaiNguoiDung.HOAT_DONG,
      },
      include: {
        quanTriVien: true,
      },
    });
  }

  /**
   * Từ chối yêu cầu đăng ký Quản trị viên (xóa mềm tài khoản)
   */
  public async rejectAdmin(userId: string) {
    return prisma.nguoiDung.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
