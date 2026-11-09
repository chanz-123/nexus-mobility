import { VaiTro, TrangThaiNguoiDung } from "@prisma/client";

export interface AuthUser {
  id: string;
  soDienThoai?: string | null;
  email?: string | null;
  hoTen: string;
  vaiTro: VaiTro;
  trangThai: TrangThaiNguoiDung;
  khachHangId?: string;
  taiXeId?: string;
  quanTriVienId?: string;
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface TokenPayload {
  userId: string;
  soDienThoai?: string | null;
  email?: string | null;
  vaiTro: VaiTro;
  tokenType: "ACCESS" | "REFRESH";
}
