import { z } from "zod";
import { LoaiDichVu, PhuongThucThanhToan } from "@prisma/client";

const LocationSchema = z.object({
  tenDiaDiem: z.string().min(1, "Tên địa điểm không được để trống").max(150),
  diaChiChiTiet: z.string().min(1, "Địa chỉ chi tiết không được để trống").max(255),
  kinhDo: z.number().min(-180).max(180),
  viDo: z.number().min(-90).max(90),
});

export const EstimateFareSchema = z.object({
  diemDon: LocationSchema,
  diemTra: LocationSchema,
  maVoucher: z.string().max(30).optional(),
});

export const CreateTripSchema = z.object({
  diemDon: LocationSchema,
  diemTra: LocationSchema,
  loaiDichVu: z.nativeEnum(LoaiDichVu, {
    required_error: "Loại dịch vụ là bắt buộc (GRAB_BIKE, GRAB_CAR_4, GRAB_CAR_7)",
  }),
  phuongThucThanhToan: z.nativeEnum(PhuongThucThanhToan, {
    required_error: "Phương thức thanh toán là bắt buộc (TIEN_MAT, VI_DIEN_TU, THE_NGAN_HANG)",
  }),
  maVoucher: z.string().max(30).optional(),
});

export type EstimateFareDto = z.infer<typeof EstimateFareSchema>;
export type CreateTripDto = z.infer<typeof CreateTripSchema>;
