import { z } from "zod";
import { VaiTro, LoaiDichVu } from "@prisma/client";
import { PhoneUtil } from "../../../common/utils/phone.util";
import { EmailUtil } from "../../../common/utils/email.util";

/**
 * Kiểm tra xem chuỗi đầu vào là email hợp lệ hoặc số điện thoại VN hợp lệ
 */
const validateIdentifier = (val: string): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.includes("@") || /[a-zA-Z]/.test(trimmed)) {
    return EmailUtil.isValid(trimmed);
  }
  return PhoneUtil.isValid(trimmed);
};

export const SendOtpSchema = z
  .object({
    taiKhoan: z.string().optional(),
    soDienThoai: z.string().optional(),
    email: z.string().optional(),
  })
  .refine(
    (data) => {
      const target = data.taiKhoan || data.email || data.soDienThoai;
      return target ? validateIdentifier(target) : false;
    },
    {
      message: "Vui lòng nhập Email hợp lệ (VD: user@gmail.com) hoặc Số điện thoại Việt Nam (VD: 0901234567)",
      path: ["taiKhoan"],
    }
  )
  .transform((data) => {
    const raw = (data.taiKhoan || data.email || data.soDienThoai)!.trim();
    return {
      identifier: raw.includes("@") ? EmailUtil.normalize(raw) : PhoneUtil.normalize(raw),
      isEmail: raw.includes("@"),
    };
  });

export const VerifyOtpSchema = z
  .object({
    taiKhoan: z.string().optional(),
    soDienThoai: z.string().optional(),
    email: z.string().optional(),
    otpCode: z.string({ required_error: "Mã OTP là bắt buộc" }).length(6, "Mã OTP gồm đúng 6 chữ số"),
  })
  .refine(
    (data) => {
      const target = data.taiKhoan || data.email || data.soDienThoai;
      return target ? validateIdentifier(target) : false;
    },
    {
      message: "Tài khoản nhận OTP phải là Email hoặc Số điện thoại hợp lệ",
      path: ["taiKhoan"],
    }
  )
  .transform((data) => {
    const raw = (data.taiKhoan || data.email || data.soDienThoai)!.trim();
    return {
      identifier: raw.includes("@") ? EmailUtil.normalize(raw) : PhoneUtil.normalize(raw),
      otpCode: data.otpCode.trim(),
    };
  });

export const RegisterSchema = z
  .object({
    taiKhoan: z.string().optional(),
    soDienThoai: z.string().optional(),
    email: z.string().optional(),
    hoTen: z
      .string({ required_error: "Họ tên là bắt buộc" })
      .min(2, "Họ tên tối thiểu 2 ký tự")
      .max(120, "Họ tên tối đa 120 ký tự"),
    matKhau: z
      .string({ required_error: "Mật khẩu là bắt buộc" })
      .min(6, "Mật khẩu tối thiểu 6 ký tự"),
    vaiTro: z.nativeEnum(VaiTro, {
      required_error: "Vai trò người dùng là bắt buộc",
    }),
    otpCode: z.string().length(6, "Mã OTP gồm 6 chữ số").optional(),

    // Dành riêng cho Tài xế
    soGiayPhepLaiXe: z.string().min(8, "Số GPLX tối thiểu 8 ký tự").max(20).optional(),
    bienSoXe: z.string().min(6, "Biển số xe tối thiểu 6 ký tự").max(20).optional(),
    loaiDichVu: z.nativeEnum(LoaiDichVu).optional(),

    // Dành riêng cho Quản trị viên
    phongBan: z.string().max(80).optional(),
    chucVu: z.string().max(80).optional(),
  })
  .refine(
    (data) => {
      const hasPhone = data.soDienThoai && PhoneUtil.isValid(data.soDienThoai);
      const hasEmail = data.email && EmailUtil.isValid(data.email);
      const hasTaiKhoan = data.taiKhoan && validateIdentifier(data.taiKhoan);
      return Boolean(hasPhone || hasEmail || hasTaiKhoan);
    },
    {
      message: "Vui lòng nhập Số điện thoại hoặc Email hợp lệ để đăng ký",
      path: ["taiKhoan"],
    }
  )
  .refine(
    (data) => {
      if (data.vaiTro === VaiTro.TAI_XE) {
        return !!data.soGiayPhepLaiXe && !!data.bienSoXe && !!data.loaiDichVu;
      }
      return true;
    },
    {
      message:
        "Tài xế bắt buộc cung cấp: Số GPLX (soGiayPhepLaiXe), Biển số xe (bienSoXe) và Loại dịch vụ (loaiDichVu)",
      path: ["soGiayPhepLaiXe"],
    }
  )
  .transform((data) => {
    let email: string | undefined = data.email ? EmailUtil.normalize(data.email) : undefined;
    let soDienThoai: string | undefined = data.soDienThoai ? PhoneUtil.normalize(data.soDienThoai) : undefined;
    let otpIdentifier: string | undefined = undefined;

    if (data.taiKhoan) {
      const trimmed = data.taiKhoan.trim();
      const isEmail = trimmed.includes("@") || /[a-zA-Z]/.test(trimmed);
      if (isEmail) {
        if (!email) email = EmailUtil.normalize(trimmed);
        otpIdentifier = EmailUtil.normalize(trimmed);
      } else {
        if (!soDienThoai) soDienThoai = PhoneUtil.normalize(trimmed);
        otpIdentifier = PhoneUtil.normalize(trimmed);
      }
    }

    return {
      ...data,
      email,
      soDienThoai,
      otpIdentifier: otpIdentifier || email || soDienThoai,
    };
  });

export const LoginSchema = z
  .object({
    taiKhoan: z.string().optional(),
    soDienThoai: z.string().optional(),
    email: z.string().optional(),
    matKhau: z
      .string({ required_error: "Mật khẩu là bắt buộc" })
      .min(6, "Mật khẩu tối thiểu 6 ký tự"),
  })
  .refine(
    (data) => {
      const target = data.taiKhoan || data.email || data.soDienThoai;
      return target ? validateIdentifier(target) : false;
    },
    {
      message: "Vui lòng nhập Email hoặc Số điện thoại hợp lệ để đăng nhập",
      path: ["taiKhoan"],
    }
  )
  .transform((data) => {
    const raw = (data.taiKhoan || data.email || data.soDienThoai)!.trim();
    return {
      identifier: raw.includes("@") ? EmailUtil.normalize(raw) : PhoneUtil.normalize(raw),
      isEmail: raw.includes("@"),
      matKhau: data.matKhau,
    };
  });

export const LoginOtpSchema = z
  .object({
    taiKhoan: z.string().optional(),
    soDienThoai: z.string().optional(),
    email: z.string().optional(),
    otpCode: z.string({ required_error: "Mã OTP là bắt buộc" }).length(6, "Mã OTP gồm đúng 6 chữ số"),
  })
  .refine(
    (data) => {
      const target = data.taiKhoan || data.email || data.soDienThoai;
      return target ? validateIdentifier(target) : false;
    },
    {
      message: "Vui lòng nhập Email hoặc Số điện thoại hợp lệ để xác thực OTP",
      path: ["taiKhoan"],
    }
  )
  .transform((data) => {
    const raw = (data.taiKhoan || data.email || data.soDienThoai)!.trim();
    return {
      identifier: raw.includes("@") ? EmailUtil.normalize(raw) : PhoneUtil.normalize(raw),
      isEmail: raw.includes("@"),
      otpCode: data.otpCode.trim(),
    };
  });

export const RefreshTokenSchema = z.object({
  refreshToken: z.string({ required_error: "Refresh token là bắt buộc" }).min(1),
});

export type SendOtpDto = z.infer<typeof SendOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type LoginOtpDto = z.infer<typeof LoginOtpSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
