import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, getStoredAccessToken } from "../api/client";
import { useAuth } from "../context/auth.context";
import { useSocket } from "../context/socket.context";
import { MapView } from "../components/MapView";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ServiceSelector, ServiceType } from "../components/ServiceCard";
import { soundEffects } from "../utils/sound";
import {
  Navigation2,
  Tag,
  CreditCard,
  AlertCircle,
  Star,
  Bike,
  Car,
  Sparkles,
  CheckCircle2,
  Loader2,
  Ticket,
  X,
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
  { tenDiaDiem: "Lotte Center Hà Nội", diaChiChiTiet: "54 Liễu Giai, Ba Đình", kinhDo: 105.8123, viDo: 21.0319 },
];

export const CustomerPage: React.FC = () => {
  const { user, token, quickLogin } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  // Tự động điều hướng theo phân hệ: Tài xế thì vào /driver, Quản trị thì vào /admin
  useEffect(() => {
    if (user?.vaiTro === "TAI_XE") {
      navigate("/driver", { replace: true });
    } else if (user?.vaiTro === "QUAN_TRI_VIEN") {
      navigate("/admin", { replace: true });
    }
  }, [user?.vaiTro, navigate]);

  // Điểm đón & điểm trả
  const [pickup, setPickup] = useState<LocationData>(PRESET_PLACES[0]);
  const [dropoff, setDropoff] = useState<LocationData>(PRESET_PLACES[1]);

  // Cấu hình đặt xe
  const [selectedService, setSelectedService] = useState<ServiceType>("GRAB_CAR_4");
  const [paymentMethod, setPaymentMethod] = useState<"TIEN_MAT" | "VI_DIEN_TU" | "THE_NGAN_HANG">("TIEN_MAT");
  const [voucherCode, setVoucherCode] = useState<string>("");

  // Kho Voucher khuyến mại khả dụng (QT-03)
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [voucherModalOpen, setVoucherModalOpen] = useState<boolean>(false);

  // Tải danh sách voucher đang hoạt động từ hệ thống
  const fetchVouchers = async () => {
    try {
      const res = await api.get("/trips/vouchers");
      if (res.data?.data?.vouchers) {
        setAvailableVouchers(res.data.data.vouchers);
      }
    } catch (err) {
      console.warn("Không thể tải danh sách voucher:", err);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  // Dữ liệu cước ước tính (QT-01)
  const [estimateData, setEstimateData] = useState<any>(null);

  // Trạng thái chuyến xe
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("Thay đổi kế hoạch");
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // 1. Tính cước ước tính khi đổi điểm đón/trả/voucher (QT-01)
  const fetchEstimate = async () => {
    if (!pickup || !dropoff) return;
    setErrorMessage(null);

    try {
      const res = await api.post("/trips/estimate-fare", {
        diemDon: pickup,
        diemTra: dropoff,
        maVoucher: voucherCode.trim() || undefined,
      });

      setEstimateData(res.data.data);
    } catch (err: any) {
      console.warn("Lỗi tính cước:", err);
    }
  };

  useEffect(() => {
    fetchEstimate();
  }, [pickup, dropoff, voucherCode]);

  // Tự động khôi phục chuyến xe đang chạy nếu người dùng tải lại trang
  useEffect(() => {
    if (!token || user?.vaiTro !== "KHACH_HANG") return;

    const checkActiveTrip = async () => {
      try {
        const res = await api.get("/trips/history/my-trips");
        const trips = res.data?.data?.trips || [];
        const running = trips.find((t: any) =>
          ["PENDING", "ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(t.trangThai)
        );
        if (running) {
          const detailRes = await api.get(`/trips/${running.id}`);
          const fullTrip = detailRes.data?.data?.trip || running;
          setActiveTrip(fullTrip);
        }
      } catch (err) {
        console.warn("Không thể khôi phục chuyến xe đang chạy:", err);
      }
    };

    checkActiveTrip();
  }, [token, user?.id, user?.vaiTro]);

  // 2. Lắng nghe WebSocket Realtime cho chuyến xe (QT-02)
  useEffect(() => {
    if (!socket || !activeTrip) return;

    socket.emit("trip:join", { tripId: activeTrip.id });

    // Khi tài xế nhận cuốc (QT-02) - hỗ trợ cả trip:driver_assigned và trip:accepted
    const handleAccepted = (payload: any) => {
      soundEffects.playAccepted();
      const rawDriver = payload.taiXe || payload.driver;
      setActiveTrip((prev: any) => ({
        ...prev,
        trangThai: "ACCEPTED",
        taiXe: rawDriver
          ? {
              ...rawDriver,
              hoTen: rawDriver.hoTen || rawDriver.nguoiDung?.hoTen || "Tài xế Grab",
              bienSoXe: rawDriver.bienSoXe || "29A-123.45",
              diemDanhGia: rawDriver.diemDanhGia ? Number(rawDriver.diemDanhGia) : 5.0,
              soDienThoaiMasked:
                rawDriver.soDienThoaiMasked ||
                (rawDriver.nguoiDung?.soDienThoai
                  ? rawDriver.nguoiDung.soDienThoai.slice(0, 3) + "****" + rawDriver.nguoiDung.soDienThoai.slice(-3)
                  : rawDriver.soDienThoai || "090****123"),
            }
          : prev?.taiXe,
        thoiGianNhan: payload.thoiGianNhan || new Date().toISOString(),
      }));
    };

    // Khi trạng thái chuyến đi cập nhật từ server (ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED)
    const handleStatusUpdated = (payload: any) => {
      const newStatus = typeof payload === "string" ? payload : payload.status;
      if (!newStatus) return;

      if (newStatus === "ACCEPTED") {
        soundEffects.playAccepted();
      } else if (newStatus === "ARRIVED") {
        soundEffects.playArrived();
      } else if (newStatus === "COMPLETED") {
        soundEffects.playCompleted();
      } else if (newStatus === "CANCELLED") {
        setActiveTrip(null);
        setDriverLocation(null);
        setCancelModalOpen(false);
        setErrorMessage(payload?.message || "Chuyến xe đã bị hủy.");
        return;
      }

      const rawDriver = payload.taiXe || payload.driver;
      setActiveTrip((prev: any) => ({
        ...prev,
        trangThai: newStatus,
        ...(rawDriver
          ? {
              taiXe: {
                ...rawDriver,
                hoTen: rawDriver.hoTen || rawDriver.nguoiDung?.hoTen || "Tài xế Grab",
                bienSoXe: rawDriver.bienSoXe || "29A-123.45",
                diemDanhGia: rawDriver.diemDanhGia ? Number(rawDriver.diemDanhGia) : 5.0,
                soDienThoaiMasked:
                  rawDriver.soDienThoaiMasked ||
                  (rawDriver.nguoiDung?.soDienThoai
                    ? rawDriver.nguoiDung.soDienThoai.slice(0, 3) + "****" + rawDriver.nguoiDung.soDienThoai.slice(-3)
                    : rawDriver.soDienThoai || "090****123"),
              },
            }
          : {}),
        ...(payload.thoiGianNhan ? { thoiGianNhan: payload.thoiGianNhan } : {}),
        ...(payload.hoaDon ? { hoaDon: payload.hoaDon } : {}),
      }));
    };

    // Khi chuyến đi bị hủy
    const handleTripCancelled = (payload: any) => {
      setActiveTrip(null);
      setDriverLocation(null);
      setCancelModalOpen(false);
      setErrorMessage(payload?.message || "Chuyến xe đã bị hủy.");
    };

    // Khi tài xế cập nhật vị trí GPS (hỗ trợ cả latitude/longitude và lat/lng)
    const handleDriverLocation = (coords: any) => {
      const lat = coords?.latitude ?? coords?.lat;
      const lng = coords?.longitude ?? coords?.lng;
      if (lat !== undefined && lng !== undefined) {
        setDriverLocation({ lat, lng });
      }
    };

    // Khi tài xế đã đến điểm đón (QT-05)
    const handleDriverArrived = () => {
      soundEffects.playArrived();
      setActiveTrip((prev: any) => ({
        ...prev,
        trangThai: "ARRIVED",
      }));
    };

    // Khi bắt đầu chuyến đi
    const handleTripStarted = () => {
      setActiveTrip((prev: any) => ({
        ...prev,
        trangThai: "IN_PROGRESS",
      }));
    };

    // Khi chuyến đi hoàn tất
    const handleTripCompleted = (payload: any) => {
      soundEffects.playCompleted();
      setActiveTrip((prev: any) => ({
        ...prev,
        trangThai: "COMPLETED",
        hoaDon: payload?.hoaDon,
      }));
    };

    // Khi không tìm thấy tài xế sau 15s (QT-02)
    const handleNoDriver = (payload: any) => {
      setErrorMessage(payload?.message || "Không tìm thấy tài xế gần bạn trong bán kính 5km");
      setActiveTrip(null);
    };

    socket.on("trip:driver_assigned", handleAccepted);
    socket.on("trip:accepted", handleAccepted);
    socket.on("trip:status_updated", handleStatusUpdated);
    socket.on("trip:cancelled", handleTripCancelled);
    socket.on("trip:driver_location", handleDriverLocation);
    socket.on("driver:location_updated", handleDriverLocation);
    socket.on("trip:driver_arrived", handleDriverArrived);
    socket.on("trip:started", handleTripStarted);
    socket.on("trip:completed", handleTripCompleted);
    socket.on("dispatch:no_driver", handleNoDriver);
    socket.on("trip:no_driver", handleNoDriver);

    return () => {
      socket.off("trip:driver_assigned", handleAccepted);
      socket.off("trip:accepted", handleAccepted);
      socket.off("trip:status_updated", handleStatusUpdated);
      socket.off("trip:cancelled", handleTripCancelled);
      socket.off("trip:driver_location", handleDriverLocation);
      socket.off("driver:location_updated", handleDriverLocation);
      socket.off("trip:driver_arrived", handleDriverArrived);
      socket.off("trip:started", handleTripStarted);
      socket.off("trip:completed", handleTripCompleted);
      socket.off("dispatch:no_driver", handleNoDriver);
      socket.off("trip:no_driver", handleNoDriver);
    };
  }, [socket, activeTrip?.id]);

  // 2b. Đồng bộ liên tục dự phòng (Polling 2.5s) khi chuyến xe đang hoạt động (Đảm bảo không bao giờ bị kẹt PENDING)
  useEffect(() => {
    if (!activeTrip || ["COMPLETED", "CANCELLED"].includes(activeTrip.trangThai)) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/trips/${activeTrip.id}`);
        const freshTrip = res.data?.data?.trip;
        if (!freshTrip) return;

        if (freshTrip.trangThai !== activeTrip.trangThai || (!activeTrip.taiXe && freshTrip.taiXe)) {
          const rawDriver = freshTrip.taiXe;
          const normalizedDriver = rawDriver
            ? {
                ...rawDriver,
                hoTen: rawDriver.hoTen || rawDriver.nguoiDung?.hoTen || "Tài xế Grab",
                bienSoXe: rawDriver.bienSoXe || "29A-123.45",
                diemDanhGia: rawDriver.diemDanhGia ? Number(rawDriver.diemDanhGia) : 5.0,
                soDienThoaiMasked:
                  rawDriver.soDienThoaiMasked ||
                  (rawDriver.nguoiDung?.soDienThoai
                    ? rawDriver.nguoiDung.soDienThoai.slice(0, 3) + "****" + rawDriver.nguoiDung.soDienThoai.slice(-3)
                    : rawDriver.soDienThoai || "090****123"),
              }
            : activeTrip.taiXe;

          setActiveTrip((prev: any) => ({
            ...prev,
            ...freshTrip,
            taiXe: normalizedDriver,
          }));

          if (freshTrip.trangThai === "ACCEPTED" && activeTrip.trangThai === "PENDING") {
            soundEffects.playAccepted();
          } else if (freshTrip.trangThai === "ARRIVED" && activeTrip.trangThai !== "ARRIVED") {
            soundEffects.playArrived();
          } else if (freshTrip.trangThai === "COMPLETED" && activeTrip.trangThai !== "COMPLETED") {
            soundEffects.playCompleted();
          }
        }
      } catch (err) {
        // Bỏ qua lỗi polling im lặng
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTrip?.id, activeTrip?.trangThai, activeTrip?.taiXe]);

  // 3. Đặt xe với xử lý phiên tab thông minh
  const handleBooking = async () => {
    // Nếu có mã voucher đang nhập nhưng không thỏa mãn điều kiện tối thiểu của xe đang chọn
    if (voucherCode && serviceVoucherWarning) {
      const confirmRemove = window.confirm(
        `Mã "${voucherCode}" chưa đủ điều kiện áp dụng cho loại xe này (${serviceVoucherWarning}).\n\nBạn có muốn BỎ MÃ GIẢM GIÁ để tiếp tục đặt xe không?`
      );
      if (confirmRemove) {
        setVoucherCode("");
        return;
      } else {
        return;
      }
    }

    setBookingLoading(true);
    setErrorMessage(null);

    try {
      let activeToken = getStoredAccessToken();
      let activeUser = user;

      // Nếu chưa có tài khoản hoặc vai trò không phải KHACH_HANG:
      // Tự động chuyển phiên làm việc của RIÊNG tab này sang tài khoản Khách hàng
      if (!activeToken || !activeUser || activeUser.vaiTro !== "KHACH_HANG") {
        activeUser = await quickLogin("0901234567");
        activeToken = getStoredAccessToken();
      }

      const res = await api.post("/trips", {
        diemDon: pickup,
        diemTra: dropoff,
        loaiDichVu: selectedService,
        phuongThucThanhToan: paymentMethod,
        maVoucher: voucherCode.trim() || undefined,
      });

      setActiveTrip(res.data.data.trip);
    } catch (err: any) {
      console.error("Lỗi đặt xe:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Không thể kết nối Backend (Port 4000). Vui lòng kiểm tra server đang chạy!";
      setErrorMessage(msg);
    } finally {
      setBookingLoading(false);
    }
  };

  // 4. Hủy chuyến xe (QT-05)
  const handleCancelTrip = async () => {
    if (!activeTrip || cancelLoading) return;
    setCancelLoading(true);
    try {
      const res = await api.post(`/trips/${activeTrip.id}/cancel`, { lyDoHuy: cancelReason });
      alert(res.data.message);
      setActiveTrip(null);
      setCancelModalOpen(false);
      setDriverLocation(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Không thể hủy chuyến xe");
    } finally {
      setCancelLoading(false);
    }
  };

  // Tính toán phí phạt hủy thực tế theo QT-05
  const getCancellationFeePreview = () => {
    if (!activeTrip || activeTrip.trangThai === "PENDING" || !activeTrip.taiXe) {
      return {
        fee: 0,
        isFree: true,
        minutes: 0,
        message: "Chưa có tài xế nhận cuốc: Bạn được hủy hoàn toàn MIỄN PHÍ.",
      };
    }
    const acceptedAt = activeTrip.thoiGianNhan ? new Date(activeTrip.thoiGianNhan).getTime() : null;
    if (!acceptedAt) {
      return {
        fee: 0,
        isFree: true,
        minutes: 0,
        message: "Bạn đang trong thời gian 5 phút đầu: Hủy chuyến MIỄN PHÍ.",
      };
    }
    const diffMinutes = Math.floor((Date.now() - acceptedAt) / 60000);
    if (diffMinutes > 5) {
      return {
        fee: 10000,
        isFree: false,
        minutes: diffMinutes,
        message: `Tài xế đã di chuyển đón bạn ${diffMinutes} phút (> 5 phút). Theo quy tắc QT-05, phí phạt 10.000 VNĐ sẽ được tự động cộng vào chuyến kế tiếp của bạn.`,
      };
    } else {
      const remainingSeconds = Math.max(0, 300 - Math.floor((Date.now() - acceptedAt) / 1000));
      const remMin = Math.floor(remainingSeconds / 60);
      const remSec = remainingSeconds % 60;
      return {
        fee: 0,
        isFree: true,
        minutes: diffMinutes,
        message: `Tài xế mới nhận cuốc được ${diffMinutes} phút (< 5 phút). Bạn được HỦY MIỄN PHÍ (Còn lại ${remMin}p ${remSec < 10 ? "0" : ""}${remSec}s miễn phí)!`,
      };
    }
  };

  // Option được chọn hiện tại
  const currentOption = estimateData?.options?.find((o: any) => o.loaiDichVu === selectedService);
  const currentDiscount = currentOption?.tienGiam || 0;
  const currentTotal = currentOption?.soTienCuoiCung || 0;
  const currentOriginal = currentOption?.tongTienGoc || 0;
  const serviceVoucherWarning = currentOption?.voucherMessage;
  const voucherError = estimateData?.voucherError;

  // Biểu giá các loại xe hiển thị
  const serviceOptions = [
    {
      loaiDichVu: "GRAB_BIKE" as ServiceType,
      name: "GrabBike",
      desc: "Xe ôm công nghệ nhanh chóng, tiết kiệm",
      capacity: "1 người",
      icon: Bike,
      soTienCuoiCung: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_BIKE")?.soTienCuoiCung || 15000,
      tongTienGoc: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_BIKE")?.tongTienGoc || 15000,
      tienGiam: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_BIKE")?.tienGiam || 0,
    },
    {
      loaiDichVu: "GRAB_CAR_4" as ServiceType,
      name: "GrabCar 4 chỗ",
      desc: "Ô tô 4 chỗ êm ái, máy lạnh",
      capacity: "4 người",
      icon: Car,
      soTienCuoiCung: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_CAR_4")?.soTienCuoiCung || 50000,
      tongTienGoc: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_CAR_4")?.tongTienGoc || 50000,
      tienGiam: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_CAR_4")?.tienGiam || 0,
    },
    {
      loaiDichVu: "GRAB_CAR_7" as ServiceType,
      name: "GrabCar 7 chỗ",
      desc: "Rộng rãi cho gia đình và nhóm đông",
      capacity: "7 người",
      icon: Car,
      soTienCuoiCung: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_CAR_7")?.soTienCuoiCung || 70000,
      tongTienGoc: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_CAR_7")?.tongTienGoc || 70000,
      tienGiam: estimateData?.options?.find((o: any) => o.loaiDichVu === "GRAB_CAR_7")?.tienGiam || 0,
    },
  ];

  return (
    <div className="w-full h-[calc(100vh-80px)] p-4 sm:p-6 flex flex-col lg:flex-row gap-6 overflow-hidden">
      {/* CỘT TRÁI: BẢNG TÍNH CƯỚC & ĐẶT XE / QUẢN LÝ CHUYẾN ĐI ĐANG CHẠY */}
      <div className="w-full lg:w-[500px] xl:w-[560px] h-full bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border-2 border-gray-100 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-gray-100 pb-3.5">
            <div>
              <span className="text-xs sm:text-sm font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {activeTrip ? "Chuyến đi đang diễn ra" : "Dịch vụ di chuyển thông minh"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
                {activeTrip ? "Thông tin chuyến xe" : "Đặt chuyến đi"}
              </h2>
            </div>
            {estimateData && !activeTrip && (
              <span className="text-sm font-black bg-emerald-100 text-emerald-900 px-4 py-2 rounded-2xl border border-emerald-300">
                {estimateData.quangDuongKm} km ~ {estimateData.thoiGianDuKienPhut} phút
              </span>
            )}
            {activeTrip && (
              <span className="text-xs font-black bg-emerald-600 text-white px-3.5 py-1.5 rounded-2xl shadow-sm">
                {activeTrip.trangThai}
              </span>
            )}
          </div>

          {/* Trạng thái đăng nhập */}
          {!user && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border-2 border-blue-200 text-blue-900 flex items-center justify-between text-xs font-bold">
              <span>
                Chưa đăng nhập. Bấm đặt xe hoặc dùng 1-Click để trải nghiệm đặt chuyến ngay.
              </span>
              <button
                type="button"
                onClick={() => quickLogin("0901234567")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer ml-2 flex-shrink-0 transition-colors"
              >
                1-Click Khách mẫu
              </button>
            </div>
          )}

          {user && user.vaiTro === "KHACH_HANG" && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs font-bold">
              <span>
                Khách hàng: <strong>{user.hoTen}</strong> ({user.soDienThoai || user.email})
              </span>
              <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full font-black">
                ✓ Sẵn sàng đặt chuyến
              </span>
            </div>
          )}

          {user && user.vaiTro !== "KHACH_HANG" && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-center justify-between text-xs font-bold">
              <span>
                Đang chuyển hướng sang giao diện <strong>{user.vaiTro === "TAI_XE" ? "Tài xế" : "Quản trị viên"}</strong>...
              </span>
              <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
            </div>
          )}

          {/* Cảnh báo lỗi */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-800 flex items-start gap-3 text-sm font-bold animate-shake">
              <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-black text-base block text-rose-900">
                  {errorMessage.includes("nợ cước") || errorMessage.includes("QT-04")
                    ? "Ràng buộc nghiệp vụ (QT-04):"
                    : "Thông báo hệ thống:"}
                </span>
                <span className="mt-0.5 block">{errorMessage}</span>
                {(errorMessage.includes("nợ cước") || errorMessage.includes("QT-04")) && (
                  <button
                    type="button"
                    onClick={async () => {
                      setErrorMessage(null);
                      await quickLogin("0901234567");
                    }}
                    className="mt-2.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <span>👉 Đổi sang Nguyễn Văn Minh (Khách hàng sạch nợ)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TRƯỜNG HỢP 1: CHUYẾN XE ĐANG HOẠT ĐỘNG (ACTIVE TRIP DASHBOARD) */}
          {activeTrip ? (
            <div className="space-y-4">
              {/* Trạng thái thực tế */}
              <div className="bg-emerald-50 border-2 border-emerald-500/40 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                <div>
                  <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block">
                    Tiến độ chuyến xe
                  </span>
                  <span className="text-base font-black text-emerald-950">
                    {activeTrip.trangThai === "PENDING" && "Đang tìm tài xế gần nhất (QT-02)..."}
                    {activeTrip.trangThai === "ACCEPTED" && "Tài xế đã nhận cuốc!"}
                    {activeTrip.trangThai === "ARRIVED" && "Tài xế đã đến điểm đón!"}
                    {activeTrip.trangThai === "IN_PROGRESS" && "Đang di chuyển..."}
                    {activeTrip.trangThai === "COMPLETED" && "Chuyến xe đã hoàn thành!"}
                    {activeTrip.trangThai === "CANCELLED" && "Chuyến xe đã hủy!"}
                  </span>
                </div>
              </div>

              {/* Thông tin lộ trình */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-100 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-gray-500 block">Điểm đón khách</span>
                    <p className="text-sm font-black text-gray-900 truncate">
                      {activeTrip.diemDon?.tenDiaDiem || pickup.tenDiaDiem}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {activeTrip.diemDon?.diaChiChiTiet || pickup.diaChiChiTiet}
                    </p>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-200" />

                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full bg-rose-500 ring-4 ring-rose-100 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-gray-500 block">Điểm đến</span>
                    <p className="text-sm font-black text-gray-900 truncate">
                      {activeTrip.diemTra?.tenDiaDiem || dropoff.tenDiaDiem}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {activeTrip.diemTra?.diaChiChiTiet || dropoff.diaChiChiTiet}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-2.5 border border-gray-200 flex items-center justify-between text-xs font-black text-gray-700">
                  <span>
                    Dịch vụ:{" "}
                    {activeTrip.loaiDichVu === "GRAB_BIKE"
                      ? "GrabBike"
                      : activeTrip.loaiDichVu === "GRAB_CAR_4"
                      ? "GrabCar 4 chỗ"
                      : "GrabCar 7 chỗ"}
                  </span>
                  <span>{activeTrip.quangDuongKm} km ~ {activeTrip.thoiGianDuKienPhut} phút</span>
                </div>
              </div>

              {/* Thông tin tài xế */}
              {activeTrip.taiXe && (
                <div className="bg-white rounded-2xl p-4 border-2 border-emerald-300 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-2xl">
                      👨‍✈️
                    </div>
                    <div>
                      <h4 className="font-black text-base text-gray-900">
                        {activeTrip.taiXe.hoTen || activeTrip.taiXe.nguoiDung?.hoTen || "Tài xế Grab"}
                      </h4>
                      <div className="flex items-center gap-2.5 text-xs text-gray-500 mt-1">
                        <span className="font-black bg-gray-100 px-2 py-0.5 rounded-md text-gray-900">
                          {activeTrip.taiXe.bienSoXe}
                        </span>
                        <span className="flex items-center text-amber-500 font-black">
                          <Star className="w-3.5 h-3.5 fill-current mr-1" />
                          {activeTrip.taiXe.diemDanhGia}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-400 block font-bold">SĐT bảo mật:</span>
                    <span className="text-sm font-black text-gray-900">
                      {activeTrip.taiXe.soDienThoaiMasked ||
                        (activeTrip.taiXe.nguoiDung?.soDienThoai
                          ? activeTrip.taiXe.nguoiDung.soDienThoai.slice(0, 3) + "****" + activeTrip.taiXe.nguoiDung.soDienThoai.slice(-3)
                          : activeTrip.taiXe.soDienThoai || "090****123")}
                    </span>
                  </div>
                </div>
              )}

              {/* Chi tiết cước & Ưu đãi voucher đã dùng */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 space-y-2.5">
                <span className="font-black text-xs uppercase tracking-wider text-gray-500 block">
                  Chi tiết thanh toán chuyến đi
                </span>

                {/* Thẻ mã giảm giá */}
                {Number(activeTrip.tienGiam) > 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <span className="font-black text-xs block">
                          Mã ưu đãi: {activeTrip.khuyenMai?.maVoucher || "VOUCHER"}
                        </span>
                        {activeTrip.khuyenMai?.tenChuongTrinh && (
                          <span className="text-[11px] text-emerald-700 block font-medium">
                            {activeTrip.khuyenMai.tenChuongTrinh}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                      -{Number(activeTrip.tienGiam).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-between text-xs">
                    <span>Mã giảm giá (QT-03):</span>
                    <span className="font-bold text-gray-600">Không áp dụng</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold">Phương thức:</span>
                  <span className="font-black text-gray-900">
                    {paymentMethod === "TIEN_MAT" ? "💵 Tiền mặt" : paymentMethod === "VI_DIEN_TU" ? "📱 Ví điện tử" : "💳 Thẻ ngân hàng"}
                  </span>
                </div>

                {Number(activeTrip.tienGiam) > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-bold">Giá cước gốc ban đầu:</span>
                    <span className="line-through text-gray-400 font-black">
                      {(Number(activeTrip.soTienCuoiCung) + Number(activeTrip.tienGiam)).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                )}

                <div className="border-t-2 border-gray-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-black text-gray-900">Cước cần thanh toán:</span>
                  <span className="text-2xl font-black text-emerald-800">
                    {Number(activeTrip.soTienCuoiCung).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: FORM ĐẶT XE KHI CHƯA CÓ CHUYẾN */
            <>
              {/* Chọn Điểm Đón & Điểm Đến */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-sm sm:text-base font-black text-gray-800 flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                    Điểm đón khách:
                  </label>
                  <select
                    value={pickup.tenDiaDiem}
                    onChange={(e) => {
                      const found = PRESET_PLACES.find((p) => p.tenDiaDiem === e.target.value);
                      if (found) setPickup(found);
                    }}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-base sm:text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {PRESET_PLACES.map((p) => (
                      <option key={p.tenDiaDiem} value={p.tenDiaDiem}>
                        {p.tenDiaDiem} - {p.diaChiChiTiet}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm sm:text-base font-black text-gray-800 flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                    Điểm đến:
                  </label>
                  <select
                    value={dropoff.tenDiaDiem}
                    onChange={(e) => {
                      const found = PRESET_PLACES.find((p) => p.tenDiaDiem === e.target.value);
                      if (found) setDropoff(found);
                    }}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-base sm:text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {PRESET_PLACES.map((p) => (
                      <option key={p.tenDiaDiem} value={p.tenDiaDiem}>
                        {p.tenDiaDiem} - {p.diaChiChiTiet}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chọn Loại Phương Tiện (QT-01) */}
              <div className="pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <label className="text-sm sm:text-base font-black text-gray-800">
                    Chọn loại phương tiện (QT-01):
                  </label>
                  <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    💡 Chọn đúng loại xe tài xế đã đăng ký để nhận cuốc
                  </span>
                </div>
                <ServiceSelector
                  selectedService={selectedService}
                  onSelect={setSelectedService}
                  options={serviceOptions}
                />
              </div>

              {/* Mã Khuyến Mại (QT-03) & Phương Thức Thanh Toán */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Cột mã giảm giá */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        Mã giảm giá (QT-03):
                      </label>
                      <button
                        type="button"
                        onClick={() => setVoucherModalOpen(true)}
                        className="text-xs font-black text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Kho ưu đãi ({availableVouchers.length})</span>
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase().trim())}
                        placeholder="Nhập mã (VD: GRAB20K)"
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl pl-4 pr-20 py-3 text-sm font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {voucherCode && (
                        <button
                          type="button"
                          onClick={() => setVoucherCode("")}
                          className="absolute right-2.5 px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-black rounded-xl transition-colors cursor-pointer"
                        >
                          ✕ Bỏ mã
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cột phương thức thanh toán */}
                  <div>
                    <label className="text-xs sm:text-sm font-black text-gray-800 flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Phương thức:
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="TIEN_MAT">💵 Tiền mặt</option>
                      <option value="VI_DIEN_TU">📱 Ví điện tử</option>
                      <option value="THE_NGAN_HANG">💳 Thẻ ngân hàng</option>
                    </select>
                  </div>
                </div>

                {/* Quick Chips: Chọn nhanh mã voucher có sẵn */}
                {availableVouchers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-gray-500 mr-1">Gợi ý mã:</span>
                    {availableVouchers.slice(0, 4).map((v) => {
                      const isSelected = voucherCode === v.maVoucher;
                      return (
                        <button
                          key={v.id || v.maVoucher}
                          type="button"
                          onClick={() => setVoucherCode(isSelected ? "" : v.maVoucher)}
                          className={`text-xs font-black px-2.5 py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                              : "bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          <span>🏷️ {v.maVoucher}</span>
                          <span className="opacity-80">
                            ({v.loaiGiamGia === "FIXED_AMOUNT" ? `-${Number(v.giaTriGiam) / 1000}k` : `-${v.giaTriGiam}%`})
                          </span>
                          {isSelected && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Phản hồi trạng thái Voucher */}
                {voucherCode && (
                  <div className="pt-1">
                    {voucherError ? (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                        <span>{voucherError}</span>
                      </div>
                    ) : serviceVoucherWarning ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                          <span>
                            ⚠️ {serviceVoucherWarning} (Cước xe hiện tại: {currentOriginal.toLocaleString("vi-VN")}đ)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setVoucherCode("")}
                          className="text-amber-900 underline text-xs font-black cursor-pointer flex-shrink-0"
                        >
                          Bỏ mã
                        </button>
                      </div>
                    ) : currentDiscount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                          <span>
                            Đã áp dụng mã <strong>{voucherCode}</strong>: Giảm -{currentDiscount.toLocaleString("vi-VN")}đ
                          </span>
                        </span>
                        <span className="text-[11px] text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                          ✓ Tiết kiệm
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* NÚT ĐẶT XE HOẶC CÁC NÚT THAO TÁC KHI ĐANG CÓ CHUYẾN */}
        <div className="pt-4 border-t-2 border-gray-100">
          {!activeTrip ? (
            <div className="space-y-3">
              {/* Bảng tính chi tiết cước trước khi đặt xe */}
              {currentOption && (
                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5 text-xs font-bold text-gray-600">
                  <div className="flex justify-between items-center">
                    <span>Cước di chuyển ({estimateData?.quangDuongKm || 0} km):</span>
                    <span className="text-gray-900 font-black">{currentOriginal.toLocaleString("vi-VN")}đ</span>
                  </div>
                  {currentOption.phiHuyTonDong > 0 && (
                    <div className="flex justify-between items-center text-amber-700">
                      <span>Phí phạt tồn đọng (QT-05):</span>
                      <span className="font-black">+{currentOption.phiHuyTonDong.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                  {currentDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 font-black">
                      <span>Khuyến mại ({voucherCode}):</span>
                      <span>-{currentDiscount.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-2 flex justify-between items-center text-sm font-black text-gray-900">
                    <span>Tổng cước thanh toán:</span>
                    <span className="text-xl text-emerald-700 font-black">
                      {currentTotal.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleBooking}
                disabled={bookingLoading}
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 text-lg sm:text-xl cursor-pointer"
              >
                {bookingLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Đang kết nối tài xế...</span>
                  </>
                ) : (
                  <>
                    <Navigation2 className="w-6 h-6" />
                    <span>Đặt chuyến xe ngay</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTrip.trangThai !== "COMPLETED" &&
                activeTrip.trangThai !== "IN_PROGRESS" &&
                activeTrip.trangThai !== "CANCELLED" && (
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    className="w-full text-center text-sm font-black text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 py-4 rounded-2xl border-2 border-rose-200 transition-colors cursor-pointer"
                  >
                    Hủy chuyến (Xem lưu ý phạt QT-05)
                  </button>
                )}

              {activeTrip.trangThai === "COMPLETED" && (
                <button
                  onClick={() => {
                    setActiveTrip(null);
                    setDriverLocation(null);
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-black rounded-2xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Navigation2 className="w-5 h-5" />
                  <span>Đặt chuyến xe mới</span>
                </button>
              )}

              {activeTrip.trangThai === "CANCELLED" && (
                <button
                  onClick={() => {
                    setActiveTrip(null);
                    setDriverLocation(null);
                  }}
                  className="w-full py-4 bg-gray-900 hover:bg-black text-white text-base font-black rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Đóng & Đặt chuyến mới</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CỘT PHẢI: BẢN ĐỒ TOÀN MÀN HÌNH (CÓ HÌNH ĐƯỜNG ĐI POLYLINE & MARKERS NỔI BẬT) */}
      <div className="flex-1 h-full w-full bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-md border border-gray-200 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs sm:text-sm font-black text-gray-800">
            Bản đồ số định vị Nexus Mobility (Hà Nội)
          </span>
        </div>

        <ErrorBoundary
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-gray-500 bg-slate-50">
              <span className="text-4xl mb-3">🗺️</span>
              <p className="text-sm font-bold text-gray-700">Bản đồ đang chuẩn bị dữ liệu vị trí</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-md transition-all"
              >
                Tải lại bản đồ
              </button>
            </div>
          }
        >
          <MapView
            pickup={{ lat: pickup.viDo, lng: pickup.kinhDo }}
            dropoff={{ lat: dropoff.viDo, lng: dropoff.kinhDo }}
            driverLocation={driverLocation}
            waypoints={estimateData?.waypoints}
          />
        </ErrorBoundary>
      </div>

      {/* POPUP XÁC NHẬN HỦY CHUYẾN (QT-05) */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-lg text-gray-900">Xác nhận hủy chuyến xe?</h3>
                <span className="text-xs text-rose-600 font-bold">Ràng buộc Quy tắc QT-05</span>
              </div>
            </div>

            {(() => {
              const preview = getCancellationFeePreview();
              return (
                <div
                  className={`p-4 rounded-2xl mb-4 border ${
                    preview.isFree
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-rose-50 border-rose-300 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-sm">
                      {preview.isFree ? "✅ Miễn phí hủy chuyến" : "⚠️ Áp dụng phí phạt 10.000 VNĐ (QT-05)"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed font-semibold">{preview.message}</p>
                </div>
              );
            })()}

            <div className="mb-5">
              <label className="text-sm font-black text-gray-800 block mb-1.5">Lý do hủy:</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="Thay đổi kế hoạch">Thay đổi kế hoạch</option>
                <option value="Chờ tài xế quá lâu">Chờ tài xế quá lâu</option>
                <option value="Đặt nhầm điểm đón">Đặt nhầm điểm đón</option>
                <option value="Tìm được phương tiện khác">Tìm được phương tiện khác</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-black py-4 rounded-2xl transition-colors cursor-pointer"
              >
                Giữ chuyến xe
              </button>
              <button
                onClick={handleCancelTrip}
                disabled={cancelLoading}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-black py-4 rounded-2xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {cancelLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý hủy...</span>
                  </>
                ) : (
                  <span>Xác nhận hủy</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP KHO MÃ GIẢM GIÁ (QT-03) */}
      {voucherModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-100 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-gray-900">Kho mã giảm giá (QT-03)</h3>
                  <span className="text-xs text-gray-500 font-bold">Chọn 01 mã ưu đãi cho chuyến xe của bạn</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoucherModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 overflow-y-auto flex-1">
              {availableVouchers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm font-bold">
                  Hiện chưa có mã khuyến mại nào khả dụng
                </div>
              ) : (
                availableVouchers.map((v) => {
                  const isSelected = voucherCode === v.maVoucher;
                  return (
                    <div
                      key={v.id || v.maVoucher}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/70 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="space-y-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                            {v.maVoucher}
                          </span>
                          <span className="text-xs font-black text-gray-900">{v.tenChuongTrinh}</span>
                        </div>
                        <p className="text-xs text-gray-500 font-semibold">
                          {v.loaiGiamGia === "FIXED_AMOUNT"
                            ? `Giảm ${Number(v.giaTriGiam).toLocaleString("vi-VN")}đ`
                            : `Giảm ${v.giaTriGiam}% (tối đa ${Number(v.giamToiDa || 0).toLocaleString("vi-VN")}đ)`}
                          {" • "}
                          Đơn tối thiểu: {Number(v.dieuKienToiThieu).toLocaleString("vi-VN")}đ
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          Còn lại: {v.soLuong} lượt sử dụng
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setVoucherCode(isSelected ? "" : v.maVoucher);
                          setVoucherModalOpen(false);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex-shrink-0 ${
                          isSelected
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                        }`}
                      >
                        {isSelected ? "Bỏ chọn" : "Áp dụng"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setVoucherModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
