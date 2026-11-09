import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/auth.context";
import { useSocket } from "../context/socket.context";
import { MapView } from "../components/MapView";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { soundEffects } from "../utils/sound";
import {
  Car,
  Power,
  MapPin,
  CheckCircle,
  Play,
  Navigation,
  AlertTriangle,
  Star,
  LogIn,
  Loader2,
} from "lucide-react";

export const DriverPage: React.FC = () => {
  const { user, quickLogin, refreshSession } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<string | null>(null);

  // Nếu tab mở /driver mà tài khoản hiện tại không phải Tài xế, tự động kích hoạt phiên Tài xế riêng cho tab này
  useEffect(() => {
    if (user && user.vaiTro !== "TAI_XE") {
      refreshSession("TAI_XE");
    }
  }, [user?.vaiTro, refreshSession]);

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number }>({
    lat: 21.0056,
    lng: 105.8431, // ĐH Bách Khoa Hà Nội
  });

  // Modal chào đơn 15 giây (QT-02)
  const [offer, setOffer] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(15);

  // Chuyến xe đang phục vụ
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [tripStatus, setTripStatus] = useState<string>("NONE");

  // Thống kê tài xế trong ngày (lấy từ dữ liệu chuyến xe thực tế)
  const [todayStats, setTodayStats] = useState({
    completedTrips: 0,
    totalEarnings: 0,
    rating: 5.0,
  });

  // Tải thống kê chuyến đi thực tế của tài xế trong ngày
  useEffect(() => {
    if (user?.vaiTro !== "TAI_XE") return;

    const fetchDriverStats = async () => {
      try {
        const res = await api.get("/trips/history/my-trips");
        const trips: any[] = res.data?.data?.trips || [];
        const todayStr = new Date().toDateString();

        const todayTrips = trips.filter(
          (t) =>
            t.trangThai === "COMPLETED" &&
            new Date(t.thoiGianHoanThanh || t.thoiGianDat).toDateString() === todayStr
        );

        // Khôi phục chuyến xe đang phục vụ nếu tài xế tải lại trang
        const runningTrip = trips.find((t) => ["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(t.trangThai));
        if (runningTrip) {
          try {
            const detailRes = await api.get(`/trips/${runningTrip.id}`);
            const fullTrip = detailRes.data?.data?.trip || runningTrip;
            setActiveTrip(fullTrip);
            setTripStatus(fullTrip.trangThai);
          } catch {
            setActiveTrip(runningTrip);
            setTripStatus(runningTrip.trangThai);
          }
        }

        const totalEarn = todayTrips.reduce((sum, t) => sum + Number(t.soTienCuoiCung || 0), 0);
        const ratingVal = user.profile?.diemDanhGia ? Number(user.profile.diemDanhGia) : 5.0;

        setTodayStats({
          completedTrips: todayTrips.length,
          totalEarnings: totalEarn,
          rating: ratingVal,
        });
      } catch (err) {
        const ratingVal = user.profile?.diemDanhGia ? Number(user.profile.diemDanhGia) : 5.0;
        setTodayStats({
          completedTrips: 0,
          totalEarnings: 0,
          rating: ratingVal,
        });
      }
    };

    fetchDriverStats();
  }, [user?.id, user?.profile]);

  // 1. Bắn vị trí GPS của tài xế vào Redis GEO
  const sendLocationUpdate = async (lat: number, lng: number) => {
    try {
      await api.post("/dispatch/location", {
        latitude: lat,
        longitude: lng,
      });
      setCurrentLocation({ lat, lng });
    } catch (err) {
      console.error("Lỗi cập nhật vị trí:", err);
    }
  };

  useEffect(() => {
    if (user?.vaiTro === "TAI_XE") {
      sendLocationUpdate(currentLocation.lat, currentLocation.lng);
      // Gửi định kỳ để giữ vị trí và trạng thái sẵn sàng trong Redis GEO
      const interval = setInterval(() => {
        sendLocationUpdate(currentLocation.lat, currentLocation.lng);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [user?.id, user?.vaiTro, currentLocation.lat, currentLocation.lng]);

  // 2. Lắng nghe WebSocket Realtime (QT-02)
  useEffect(() => {
    if (!socket || user?.vaiTro !== "TAI_XE") return;

    // Khi nhận lệnh mời nhận đơn độc quyền 15 giây (QT-02)
    const handleOffer = (offerPayload: any) => {
      setOffer(offerPayload);
      setCountdown(offerPayload.countdownSeconds || offerPayload.timeoutSeconds || 15);
      // Phát âm thanh thông báo chuẩn Grab
      soundEffects.playNewOfferSound();
    };

    socket.on("dispatch:offer", handleOffer);
    socket.on("driver:new_offer", handleOffer);

    // Khi hết 15s timeout
    socket.on("dispatch:timeout", () => {
      setOffer(null);
    });

    // Khi khách hàng hủy đơn trong lúc đang chào mời
    socket.on("dispatch:cancelled", (payload: any) => {
      setOffer(null);
      alert(payload?.message || "Khách hàng đã hủy yêu cầu đặt xe.");
    });

    return () => {
      socket.off("dispatch:offer", handleOffer);
      socket.off("driver:new_offer", handleOffer);
      socket.off("dispatch:timeout");
      socket.off("dispatch:cancelled");
    };
  }, [socket, user?.vaiTro]);

  // Đồng bộ trạng thái chuyến đi khi đang chạy (hủy chuyến từ phía khách hàng)
  useEffect(() => {
    if (!socket || !activeTrip) return;

    socket.emit("trip:join", { tripId: activeTrip.id });

    const handleCancelled = (payload: any) => {
      alert(payload?.message || "Khách hàng đã hủy chuyến xe này!");
      setActiveTrip(null);
      setTripStatus("NONE");
    };

    const handleStatusUpdated = (payload: any) => {
      const status = typeof payload === "string" ? payload : payload.status;
      if (status === "CANCELLED") {
        handleCancelled(payload);
      }
    };

    socket.on("trip:cancelled", handleCancelled);
    socket.on("trip:status_updated", handleStatusUpdated);

    return () => {
      socket.off("trip:cancelled", handleCancelled);
      socket.off("trip:status_updated", handleStatusUpdated);
    };
  }, [socket, activeTrip?.id]);

  // 3. Đếm ngược 15 giây
  useEffect(() => {
    if (!offer) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [offer]);

  // 4. Tài xế Chấp nhận chuyến (QT-02)
  const handleAcceptTrip = async () => {
    if (!offer) return;
    try {
      const res = await api.post("/dispatch/accept", { tripId: offer.tripId });
      setActiveTrip(res.data.data.trip);
      setTripStatus("ACCEPTED");
      setOffer(null);
      soundEffects.playSuccessSound();
    } catch (err: any) {
      alert(err.response?.data?.message || "Nhận chuyến thất bại");
      setOffer(null);
    }
  };

  // 5. Tài xế Từ chối chuyến (QT-02)
  const handleRejectTrip = async () => {
    if (!offer) return;
    try {
      await api.post("/dispatch/reject", { tripId: offer.tripId, reason: "Tài xế bận" });
    } finally {
      setOffer(null);
    }
  };

  // 6. Các bước hành trình: ARRIVED -> IN_PROGRESS -> COMPLETED
  const handleArrive = async () => {
    if (!activeTrip) return;
    try {
      await api.post(`/trips/${activeTrip.id}/arrive`);
      setTripStatus("ARRIVED");
    } catch (err: any) {
      alert(err.response?.data?.message);
    }
  };

  const handleStart = async () => {
    if (!activeTrip) return;
    try {
      await api.post(`/trips/${activeTrip.id}/start`);
      setTripStatus("IN_PROGRESS");
    } catch (err: any) {
      alert(err.response?.data?.message);
    }
  };

  const handleComplete = async () => {
    if (!activeTrip) return;
    try {
      await api.post(`/trips/${activeTrip.id}/complete`);
      soundEffects.playSuccessSound();
      setTodayStats((prev) => ({
        ...prev,
        completedTrips: prev.completedTrips + 1,
        totalEarnings: prev.totalEarnings + Number(activeTrip.soTienCuoiCung || 50000),
      }));
      alert("🎉 Chúc mừng bạn đã hoàn thành chuyến xe!");
      setActiveTrip(null);
      setTripStatus("NONE");
    } catch (err: any) {
      alert(err.response?.data?.message);
    }
  };

  // Mô phỏng di chuyển GPS của tài xế
  const simulateMove = () => {
    const newLat = currentLocation.lat + 0.0015;
    const newLng = currentLocation.lng + 0.0015;
    sendLocationUpdate(newLat, newLng);
  };

  if (user?.vaiTro !== "TAI_XE") {
    return (
      <div className="w-full h-full overflow-y-auto flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl shadow-2xl text-center border-2 border-gray-100">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertTriangle className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-black text-gray-900">Yêu cầu tài khoản Đối tác Tài xế</h3>
          <p className="text-sm text-gray-600 mt-2 mb-6 leading-relaxed">
            {user ? (
              <>
                Bạn đang đăng nhập với tài khoản <strong>{user.hoTen}</strong> (Vai trò: {user.vaiTro}). Phân hệ này dành riêng cho đối tác tài xế tiếp nhận chuyến xe.
              </>
            ) : (
              "Bạn chưa đăng nhập vào hệ thống. Vui lòng đăng nhập bằng tài khoản đối tác tài xế để tiếp nhận cuốc xe."
            )}
          </p>

          <div className="space-y-3">
            <button
              onClick={async () => {
                setSwitching("nam");
                try {
                  await quickLogin("0912345678");
                } finally {
                  setSwitching(null);
                }
              }}
              disabled={!!switching}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {switching === "nam" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Car className="w-5 h-5" />
              )}
              <span>1-Click Đăng nhập Lê Hoàng Nam (GrabCar)</span>
            </button>

            <button
              onClick={async () => {
                setSwitching("bao");
                try {
                  await quickLogin("0919876543");
                } finally {
                  setSwitching(null);
                }
              }}
              disabled={!!switching}
              className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-2 border-emerald-300 font-black py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {switching === "bao" ? (
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
              ) : null}
              <span>1-Click Đăng nhập Phạm Quốc Bảo (GrabBike)</span>
            </button>

            <button
              onClick={() => navigate("/auth?redirect=/driver")}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Đến trang Đăng nhập / Đăng ký</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tính toán stroke dash cho đồng hồ đếm ngược 15s
  const circleRadius = 42;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (countdown / 15) * circumference;
  const countdownColor = countdown > 7 ? "#10B981" : countdown > 3 ? "#F59E0B" : "#EF4444";

  return (
    <div className="w-full h-[calc(100vh-80px)] p-4 sm:p-5 flex flex-col gap-4 overflow-hidden">
      {/* THANH HUD TÀI XẾ: THỐNG KÊ DOANH THU & TRẠNG THÁI */}
      <div className="bg-gray-950 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border-2 border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-5 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20">
              👨‍✈️
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-950 ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">{user?.hoTen}</h2>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-500/30">
                {user?.profile?.loaiDichVu === "GRAB_CAR_7"
                  ? "GrabCar 7 chỗ"
                  : user?.profile?.loaiDichVu === "GRAB_CAR_4"
                  ? "GrabCar 4 chỗ"
                  : user?.profile?.loaiDichVu === "GRAB_BIKE"
                  ? "GrabBike"
                  : "Đối tác Tài xế"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
              <span className="flex items-center text-amber-400 font-bold">
                <Star className="w-4 h-4 fill-current mr-1" />
                {user?.profile?.soLuotDanhGia && user.profile.soLuotDanhGia > 0
                  ? Number(user.profile.diemDanhGia).toFixed(2)
                  : "5.0 (Mới)"}
              </span>
              <span>•</span>
              <span className="font-bold text-gray-300">
                Biển số: {user?.profile?.bienSoXe || "Chưa đăng ký"}
              </span>
            </div>
          </div>
        </div>

        {/* Thống kê nhanh trong ngày */}
        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-gray-800 pt-4 md:pt-0 md:pl-6">
          <div>
            <span className="text-xs text-gray-400 block font-bold">Thu nhập hôm nay:</span>
            <span className="text-2xl font-black text-emerald-400 block">
              {todayStats.totalEarnings.toLocaleString("vi-VN")}đ
            </span>
          </div>

          <div>
            <span className="text-xs text-gray-400 block font-bold">Đã hoàn thành:</span>
            <span className="text-2xl font-black text-white block">{todayStats.completedTrips} cuốc</span>
          </div>

          {/* Công tắc Bật/Tắt Online */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 cursor-pointer ${
              isOnline
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/40"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <Power className="w-5 h-5" />
            {isOnline ? "SẴN SÀNG (ONLINE)" : "TẠM NGHỈ (OFFLINE)"}
          </button>
        </div>
      </div>

      {/* KHÔNG GIAN LÀM VIỆC: ĐIỀU HÀNH & BẢN ĐỒ RADAR (FULL CHIỀU CAO, KHÔNG CUỘN) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch overflow-hidden">
        {/* CỘT TRÁI: BẢNG TRẠNG THÁI CHUYẾN ĐI */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 shadow-xl border border-gray-100 flex flex-col justify-between overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Hành trình chuyến xe</h3>
              <p className="text-xs text-gray-500">Cập nhật bước thực hiện theo thời gian thực</p>
            </div>
            {activeTrip && (
              <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                {tripStatus}
              </span>
            )}
          </div>

          {/* Công cụ mô phỏng GPS di chuyển */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-emerald-600" />
                GPS Radar (Redis GEO):
              </span>
              <span className="text-[11px] text-gray-500 font-mono mt-0.5 block">
                {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </span>
            </div>

            <button
              onClick={simulateMove}
              className="text-xs font-extrabold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 px-3.5 py-2 rounded-xl shadow-sm transition-all active:scale-95"
            >
              🚴 Di chuyển xe +200m
            </button>
          </div>

          {/* TIẾN TRÌNH THỰC HIỆN CHUYẾN XE */}
          {activeTrip ? (
            <div className="bg-emerald-50/70 border-2 border-emerald-500/40 rounded-3xl p-5 flex flex-col gap-5 shadow-sm">
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-emerald-100 text-xs shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 ring-2 ring-emerald-200" />
                  <div>
                    <span className="font-bold text-gray-900 block">Đón khách tại:</span>
                    <span className="text-gray-600">{activeTrip.diemDon?.diaChiChiTiet || "1 Đại Cồ Việt, Hà Nội"}</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2.5 flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 ring-2 ring-rose-200" />
                  <div>
                    <span className="font-bold text-gray-900 block">Trả khách tại:</span>
                    <span className="text-gray-600">{activeTrip.diemTra?.diaChiChiTiet || "Hồ Hoàn Kiếm, Hà Nội"}</span>
                  </div>
                </div>
              </div>

              {/* Các nút bấm hành trình tuần tự */}
              <div className="space-y-2">
                {tripStatus === "ACCEPTED" && (
                  <button
                    onClick={handleArrive}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <MapPin className="w-5 h-5" />
                    Bước 1: Tôi đã đến điểm đón (ARRIVED)
                  </button>
                )}

                {tripStatus === "ARRIVED" && (
                  <button
                    onClick={handleStart}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Play className="w-5 h-5" />
                    Bước 2: Khách đã lên xe, Bắt đầu chạy (IN_PROGRESS)
                  </button>
                )}

                {tripStatus === "IN_PROGRESS" && (
                  <button
                    onClick={handleComplete}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Bước 3: Đến nơi, Hoàn thành chuyến xe (COMPLETED)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-10 text-center border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3">
                <Car className="w-7 h-7 animate-pulse" />
              </div>
              <h4 className="font-extrabold text-sm text-gray-900">Đang trực tuyến chờ đơn...</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                Khi có khách hàng đặt xe trong bán kính 5km, màn hình đếm ngược 15 giây độc quyền (QT-02) sẽ tự động xuất hiện.
              </p>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: BẢN ĐỒ RADAR KHÔNG GIAN ĐỊA LÝ (FULL VIEWPORT) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-4 shadow-xl border border-gray-100 flex flex-col gap-2 h-full overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              Radar Bản đồ Điều phối Vệ tinh (Redis GEO)
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {isOnline ? "Sẵn sàng nhận cuốc" : "Tạm nghỉ"}
            </span>
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden relative border border-gray-100">
            <ErrorBoundary
              fallback={
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-gray-500 bg-slate-50">
                  <span className="text-4xl mb-3">🛰️</span>
                  <p className="text-sm font-bold text-gray-700">Đang đồng bộ Radar GPS vệ tinh...</p>
                </div>
              }
            >
              <MapView driverLocation={currentLocation} />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* POPUP MỜI NHẬN CHUYẾN ĐỘC QUYỀN 15 GIÂY (QUY TẮC QT-02) */}
      {offer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border-4 border-emerald-500 animate-in zoom-in-95 relative overflow-hidden">
            {/* Header với Đồng hồ đếm ngược SVG */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  Cuốc xe mới độc quyền
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-2">Cơ hội nhận chuyến xe</h3>
              </div>

              {/* Circular SVG Timer */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    fill="transparent"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={circleRadius}
                    fill="transparent"
                    stroke={countdownColor}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute font-black text-lg" style={{ color: countdownColor }}>
                  {countdown}s
                </span>
              </div>
            </div>

            {/* Thu nhập cước chuyến */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4.5 rounded-2xl text-center mb-5 border border-emerald-200">
              <span className="text-xs text-emerald-700 font-bold block mb-1">Thu nhập ước tính:</span>
              <span className="text-3xl font-black text-emerald-800 tracking-tight">
                {Number(offer.soTienCuoiCung).toLocaleString("vi-VN")}đ
              </span>
              <span className="text-xs text-gray-500 font-semibold block mt-1">
                Cự ly {offer.quangDuongKm} km ~ {offer.thoiGianDuKienPhut} phút di chuyển
              </span>
            </div>

            {/* Chi tiết đón & trả */}
            <div className="space-y-3.5 text-xs mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <div className="flex items-start gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">Đón khách tại:</span>
                  <span className="text-gray-600 leading-relaxed">{offer.diemDon.diaChiChiTiet}</span>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                    Cách vị trí của bạn ~{offer.distanceToPickupKm} km
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2.5 border-t border-gray-200">
                <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                <div>
                  <span className="font-bold text-gray-900 block">Trả khách tại:</span>
                  <span className="text-gray-600 leading-relaxed">{offer.diemTra.diaChiChiTiet}</span>
                </div>
              </div>
            </div>

            {/* 2 Nút: Chấp nhận hoặc Bỏ qua */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRejectTrip}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold py-3.5 rounded-2xl text-xs transition-colors"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleAcceptTrip}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black py-3.5 rounded-2xl text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Nhận chuyến ({countdown}s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
