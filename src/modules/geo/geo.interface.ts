import { LoaiDichVu } from "@prisma/client";

export interface NearbyDriver {
  taiXeId: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

export interface IGeoService {
  /**
   * Cập nhật vị trí tọa độ GPS thời gian thực của tài xế (Redis GEOADD)
   */
  updateDriverLocation(taiXeId: string, latitude: number, longitude: number): Promise<void>;

  /**
   * Tìm danh sách các tài xế trong bán kính `radiusKm` (Redis GEOSEARCH / GEORADIUS)
   * Kết quả sắp xếp từ gần nhất đến xa nhất (ASC).
   */
  findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    loaiDichVu?: LoaiDichVu
  ): Promise<NearbyDriver[]>;

  /**
   * Lấy vị trí gần nhất của một tài xế
   */
  getDriverLocation(taiXeId: string): Promise<{ latitude: number; longitude: number } | null>;

  /**
   * Xóa tài xế khỏi danh sách khả dụng
   */
  removeDriverLocation(taiXeId: string): Promise<void>;
}
