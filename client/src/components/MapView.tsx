import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Navigation } from "lucide-react";

interface Coordinates {
  lat: number;
  lng: number;
}

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  pickup?: Coordinates | null;
  dropoff?: Coordinates | null;
  driverLocation?: Coordinates | null;
  waypoints?: Waypoint[] | null;
  onMapClick?: (coords: Coordinates) => void;
  interactive?: boolean;
}

// 1. Icon Điểm đón khách (Pickup Marker)
const createPickupIcon = () =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 44px; height: 44px; background: rgba(0, 177, 79, 0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 32px; height: 32px; background: #00B14F; border: 3.5px solid #ffffff; border-radius: 50%; box-shadow: 0 6px 18px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 2;">
          <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
        </div>
        <div style="position: absolute; top: -22px; background: #0F172A; color: #FFFFFF; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1px solid #334155;">
          ĐIỂM ĐÓN
        </div>
      </div>
    `,
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

// 2. Icon Điểm đến (Dropoff Marker)
const createDropoffIcon = () =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 44px; height: 44px; background: rgba(225, 29, 72, 0.25); border-radius: 50%;"></div>
        <div style="width: 32px; height: 32px; background: #E11D48; border: 3.5px solid #ffffff; border-radius: 50%; box-shadow: 0 6px 18px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: 900; z-index: 2;">
          ★
        </div>
        <div style="position: absolute; top: -22px; background: #E11D48; color: #FFFFFF; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1px solid #fda4af;">
          ĐIỂM ĐẾN
        </div>
      </div>
    `,
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

// 3. Icon Xe tài xế (Driver GPS Marker)
const createDriverIcon = () =>
  L.divIcon({
    html: `
      <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 48px; height: 48px; background: rgba(16, 185, 129, 0.3); border-radius: 50%;"></div>
        <div style="width: 38px; height: 38px; background: #0F172A; border: 3.5px solid #10B981; border-radius: 50%; box-shadow: 0 8px 20px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; font-size: 20px; z-index: 2;">
          🚕
        </div>
        <div style="position: absolute; bottom: -18px; background: #064E3B; color: #34D399; font-size: 10px; font-weight: 900; padding: 1px 6px; border-radius: 4px; white-space: nowrap; border: 1px solid #059669;">
          TÀI XẾ
        </div>
      </div>
    `,
    className: "",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

export const MapView: React.FC<MapViewProps> = ({
  pickup,
  dropoff,
  driverLocation,
  onMapClick,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // 1. Khởi tạo bản đồ Leaflet an toàn
  useEffect(() => {
    if (!containerRef.current) return;

    // Dọn sạch id container nếu bị dính từ render trước
    if ((containerRef.current as any)._leaflet_id) {
      try {
        delete (containerRef.current as any)._leaflet_id;
      } catch (e) {}
    }

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {}
      mapRef.current = null;
    }

    let mapInstance: L.Map | null = null;
    try {
      mapInstance = L.map(containerRef.current, {
        center: [21.0285, 105.8525], // Trung tâm Hà Nội
        zoom: 13,
        zoomControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
      });

      // Bản đồ số đường phố vệ tinh Esri ArcGIS - Độ ổn định cao, không yêu cầu API key, không bị chặn
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            'Bản đồ &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, USGS, TomTom',
          maxZoom: 19,
        }
      ).addTo(mapInstance);

      if (interactive) {
        L.control.zoom({ position: "bottomright" }).addTo(mapInstance);
      }

      if (onMapClick) {
        mapInstance.on("click", (e) => {
          onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      // Tạo một LayerGroup chung gắn vào Map
      const layerGroup = L.layerGroup().addTo(mapInstance);
      layerGroupRef.current = layerGroup;
      mapRef.current = mapInstance;
    } catch (err) {
      console.warn("Lỗi khởi tạo bản đồ:", err);
    }

    const t1 = setTimeout(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch (e) {}
    }, 150);

    const t2 = setTimeout(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch (e) {}
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (layerGroupRef.current) {
        try {
          layerGroupRef.current.clearLayers();
        } catch (e) {}
        layerGroupRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
      if (containerRef.current) {
        try {
          delete (containerRef.current as any)._leaflet_id;
        } catch (e) {}
      }
    };
  }, []);

  // 2. Cập nhật Markers & Lộ trình di chuyển
  useEffect(() => {
    const map = mapRef.current;
    const lg = layerGroupRef.current;
    if (!map || !lg) return;

    let isCancelled = false;

    try {
      // Dọn sạch các layer cũ trên LayerGroup của map này
      lg.clearLayers();

      // 1. Marker Điểm đón
      if (pickup && typeof pickup.lat === "number" && typeof pickup.lng === "number") {
        L.marker([pickup.lat, pickup.lng], {
          icon: createPickupIcon(),
          zIndexOffset: 1000,
        }).addTo(lg);
      }

      // 2. Marker Điểm đến
      if (dropoff && typeof dropoff.lat === "number" && typeof dropoff.lng === "number") {
        L.marker([dropoff.lat, dropoff.lng], {
          icon: createDropoffIcon(),
          zIndexOffset: 1000,
        }).addTo(lg);
      }

      // 3. Marker Tài xế
      if (driverLocation && typeof driverLocation.lat === "number" && typeof driverLocation.lng === "number") {
        L.marker([driverLocation.lat, driverLocation.lng], {
          icon: createDriverIcon(),
          zIndexOffset: 2000,
        }).addTo(lg);
      }

      // 4. Lộ trình OSRM Driving Engine
      if (pickup && dropoff) {
        const drawPath = (points: [number, number][]) => {
          if (isCancelled || !mapRef.current || !layerGroupRef.current) return;
          const currentMap = mapRef.current;
          const currentLg = layerGroupRef.current;

          try {
            // Viền đường màu xanh đậm
            L.polyline(points, {
              color: "#064E3B",
              weight: 9,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(currentLg);

            // Lòng đường màu xanh lá Grab
            L.polyline(points, {
              color: "#00B14F",
              weight: 5,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(currentLg);

            // Căn chỉnh bounds an toàn (chỉ khi container đã có kích thước hiển thị)
            const size = currentMap.getSize();
            if (size.x > 80 && size.y > 80 && points.length > 0) {
              const bounds = L.latLngBounds(points);
              if (bounds.isValid()) {
                currentMap.fitBounds(bounds, {
                  padding: [40, 40],
                  maxZoom: 16,
                  animate: false,
                });
              }
            }
          } catch (err) {
            console.warn("Lỗi vẽ đường lộ trình:", err);
          }
        };

        const fetchStreetRoute = async () => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json();
              if (data.routes && data.routes.length > 0 && !isCancelled) {
                const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
                  (c: [number, number]) => [c[1], c[0]]
                );
                const distKm = (data.routes[0].distance / 1000).toFixed(1);
                const durMin = Math.ceil(data.routes[0].duration / 60);
                setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} phút` });
                drawPath(coords);
                return;
              }
            }
          } catch (err) {
            // Bỏ qua lỗi mạng OSRM
          }

          // Dự phòng đường cong tự nhiên
          if (!isCancelled) {
            const midLat = (pickup.lat + dropoff.lat) / 2 + (pickup.lng > dropoff.lng ? 0.003 : -0.003);
            const midLng = (pickup.lng + dropoff.lng) / 2 + (pickup.lat > dropoff.lat ? 0.003 : -0.003);
            const fallbackPoints: [number, number][] = [
              [pickup.lat, pickup.lng],
              [midLat, midLng],
              [dropoff.lat, dropoff.lng],
            ];
            drawPath(fallbackPoints);
          }
        };

        fetchStreetRoute();
      }
    } catch (e) {
      console.warn("Lỗi cập nhật markers:", e);
    }

    return () => {
      isCancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driverLocation?.lat, driverLocation?.lng]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Thông tin lộ trình nổi trên góc bản đồ */}
      {routeInfo && pickup && dropoff && (
        <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-emerald-500 text-white rounded-xl">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Tuyến đường di chuyển
            </span>
            <div className="flex items-center gap-2 font-black text-sm text-white">
              <span>{routeInfo.distance}</span>
              <span>•</span>
              <span className="text-emerald-400">~{routeInfo.duration}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
