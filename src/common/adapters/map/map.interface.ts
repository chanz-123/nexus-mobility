export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteWaypoint {
  orderIndex: number;
  latitude: number;
  longitude: number;
  estimatedArrivalSeconds: number;
}

export interface RouteCalculationResult {
  distanceKm: number;
  durationMinutes: number;
  waypoints: RouteWaypoint[];
  provider: string;
  calculatedAt: Date;
}

export interface IMapService {
  /**
   * Tính toán cự ly, thời gian di chuyển và các mốc lộ trình giữa 2 điểm GPS.
   * Phải đảm bảo thời gian phản hồi dưới 2 giây (Quy tắc QT-01).
   */
  calculateRoute(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<RouteCalculationResult>;
}
