import { IMapService, Coordinates, RouteCalculationResult, RouteWaypoint } from "./map.interface";
import { logger } from "../../utils/logger";

export class HaversineMapAdapter implements IMapService {
  private static readonly EARTH_RADIUS_KM = 6371.0;
  // Hệ số uốn lượn đường phố nội đô (Manhattan/Road network tortuosity factor)
  private static readonly ROAD_NETWORK_FACTOR = 1.35;
  // Vận tốc trung bình nội đô (km/h) bao gồm dừng đèn đỏ
  private static readonly AVERAGE_CITY_SPEED_KMH = 25.0;

  public async calculateRoute(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<RouteCalculationResult> {
    const startTime = Date.now();

    const dLat = this.toRadians(destination.latitude - origin.latitude);
    const dLon = this.toRadians(destination.longitude - origin.longitude);

    const lat1 = this.toRadians(origin.latitude);
    const lat2 = this.toRadians(destination.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDistanceKm = HaversineMapAdapter.EARTH_RADIUS_KM * c;

    // Khoảng cách thực tế theo mạng lưới giao thông đường bộ
    const roadDistanceKm = Number((straightDistanceKm * HaversineMapAdapter.ROAD_NETWORK_FACTOR).toFixed(2));
    
    // Đảm bảo tối thiểu 0.5 km
    const finalDistanceKm = Math.max(0.5, roadDistanceKm);

    // Thời gian di chuyển ước tính (phút) = (quãng đường / vận tốc) * 60 + 2 phút chuẩn bị
    const durationMinutes = Math.max(3, Math.ceil((finalDistanceKm / HaversineMapAdapter.AVERAGE_CITY_SPEED_KMH) * 60 + 2));

    // Sinh các mốc lộ trình dự kiến (waypoints) cho bảng LichTrinh
    const waypoints = this.generateWaypoints(origin, destination, durationMinutes);

    const calculationTimeMs = Date.now() - startTime;
    logger.debug(
      { distanceKm: finalDistanceKm, durationMinutes, calculationTimeMs },
      `[MAP ADAPTER] Tính toán lộ trình thành công trong ${calculationTimeMs}ms`
    );

    return {
      distanceKm: finalDistanceKm,
      durationMinutes,
      waypoints,
      provider: "Internal-Haversine-Routing-v1",
      calculatedAt: new Date(),
    };
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private generateWaypoints(
    origin: Coordinates,
    destination: Coordinates,
    totalDurationMinutes: number
  ): RouteWaypoint[] {
    const steps = 3; // Điểm đón, điểm giữa hành trình, điểm trả
    const waypoints: RouteWaypoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const lat = origin.latitude + (destination.latitude - origin.latitude) * ratio;
      const lon = origin.longitude + (destination.longitude - origin.longitude) * ratio;
      const arrivalSeconds = Math.round((totalDurationMinutes * 60 * ratio));

      waypoints.push({
        orderIndex: i + 1,
        latitude: Number(lat.toFixed(7)),
        longitude: Number(lon.toFixed(7)),
        estimatedArrivalSeconds: arrivalSeconds,
      });
    }

    return waypoints;
  }
}
