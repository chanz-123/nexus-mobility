import { LoaiDichVu } from "@prisma/client";

export interface ServiceTariff {
  basePrice: number;       // Giá mở cửa (cho 2km đầu tiên)
  baseDistanceKm: number;  // Cự ly mở cửa (2km)
  pricePerKm: number;      // Đơn giá mỗi km tiếp theo
}

/**
 * Biểu giá chuẩn cho từng loại dịch vụ (khớp quy tắc QT-01)
 */
export const SERVICE_TARIFFS: Record<LoaiDichVu, ServiceTariff> = {
  [LoaiDichVu.GRAB_BIKE]: {
    basePrice: 13800,
    baseDistanceKm: 2.0,
    pricePerKm: 4800,
  },
  [LoaiDichVu.GRAB_CAR_4]: {
    basePrice: 29000,
    baseDistanceKm: 2.0,
    pricePerKm: 10500,
  },
  [LoaiDichVu.GRAB_CAR_7]: {
    basePrice: 34000,
    baseDistanceKm: 2.0,
    pricePerKm: 13000,
  },
};

export const CANCELLATION_PENALTY_FEE = 10000; // VNĐ (Quy tắc QT-05)
