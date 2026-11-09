import { IMapService } from "./map.interface";
import { HaversineMapAdapter } from "./haversine-map.adapter";

export class MapAdapterFactory {
  private static instance: IMapService;

  public static getMapService(): IMapService {
    if (!this.instance) {
      // Có thể cấu hình nhà cung cấp qua biến môi trường MAP_PROVIDER
      this.instance = new HaversineMapAdapter();
    }
    return this.instance;
  }
}
