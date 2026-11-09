import Redis from "ioredis";
import { IGeoService, NearbyDriver } from "./geo.interface";
import { LoaiDichVu } from "@prisma/client";
import { logger } from "../../common/utils/logger";
import { env } from "../../config/env";

export class RedisGeoService implements IGeoService {
  private redis: Redis | null = null;
  private isConnected = false;
  private static readonly GEO_KEY = "drivers:geo:locations";

  // In-memory fallback map: taiXeId -> { latitude, longitude, updatedAt }
  private memoryGeoStore = new Map<string, { latitude: number; longitude: number; updatedAt: number }>();

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    try {
      this.redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            // Ngừng thử lại sau 3 lần và chuyển sang dùng In-memory Spatial Index
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.redis.connect().then(() => {
        this.isConnected = true;
        logger.info("[REDIS GEO] Đã kết nối Redis 7 thành công. Sử dụng Redis GEO cho tọa độ tài xế.");
      }).catch((err) => {
        this.isConnected = false;
        logger.warn(
          { message: err.message },
          "[REDIS GEO] Không thể kết nối Redis server. Chuyển sang cơ chế In-Memory Spatial Fallback (vẫn hoạt động trơn tru 100%)."
        );
      });

      this.redis.on("error", (err) => {
        if (this.isConnected) {
          logger.warn({ error: err.message }, "[REDIS GEO] Redis connection lost, using memory fallback");
          this.isConnected = false;
        }
      });
    } catch (err) {
      this.isConnected = false;
      logger.warn({ err }, "[REDIS GEO] Redis init fallback to memory");
    }
  }

  public async updateDriverLocation(taiXeId: string, latitude: number, longitude: number): Promise<void> {
    // 1. Luôn cập nhật bộ nhớ đệm In-memory
    this.memoryGeoStore.set(taiXeId, { latitude, longitude, updatedAt: Date.now() });

    // 2. Nếu Redis kết nối, ghi vào Redis GEO
    if (this.isConnected && this.redis) {
      try {
        await this.redis.geoadd(RedisGeoService.GEO_KEY, longitude, latitude, taiXeId);
      } catch (err) {
        logger.error({ err }, "Lỗi khi gọi Redis GEOADD");
      }
    }
  }

  public async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _loaiDichVu?: LoaiDichVu
  ): Promise<NearbyDriver[]> {
    // Nếu Redis khả dụng, sử dụng GEOSEARCH của Redis 7
    if (this.isConnected && this.redis) {
      try {
        // Redis GEOSEARCH: trả về [member, distance, [lon, lat]]
        const rawResults = (await this.redis.call(
          "GEOSEARCH",
          RedisGeoService.GEO_KEY,
          "FROMLONLAT",
          longitude,
          latitude,
          "BYRADIUS",
          radiusKm,
          "KM",
          "WITHDIST",
          "WITHCOORD",
          "ASC"
        )) as Array<[string, string, [string, string]]>;

        if (Array.isArray(rawResults)) {
          return rawResults.map(([taiXeId, distStr, [lonStr, latStr]]) => ({
            taiXeId,
            distanceKm: Number(parseFloat(distStr).toFixed(2)),
            longitude: parseFloat(lonStr),
            latitude: parseFloat(latStr),
          }));
        }
      } catch (err) {
        logger.error({ err }, "Lỗi Redis GEOSEARCH, chuyển sang In-memory Spatial Search");
      }
    }

    // In-memory Spatial Haversine Search fallback
    return this.searchInMemory(latitude, longitude, radiusKm);
  }

  public async getDriverLocation(taiXeId: string): Promise<{ latitude: number; longitude: number } | null> {
    const memory = this.memoryGeoStore.get(taiXeId);
    if (memory) {
      return { latitude: memory.latitude, longitude: memory.longitude };
    }

    if (this.isConnected && this.redis) {
      try {
        const pos = await this.redis.geopos(RedisGeoService.GEO_KEY, taiXeId);
        if (pos && pos[0]) {
          const [lon, lat] = pos[0];
          return { longitude: parseFloat(lon), latitude: parseFloat(lat) };
        }
      } catch (err) {
        logger.error({ err }, "Lỗi Redis GEOPOS");
      }
    }

    return null;
  }

  public async removeDriverLocation(taiXeId: string): Promise<void> {
    this.memoryGeoStore.delete(taiXeId);
    if (this.isConnected && this.redis) {
      try {
        await this.redis.zrem(RedisGeoService.GEO_KEY, taiXeId);
      } catch (err) {
        logger.error({ err }, "Lỗi Redis ZREM");
      }
    }
  }

  private searchInMemory(lat: number, lon: number, radiusKm: number): NearbyDriver[] {
    const results: NearbyDriver[] = [];
    const earthRadiusKm = 6371.0;

    for (const [taiXeId, loc] of this.memoryGeoStore.entries()) {
      const dLat = ((loc.latitude - lat) * Math.PI) / 180;
      const dLon = ((loc.longitude - lon) * Math.PI) / 180;
      const lat1 = (lat * Math.PI) / 180;
      const lat2 = (loc.latitude * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = earthRadiusKm * c;

      if (dist <= radiusKm) {
        results.push({
          taiXeId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          distanceKm: Number(dist.toFixed(2)),
        });
      }
    }

    // Sắp xếp tăng dần theo khoảng cách
    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }
}

export const geoService = new RedisGeoService();
