import { LoaiDichVu, TrangThaiChuyenXe } from "@prisma/client";

export interface DriverOfferPayload {
  tripId: string;
  loaiDichVu: LoaiDichVu;
  quangDuongKm: number;
  thoiGianDuKienPhut: number;
  soTienCuoiCung: number;
  diemDon: {
    tenDiaDiem: string;
    diaChiChiTiet: string;
    kinhDo: number;
    viDo: number;
  };
  diemTra: {
    tenDiaDiem: string;
    diaChiChiTiet: string;
    kinhDo: number;
    viDo: number;
  };
  distanceToPickupKm: number;
  countdownSeconds: number; // 15s (QT-02)
  expiresAt: string;
}

export interface DriverAssignedPayload {
  tripId: string;
  taiXe: {
    id: string;
    hoTen: string;
    soDienThoaiMasked: string;
    bienSoXe: string;
    diemDanhGia: number;
    loaiDichVu: LoaiDichVu;
    currentLocation: {
      latitude: number;
      longitude: number;
    };
  };
  thoiGianNhan: string;
}

export interface DriverLocationPayload {
  taiXeId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp: string;
}

export interface ServerToClientEvents {
  "dispatch:offer": (offer: DriverOfferPayload) => void;
  "dispatch:timeout": (payload: { tripId: string; message: string }) => void;
  "dispatch:no_driver": (payload: { tripId: string; message: string }) => void;
  "trip:driver_assigned": (payload: DriverAssignedPayload) => void;
  "trip:driver_location": (payload: DriverLocationPayload) => void;
  "trip:status_updated": (payload: { tripId: string; status: TrangThaiChuyenXe; timestamp: string }) => void;
}

export interface ClientToServerEvents {
  "driver:update_location": (data: { latitude: number; longitude: number; heading?: number }) => void;
  "driver:accept_trip": (data: { tripId: string }) => void;
  "driver:reject_trip": (data: { tripId: string; reason?: string }) => void;
  "trip:join": (data: { tripId: string }) => void;
}
