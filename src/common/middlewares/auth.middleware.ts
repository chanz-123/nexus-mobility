import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../exceptions/app-error";
import { JwtUtil } from "../utils/jwt.util";
import { prisma } from "../../config/prisma";
import { TrangThaiNguoiDung } from "@prisma/client";

export const authenticateJwt = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Thiếu Authorization header Bearer token");
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError("Token không được để trống");
    }

    const decoded = JwtUtil.verifyAccessToken(token);

    // Query người dùng và quan hệ để lấy ID profile tương ứng
    const user = await prisma.nguoiDung.findUnique({
      where: { id: decoded.userId },
      include: {
        khachHang: { select: { nguoiDungId: true } },
        taiXe: { select: { nguoiDungId: true } },
        quanTriVien: { select: { nguoiDungId: true } },
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedError("Tài khoản không tồn tại hoặc đã bị xóa");
    }

    if (user.trangThai === TrangThaiNguoiDung.TAM_KHOA) {
      throw new ForbiddenError("Tài khoản đang bị tạm khóa. Vui lòng liên hệ quản trị viên.");
    }

    req.user = {
      id: user.id,
      soDienThoai: user.soDienThoai || "",
      email: user.email || undefined,
      hoTen: user.hoTen,
      vaiTro: user.vaiTro,
      trangThai: user.trangThai,
      khachHangId: user.khachHang?.nguoiDungId,
      taiXeId: user.taiXe?.nguoiDungId,
      quanTriVienId: user.quanTriVien?.nguoiDungId,
    };

    next();
  } catch (error) {
    next(error);
  }
};
