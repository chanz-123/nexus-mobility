import React, { useState, useEffect } from "react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { MapView } from "../components/MapView";
import { soundEffects } from "../utils/sound";
import {
  Car,
  Bike,
  Navigation,
  MapPin,
  CheckCircle,
  Play,
  RotateCcw,
  Zap,
  Loader2,
} from "lucide-react";

interface LocationData {
  tenDiaDiem: string;
  diaChiChiTiet: string;
  kinhDo: number;
  viDo: number;
}

const PRESET_PLACES: LocationData[] = [
  { tenDiaDiem: "ĐH Bách Khoa Hà Nội", diaChiChiTiet: "1 Đại Cồ Việt, Hai Bà Trưng", kinhDo: 105.8431, viDo: 21.0056 },
  { tenDiaDiem: "Hồ Hoàn Kiếm", diaChiChiTiet: "Đinh Tiên Hoàng, Hoàn Kiếm", kinhDo: 105.8525, viDo: 21.0285 },
  { tenDiaDiem: "Bến xe Mỹ Đình", diaChiChiTiet: "20 Phạm Hùng, Nam Từ Liêm", kinhDo: 105.7783, viDo: 21.0287 },
  { tenDiaDiem: "Royal City", diaChiChiTiet: "72A Nguyễn Trãi, Thanh Xuân", kinhDo: 105.8156, viDo: 21.0028 },
];

export const SimulationPage: React.FC = () => {
  // --- BÊN KHÁCH HÀNG (CUSTOMER) ---
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [customerSocket, setCustomerSocket] = useState<Socket | null>(null);
  const [pickup, setPickup] = useState<LocationData>(PRESET_PLACES[0]);
  const [dropoff, setDropoff] = useState<LocationData>(PRESET_PLACES[1]);
  const [selectedService, setSelectedService] = useState<"GRAB_BIKE" | "GRAB_CAR_4" | "GRAB_CAR_7">("GRAB_CAR_4");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [customerTrip, setCustomerTrip] = useState<any>(null);
  const [customerStatusMsg, setCustomerStatusMsg] = useState<string | null>(null);

  // --- BÊN TÀI XẾ (DRIVER) ---
  const [driverToken, setDriverToken] = useState<string | null>(null);
  const [driverSocket, setDriverSocket] = useState<Socket | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number }>({ lat: 21.0058, lng: 105.8435 }); // Gần Bách Khoa
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const [driverTrip, setDriverTrip] = useState<any>(null);

  // 1. Tự động khởi tạo phiên cho Khách (Minh) & Tài xế (Nam) độc lập
  useEffect(() => {
    let isMounted = true;

    const setupUsers = async () => {
      try {
        // Đăng nhập Khách hàng Minh
        const resCust = await axios.post("/api/v1/auth/login", {
          soDienThoai: "0901234567",
          matKhau: "Grab@2026",
        });
        const cTok = resCust.data.data.tokens.accessToken;
        if (!isMounted) return;
        setCustomerToken(cTok);

        // Khởi tạo Socket riêng cho Khách
        const cSock = io({
          auth: { token: cTok },
          transports: ["websocket", "polling"],
        });
        setCustomerSocket(cSock);

        // Đăng nhập Tài xế Nam (Ô tô 4 chỗ)
        const resDrv = await axios.post("/api/v1/auth/login", {
          soDienThoai: "0912345678",
          matKhau: "Grab@2026",
        });
        const dTok = resDrv.data.data.tokens.accessToken;
        if (!isMounted) return;
        setDriverToken(dTok);

        // Khởi tạo Socket riêng cho Tài xế
        const dSock = io({
          auth: { token: dTok },
          transports: ["websocket", "polling"],
        });
        setDriverSocket(dSock);

        // Đưa tài xế lên hệ thống Redis GEO
        await axios.post(
          "/api/v1/dispatch/drivers/status",
          {
            trangThai: "SAN_SANG",
            kinhDo: 105.8435,
            viDo: 21.0058,
          },
          { headers: { Authorization: `Bearer ${dTok}` } }
        );
      } catch (err) {
        console.error("Lỗi khởi tạo mô phỏng song song:", err);
      }
    };

    setupUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Lắng nghe sự kiện bên Tài xế (QT-02 nhận cuốc 15s)
  useEffect(() => {
    if (!driverSocket) return;

    // Khi có cuốc xe điều phối đến (hỗ trợ cả dispatch:offer và driver:new_offer)
    const handleOffer = (payload: any) => {
      soundEffects.playNewOfferSound();
      setIncomingOffer(payload);
      setCountdown(payload.countdownSeconds || payload.timeoutSeconds || 15);
    };

    const handleTimeout = () => {
      setIncomingOffer(null);
    };

    const handleOfferCancelled = (payload: any) => {
      setIncomingOffer(null);
      setCustomerStatusMsg(payload?.message || "Khách hàng đã hủy chuyến xe.");
    };

    driverSocket.on("dispatch:offer", handleOffer);
    driverSocket.on("driver:new_offer", handleOffer);
    driverSocket.on("dispatch:timeout", handleTimeout);
    driverSocket.on("dispatch:cancelled", handleOfferCancelled);

    return () => {
      driverSocket.off("dispatch:offer", handleOffer);
      driverSocket.off("driver:new_offer", handleOffer);
      driverSocket.off("dispatch:timeout", handleTimeout);
      driverSocket.off("dispatch:cancelled", handleOfferCancelled);
    };
  }, [driverSocket]);

  // Bộ đếm ngược 15s của Tài xế
  useEffect(() => {
    if (!incomingOffer) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIncomingOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingOffer]);

  // 3. Lắng nghe sự kiện bên Khách hàng (Đồng bộ hành trình)
  useEffect(() => {
    if (!customerSocket || !customerTrip) return;

    customerSocket.emit("trip:join", { tripId: customerTrip.id });

    // Tài xế đã nhận
    const handleAccepted = (p: any) => {
      soundEffects.playAccepted();
      const driverName = p?.taiXe?.hoTen || p?.driver?.nguoiDung?.hoTen || "Lê Hoàng Nam";
      const licensePlate = p?.taiXe?.bienSoXe || p?.driver?.bienSoXe || "29A-886.88";
      setCustomerTrip((prev: any) => ({
        ...prev,
        trangThai: "ACCEPTED",
        taiXe: p?.taiXe || prev?.taiXe,
      }));
      setCustomerStatusMsg(`Tài xế ${driverName} (${licensePlate}) đã nhận cuốc!`);
    };

    // Cập nhật trạng thái tự động
    const handleStatusUpdated = (payload: any) => {
      const status = typeof payload === "string" ? payload : payload.status;
      if (!status) return;

      if (status === "ACCEPTED") {
        setCustomerTrip((prev: any) => ({ ...prev, trangThai: "ACCEPTED" }));
      } else if (status === "ARRIVED") {
        soundEffects.playArrived();
        setCustomerTrip((prev: any) => ({ ...prev, trangThai: "ARRIVED" }));
        setCustomerStatusMsg("Tài xế đã có mặt tại điểm đón!");
      } else if (status === "IN_PROGRESS") {
        setCustomerTrip((prev: any) => ({ ...prev, trangThai: "IN_PROGRESS" }));
        setCustomerStatusMsg("Chuyến xe đang di chuyển đến điểm trả...");
      } else if (status === "COMPLETED") {
        soundEffects.playCompleted();
        setCustomerTrip((prev: any) => ({
          ...prev,
          trangThai: "COMPLETED",
          hoaDon: payload.hoaDon || prev?.hoaDon,
        }));
        setCustomerStatusMsg("Chuyến xe đã hoàn thành thành công!");
      } else if (status === "CANCELLED") {
        setCustomerTrip(null);
        setCustomerStatusMsg(payload?.message || "Chuyến xe đã bị hủy.");
      }
    };

    // Khi chuyến xe bị hủy
    const handleCancelled = (p?: any) => {
      setCustomerTrip(null);
      setCustomerStatusMsg(p?.message || "Chuyến xe đã bị hủy.");
    };

    // Tài xế đã đến
    const handleDriverArrived = () => {
      soundEffects.playArrived();
      setCustomerTrip((prev: any) => ({ ...prev, trangThai: "ARRIVED" }));
      setCustomerStatusMsg("Tài xế đã có mặt tại điểm đón!");
    };

    // Bắt đầu chạy
    const handleTripStarted = () => {
      setCustomerTrip((prev: any) => ({ ...prev, trangThai: "IN_PROGRESS" }));
      setCustomerStatusMsg("Chuyến xe đang di chuyển đến điểm trả...");
    };

    // Hoàn thành
    const handleTripCompleted = (p: any) => {
      soundEffects.playCompleted();
      setCustomerTrip((prev: any) => ({ ...prev, trangThai: "COMPLETED", hoaDon: p?.hoaDon }));
      setCustomerStatusMsg("Chuyến xe đã hoàn thành thành công!");
    };

    // Không có tài xế
    const handleNoDriver = (p?: any) => {
      setCustomerStatusMsg(p?.message || "Hết thời gian 15s: Tài xế không nhận cuốc.");
      setCustomerTrip(null);
    };

    customerSocket.on("trip:driver_assigned", handleAccepted);
    customerSocket.on("trip:accepted", handleAccepted);
    customerSocket.on("trip:status_updated", handleStatusUpdated);
    customerSocket.on("trip:cancelled", handleCancelled);
    customerSocket.on("trip:driver_arrived", handleDriverArrived);
    customerSocket.on("trip:started", handleTripStarted);
    customerSocket.on("trip:completed", handleTripCompleted);
    customerSocket.on("dispatch:no_driver", handleNoDriver);
    customerSocket.on("trip:no_driver", handleNoDriver);

    return () => {
      customerSocket.off("trip:driver_assigned", handleAccepted);
      customerSocket.off("trip:accepted", handleAccepted);
      customerSocket.off("trip:status_updated", handleStatusUpdated);
      customerSocket.off("trip:cancelled", handleCancelled);
      customerSocket.off("trip:driver_arrived", handleDriverArrived);
      customerSocket.off("trip:started", handleTripStarted);
      customerSocket.off("trip:completed", handleTripCompleted);
      customerSocket.off("dispatch:no_driver", handleNoDriver);
      customerSocket.off("trip:no_driver", handleNoDriver);
    };
  }, [customerSocket, customerTrip?.id]);

  // HÀNH ĐỘNG 1: Khách hàng bấm Đặt xe
  const handleCustomerBook = async () => {
    if (!customerToken) return;
    setBookingLoading(true);
    setCustomerStatusMsg("Đang gửi yêu cầu điều phối đến các tài xế gần nhất (QT-02)...");

    try {
      const res = await axios.post(
        "/api/v1/trips",
        {
          diemDon: pickup,
          diemTra: dropoff,
          loaiDichVu: selectedService,
          phuongThucThanhToan: "TIEN_MAT",
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );

      setCustomerTrip(res.data.data.trip);
    } catch (err: any) {
      setCustomerStatusMsg(err.response?.data?.message || "Đặt xe thất bại");
    } finally {
      setBookingLoading(false);
    }
  };

  // HÀNH ĐỘNG 2: Tài xế bấm "Nhận chuyến" trong 15s
  const handleDriverAccept = async () => {
    if (!driverToken || !incomingOffer) return;
    try {
      await axios.post(
        `/api/v1/dispatch/accept`,
        { tripId: incomingOffer.tripId },
        { headers: { Authorization: `Bearer ${driverToken}` } }
      );
      setDriverTrip(incomingOffer);
      setIncomingOffer(null);
      soundEffects.playAccepted();
    } catch (err: any) {
      alert(err.response?.data?.message || "Nhận chuyến thất bại");
    }
  };

  // HÀNH ĐỘNG 3: Tài xế bấm "Đã đến nơi (ARRIVED)"
  const handleDriverArrive = async () => {
    if (!driverToken || !driverTrip) return;
    try {
      await axios.post(
        `/api/v1/trips/${driverTrip.tripId}/arrive`,
        {},
        { headers: { Authorization: `Bearer ${driverToken}` } }
      );
      setDriverTrip((p: any) => ({ ...p, status: "ARRIVED" }));
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi cập nhật");
    }
  };

  // HÀNH ĐỘNG 4: Tài xế bấm "Bắt đầu chuyến (IN_PROGRESS)"
  const handleDriverStart = async () => {
    if (!driverToken || !driverTrip) return;
    try {
      await axios.post(
        `/api/v1/trips/${driverTrip.tripId}/start`,
        {},
        { headers: { Authorization: `Bearer ${driverToken}` } }
      );
      setDriverTrip((p: any) => ({ ...p, status: "IN_PROGRESS" }));
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi cập nhật");
    }
  };

  // HÀNH ĐỘNG 5: Tài xế bấm "Hoàn thành chuyến (COMPLETED)"
  const handleDriverComplete = async () => {
    if (!driverToken || !driverTrip) return;
    try {
      await axios.post(
        `/api/v1/trips/${driverTrip.tripId}/complete`,
        {},
        { headers: { Authorization: `Bearer ${driverToken}` } }
      );
      setDriverTrip(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi cập nhật");
    }
  };

  // Mô phỏng di chuyển GPS của tài xế
  const handleSimulateMove = async () => {
    if (!driverToken) return;
    const newLoc = {
      lat: Number((driverLocation.lat + (Math.random() - 0.5) * 0.002).toFixed(6)),
      lng: Number((driverLocation.lng + (Math.random() - 0.5) * 0.002).toFixed(6)),
    };
    setDriverLocation(newLoc);

    await axios.post(
      "/api/v1/dispatch/drivers/status",
      {
        trangThai: "SAN_SANG",
        viDo: newLoc.lat,
        kinhDo: newLoc.lng,
      },
      { headers: { Authorization: `Bearer ${driverToken}` } }
    );
  };

  return (
    <div className="w-full h-[calc(100vh-80px)] p-4 sm:p-6 flex flex-col gap-4 overflow-hidden bg-slate-900 text-white">
      {/* BANNER GIỚI THIỆU CHẾ ĐỘ MÔ PHỎNG LIÊN KẾT THỰC THỜI */}
      <div className="bg-slate-800/90 border-2 border-emerald-500/50 rounded-2xl px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl font-black">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              Chế độ Mô phỏng Song song: Khách hàng ➔ Điều phối ➔ Tài xế (QT-02)
            </h2>
            <p className="text-xs text-slate-300 font-semibold">
              Hai phân hệ chạy trên 2 WebSocket độc lập trong cùng một màn hình để kiểm định tính liên kết thời gian thực
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setCustomerTrip(null);
            setDriverTrip(null);
            setIncomingOffer(null);
            setCustomerStatusMsg("Đã khởi tạo lại trạng thái.");
          }}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 px-3.5 py-2 rounded-xl text-xs font-black text-slate-200 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Làm mới phiên test
        </button>
      </div>

      {/* KHUNG CHÍNH: 2 CỘT SONG SONG + BẢN ĐỒ Ở GIỮA/DƯỚI */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* CỘT TRÁI (5 PHẦN): MÀN HÌNH KHÁCH HÀNG (MINH) */}
        <div className="lg:col-span-4 bg-white text-slate-900 rounded-3xl p-5 shadow-2xl border-2 border-slate-200 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-100 text-blue-800 rounded-xl font-black text-lg">👤</span>
                <div>
                  <h3 className="font-black text-base text-slate-900">Màn hình Khách hàng</h3>
                  <span className="text-xs font-bold text-slate-500">Nguyễn Văn Minh (0901234567)</span>
                </div>
              </div>
              <span className="text-[11px] font-black bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                KHACH_HANG
              </span>
            </div>

            {/* Chọn Điểm Đón & Đến */}
            <div>
              <label className="text-xs font-black text-slate-700 block mb-1">Điểm đón:</label>
              <select
                value={pickup.tenDiaDiem}
                onChange={(e) => {
                  const p = PRESET_PLACES.find((x) => x.tenDiaDiem === e.target.value);
                  if (p) setPickup(p);
                }}
                disabled={!!customerTrip}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold cursor-pointer"
              >
                {PRESET_PLACES.map((p) => (
                  <option key={p.tenDiaDiem} value={p.tenDiaDiem}>
                    {p.tenDiaDiem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 block mb-1">Điểm đến:</label>
              <select
                value={dropoff.tenDiaDiem}
                onChange={(e) => {
                  const p = PRESET_PLACES.find((x) => x.tenDiaDiem === e.target.value);
                  if (p) setDropoff(p);
                }}
                disabled={!!customerTrip}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold cursor-pointer"
              >
                {PRESET_PLACES.map((p) => (
                  <option key={p.tenDiaDiem} value={p.tenDiaDiem}>
                    {p.tenDiaDiem}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn Loại xe */}
            <div>
              <label className="text-xs font-black text-slate-700 block mb-1">Phương tiện:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedService("GRAB_BIKE")}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    selectedService === "GRAB_BIKE"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-black"
                      : "border-slate-200 text-slate-600 font-bold"
                  }`}
                >
                  <Bike className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs block">Bike</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedService("GRAB_CAR_4")}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    selectedService === "GRAB_CAR_4"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-black"
                      : "border-slate-200 text-slate-600 font-bold"
                  }`}
                >
                  <Car className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs block">Car 4c</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedService("GRAB_CAR_7")}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    selectedService === "GRAB_CAR_7"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-black"
                      : "border-slate-200 text-slate-600 font-bold"
                  }`}
                >
                  <Car className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs block">Car 7c</span>
                </button>
              </div>
            </div>

            {/* Thông báo trạng thái Khách hàng */}
            {customerStatusMsg && (
              <div className="p-3 bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl text-xs font-bold">
                {customerStatusMsg}
              </div>
            )}
          </div>

          {/* Nút Đặt xe */}
          <div className="pt-3 border-t-2 border-slate-100">
            {!customerTrip ? (
              <button
                onClick={handleCustomerBook}
                disabled={bookingLoading}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                {bookingLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang điều phối...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-5 h-5" />
                    <span>Bấm để Đặt xe ngay ➔</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 bg-emerald-100 border-2 border-emerald-300 rounded-xl text-xs text-emerald-900 font-black flex items-center justify-between">
                <span>Trạng thái: {customerTrip.trangThai}</span>
                <span className="text-emerald-700 font-black">
                  {Number(customerTrip.soTienCuoiCung).toLocaleString("vi-VN")}đ
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CỘT GIỮA (4 PHẦN): BẢN ĐỒ LỘ TRÌNH ĐƯỜNG PHỐ OSRM */}
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-2xl border-2 border-slate-700 overflow-hidden relative h-full">
          <MapView
            pickup={{ lat: pickup.viDo, lng: pickup.kinhDo }}
            dropoff={{ lat: dropoff.viDo, lng: dropoff.kinhDo }}
            driverLocation={driverLocation}
          />
        </div>

        {/* CỘT PHẢI (4 PHẦN): MÀN HÌNH TÀI XẾ (LÊ HOÀNG NAM) */}
        <div className="lg:col-span-4 bg-slate-950 text-white rounded-3xl p-5 shadow-2xl border-2 border-slate-800 flex flex-col justify-between overflow-y-auto relative">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl font-black text-lg">🚖</span>
                <div>
                  <h3 className="font-black text-base text-white">Màn hình Tài xế</h3>
                  <span className="text-xs font-bold text-slate-400">Lê Hoàng Nam (Ô tô 4 chỗ)</span>
                </div>
              </div>
              <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
                ONLINE (SẴN SÀNG)
              </span>
            </div>

            {/* GPS Simulator */}
            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 block">Vị trí GPS Redis GEO:</span>
                <span className="text-xs font-mono text-emerald-400 font-black">
                  {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSimulateMove}
                className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 cursor-pointer"
              >
                🚴 Di chuyển xe
              </button>
            </div>

            {/* HỘP THOẠI MỜI NHẬN CHUYẾN 15 GIÂY (QT-02) */}
            {incomingOffer ? (
              <div className="p-4 bg-emerald-950/80 border-2 border-emerald-500 rounded-2xl animate-shake space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                    🔔 Có cuốc xe mới độc quyền!
                  </span>
                  <span className="text-sm font-black text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-600 animate-pulse">
                    ⏱ {countdown}s
                  </span>
                </div>

                <div className="text-center py-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Cước thu nhập:</span>
                  <span className="text-2xl font-black text-emerald-400">
                    {Number(incomingOffer.soTienCuoiCung).toLocaleString("vi-VN")}đ
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {incomingOffer.quangDuongKm} km ~ {incomingOffer.thoiGianDuKienPhut} phút
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIncomingOffer(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    onClick={handleDriverAccept}
                    className="flex-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-3 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Nhận cuốc ({countdown}s)
                  </button>
                </div>
              </div>
            ) : driverTrip ? (
              /* Tiến trình sau khi tài xế đã nhận */
              <div className="space-y-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Trạng thái:</span>
                  <span className="font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800">
                    {driverTrip.status || "ACCEPTED"}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  {(!driverTrip.status || driverTrip.status === "ACCEPTED") && (
                    <button
                      onClick={handleDriverArrive}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <MapPin className="w-4 h-4" />
                      Bước 1: Tôi đã đến điểm đón (ARRIVED)
                    </button>
                  )}

                  {driverTrip.status === "ARRIVED" && (
                    <button
                      onClick={handleDriverStart}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Play className="w-4 h-4" />
                      Bước 2: Khách lên xe, Bắt đầu chạy (IN_PROGRESS)
                    </button>
                  )}

                  {driverTrip.status === "IN_PROGRESS" && (
                    <button
                      onClick={handleDriverComplete}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Bước 3: Đến nơi, Hoàn thành chuyến (COMPLETED)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                <span>Đang trực tuyến chờ cuốc từ Khách hàng...</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t-2 border-slate-800 text-[11px] text-slate-400 text-center font-bold">
            💡 Khi bấm "Đặt xe" ở cột trái, chuông cuốc xe sẽ nảy lên ở cột phải này!
          </div>
        </div>
      </div>
    </div>
  );
};
