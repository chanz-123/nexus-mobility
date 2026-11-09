import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.context";
import { api } from "../api/client";
import {
  TrendingUp,
  Car,
  Ticket,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Database,
  Plus,
  LogIn,
  Loader2,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  Mail,
  Phone,
  DollarSign,
  AlertCircle,
  Trash2,
  Power,
  Layers,
} from "lucide-react";

type AdminTab = "overview" | "trips" | "drivers" | "vouchers" | "admins" | "debts" | "rules";

interface PendingAdmin {
  id: string;
  hoTen: string;
  email?: string | null;
  soDienThoai?: string | null;
  vaiTro: string;
  trangThai: string;
  createdAt: string;
  quanTriVien?: {
    phongBan?: string;
    chucVu?: string;
    ngayThamGia?: string;
  } | null;
}

export const AdminPage: React.FC = () => {
  const { user, quickLogin, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Tự động kích hoạt phiên Quản trị viên độc lập cho tab này khi mở /admin
  useEffect(() => {
    if (user && user.vaiTro !== "QUAN_TRI_VIEN") {
      refreshSession("QUAN_TRI_VIEN");
    }
  }, [user?.vaiTro, refreshSession]);

  // =========================================================================
  // 1. DỮ LIỆU THỐNG KÊ TOÀN HỆ THỐNG (METRICS)
  // =========================================================================
  const [metrics, setMetrics] = useState<any>(null);

  const fetchMetrics = async () => {
    try {
      const res = await api.get("/admin/metrics");
      setMetrics(res.data.data);
    } catch (err: any) {
      console.warn("Lỗi tải metrics hệ thống:", err);
    }
  };

  // =========================================================================
  // 2. GIÁM SÁT CHUYẾN XE (TRIPS MONITORING)
  // =========================================================================
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState<boolean>(false);
  const [tripFilter, setTripFilter] = useState<string>("ALL");

  const fetchTrips = async () => {
    try {
      setLoadingTrips(true);
      const res = await api.get("/admin/trips", {
        params: { status: tripFilter },
      });
      setTrips(res.data.data.trips || []);
    } catch (err: any) {
      console.warn("Lỗi tải danh sách chuyến xe:", err);
    } finally {
      setLoadingTrips(false);
    }
  };

  // =========================================================================
  // 3. ĐỘI NGŨ TÀI XẾ (DRIVERS FLEET)
  // =========================================================================
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState<boolean>(false);
  const [updatingDriverId, setUpdatingDriverId] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoadingDrivers(true);
      const res = await api.get("/admin/drivers");
      setDrivers(res.data.data.drivers || []);
    } catch (err: any) {
      console.warn("Lỗi tải danh sách tài xế:", err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleToggleDriverStatus = async (driverId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "SAN_SANG" ? "TAM_NGHI" : "SAN_SANG";
    try {
      setUpdatingDriverId(driverId);
      await api.patch(`/admin/drivers/${driverId}/status`, { status: nextStatus });
      await fetchDrivers();
      if (activeTab === "overview") fetchMetrics();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Không thể cập nhật trạng thái tài xế");
    } finally {
      setUpdatingDriverId(null);
    }
  };

  // =========================================================================
  // 4. MÃ KHUYẾN MẠI (VOUCHERS)
  // =========================================================================
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState<boolean>(false);
  const [newVoucherModal, setNewVoucherModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"FIXED_AMOUNT" | "PERCENTAGE">("FIXED_AMOUNT");
  const [newDiscount, setNewDiscount] = useState("20000");
  const [newMaxDiscount, setNewMaxDiscount] = useState("30000");
  const [newMinSpend, setNewMinSpend] = useState("40000");
  const [newQty, setNewQty] = useState("100");
  const [creatingVoucher, setCreatingVoucher] = useState(false);

  const fetchVouchers = async () => {
    try {
      setLoadingVouchers(true);
      const res = await api.get("/admin/vouchers");
      setVouchers(res.data.data.vouchers || []);
    } catch (err: any) {
      console.warn("Lỗi tải danh sách voucher:", err);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    try {
      setCreatingVoucher(true);
      await api.post("/trips/vouchers", {
        maVoucher: newCode.toUpperCase().trim(),
        tenChuongTrinh: newName.trim(),
        loaiGiamGia: newType,
        giaTriGiam: Number(newDiscount),
        giamToiDa: newType === "PERCENTAGE" && newMaxDiscount ? Number(newMaxDiscount) : undefined,
        dieuKienToiThieu: Number(newMinSpend),
        soLuong: Number(newQty),
      });
      alert(`Đã tạo thành công voucher ${newCode.toUpperCase()}!`);
      setNewVoucherModal(false);
      setNewCode("");
      setNewName("");
      await fetchVouchers();
      if (activeTab === "overview") fetchMetrics();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Không thể tạo mã voucher");
    } finally {
      setCreatingVoucher(false);
    }
  };

  const handleToggleVoucher = async (voucherId: string) => {
    try {
      await api.patch(`/admin/vouchers/${voucherId}/toggle`);
      await fetchVouchers();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Không thể đổi trạng thái mã");
    }
  };

  const handleDeleteVoucher = async (voucherId: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mã voucher "${code}" không?`)) return;
    try {
      await api.delete(`/admin/vouchers/${voucherId}`);
      await fetchVouchers();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Không thể xóa voucher");
    }
  };

  // =========================================================================
  // 5. PHÊ DUYỆT ADMIN (PENDING ADMINS)
  // =========================================================================
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState<boolean>(false);
  const [adminActionId, setAdminActionId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const fetchPendingAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await api.get("/auth/pending-admins");
      setPendingAdmins(res.data.data || []);
    } catch (err: any) {
      console.warn("Lỗi tải admin chờ duyệt:", err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleApproveAdmin = async (targetUserId: string, targetName: string) => {
    try {
      setAdminActionId(targetUserId);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);
      const res = await api.post(`/auth/approve-admin/${targetUserId}`);
      setActionSuccessMsg(res.data.message || `Đã phê duyệt thành công tài khoản cho ${targetName}`);
      await fetchPendingAdmins();
    } catch (err: any) {
      setActionErrorMsg(err.response?.data?.message || err.message || "Không thể phê duyệt tài khoản");
    } finally {
      setAdminActionId(null);
    }
  };

  const handleRejectAdmin = async (targetUserId: string, targetName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn từ chối yêu cầu đăng ký Quản trị viên của "${targetName}"?`)) {
      return;
    }
    try {
      setAdminActionId(targetUserId);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);
      const res = await api.post(`/auth/reject-admin/${targetUserId}`);
      setActionSuccessMsg(res.data.message || `Đã từ chối yêu cầu của ${targetName}`);
      await fetchPendingAdmins();
    } catch (err: any) {
      setActionErrorMsg(err.response?.data?.message || err.message || "Không thể từ chối tài khoản");
    } finally {
      setAdminActionId(null);
    }
  };

  // =========================================================================
  // 6. CÔNG NỢ & PHÍ PHẠT HỦY (DEBTS & PENALTIES)
  // =========================================================================
  const [debtsData, setDebtsData] = useState<{ unpaidInvoices: any[]; uncollectedPenalties: any[] }>({
    unpaidInvoices: [],
    uncollectedPenalties: [],
  });
  const [loadingDebts, setLoadingDebts] = useState<boolean>(false);

  const fetchDebts = async () => {
    try {
      setLoadingDebts(true);
      const res = await api.get("/admin/debts");
      setDebtsData(res.data.data);
    } catch (err: any) {
      console.warn("Lỗi tải dữ liệu công nợ:", err);
    } finally {
      setLoadingDebts(false);
    }
  };

  // Tải dữ liệu ban đầu khi vào trang
  useEffect(() => {
    if (user?.vaiTro === "QUAN_TRI_VIEN") {
      fetchMetrics();
      fetchPendingAdmins();
      fetchVouchers();
    }
  }, [user]);

  // Tải dữ liệu theo từng tab
  useEffect(() => {
    if (user?.vaiTro !== "QUAN_TRI_VIEN") return;
    if (activeTab === "overview") fetchMetrics();
    if (activeTab === "trips") fetchTrips();
    if (activeTab === "drivers") fetchDrivers();
    if (activeTab === "vouchers") fetchVouchers();
    if (activeTab === "admins") fetchPendingAdmins();
    if (activeTab === "debts") fetchDebts();
  }, [activeTab, tripFilter, user?.vaiTro]);

  // =========================================================================
  // XỬ LÝ KHI CHƯA PHẢI QUẢN TRỊ VIÊN
  // =========================================================================
  if (user?.vaiTro !== "QUAN_TRI_VIEN") {
    return (
      <div className="w-full h-full overflow-y-auto flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl shadow-2xl text-center border-2 border-gray-100">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-purple-200">
            <Shield className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-black text-gray-900">Yêu cầu quyền Quản trị viên</h3>
          <p className="text-sm text-gray-600 mt-2 mb-6 leading-relaxed">
            {user ? (
              <>
                Bạn đang đăng nhập với tài khoản <strong>{user.hoTen}</strong> (Vai trò: {user.vaiTro}). Phân hệ này dành riêng cho quản trị viên vận hành hệ thống.
              </>
            ) : (
              "Bạn chưa đăng nhập vào hệ thống. Vui lòng đăng nhập với tài khoản Quản trị viên để truy cập trung tâm điều hành."
            )}
          </p>

          <div className="space-y-3">
            <button
              onClick={async () => {
                setSwitching(true);
                try {
                  await quickLogin("0988888888");
                } finally {
                  setSwitching(false);
                }
              }}
              disabled={switching}
              className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg shadow-purple-700/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {switching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
              <span>1-Click Đăng nhập Vũ Đức Thắng (Admin)</span>
            </button>

            <button
              onClick={() => navigate("/auth?redirect=/admin")}
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

  // =========================================================================
  // GIAO DIỆN QUẢN TRỊ VIÊN TOÀN NĂNG (OPERATIONS COMMAND CENTER)
  // =========================================================================
  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* 1. HEADER DASHBOARD */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest block mb-1">
            Trung tâm Điều hành & Giám sát Hệ thống (Operations Command Center)
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Grab Operations Control Center</h2>
          <p className="text-xs text-gray-400 mt-1">
            Chỉ huy trưởng: <strong>{user?.hoTen}</strong> • Phòng ban: Trung tâm Điều hành • Phân hệ: Production
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {pendingAdmins.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("admins")}
              className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-black px-4 py-2 rounded-2xl border border-amber-500/30 animate-pulse cursor-pointer transition-colors"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{pendingAdmins.length} Quản trị viên chờ duyệt</span>
            </button>
          )}
          <span className="flex items-center gap-2 bg-emerald-500/10 text-emerald-300 text-xs font-black px-4 py-2 rounded-2xl border border-emerald-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Core Engine: 100% Khả dụng
          </span>
        </div>
      </div>

      {/* 2. THANH ĐIỀU HƯỚNG TABS QUẢN TRỊ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b-2 border-gray-100">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "overview"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Tổng quan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("trips")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "trips"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Giám sát Chuyến xe</span>
          {metrics?.soChuyenDangChay > 0 && (
            <span className="bg-amber-400 text-gray-950 text-[10px] px-1.5 py-0.5 rounded-full font-black">
              {metrics.soChuyenDangChay}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "drivers"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Đội ngũ Tài xế</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("vouchers")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "vouchers"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Mã Khuyến mại (QT-03)</span>
          {vouchers.length > 0 && (
            <span className="bg-emerald-200 text-emerald-950 text-[10px] px-1.5 py-0.5 rounded-full font-black">
              {vouchers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("admins")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "admins"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Duyệt Quản trị viên</span>
          {pendingAdmins.length > 0 && (
            <span className="bg-amber-400 text-gray-950 text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
              {pendingAdmins.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("debts")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "debts"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Công nợ & Phạt hủy (QT-04/05)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === "rules"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Kiểm định Quy tắc OOAD</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: TỔNG QUAN (OVERVIEW & LIVE METRICS)                             */}
      {/* ===================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in">
          {/* 4 Thẻ chỉ số chính */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-bold block">Tổng doanh thu thực tế</span>
                <span className="text-2xl font-black text-gray-900 mt-1.5 block">
                  {metrics ? `${metrics.tongDoanhThu.toLocaleString("vi-VN")}đ` : "0đ"}
                </span>
                <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                  Từ các chuyến hoàn thành & đã thanh toán
                </span>
              </div>
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-bold block">Tài xế sẵn sàng (QT-02)</span>
                <span className="text-2xl font-black text-gray-900 mt-1.5 block">
                  {metrics ? `${metrics.taiXeSanSang} / ${metrics.tongSoTaiXe} xe` : "0 xe"}
                </span>
                <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                  Đang trực tuyến trên Redis GEO
                </span>
              </div>
              <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Car className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-bold block">Số chuyến hoàn thành</span>
                <span className="text-2xl font-black text-gray-900 mt-1.5 block">
                  {metrics ? `${metrics.soChuyenThanhCong} chuyến` : "0 chuyến"}
                </span>
                <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                  Tỷ lệ hủy chuyến: {metrics?.tyLeHuy || 0}%
                </span>
              </div>
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-bold block">Mã giảm giá khả dụng</span>
                <span className="text-2xl font-black text-gray-900 mt-1.5 block">
                  {metrics ? `${metrics.soVoucherKhaDung} mã` : "0 mã"}
                </span>
                <span className="text-[11px] text-purple-600 font-bold mt-1 block">
                  QT-03 chống Race-Condition
                </span>
              </div>
              <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl">
                <Ticket className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Hàng chỉ số phụ: Công nợ QT-04, Phí phạt QT-05 & Khách hàng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-rose-50 to-orange-50 p-5 rounded-3xl border border-rose-200">
              <span className="text-xs font-black text-rose-800 uppercase block mb-1">
                Phạt hủy chuyến tồn đọng (QT-05)
              </span>
              <span className="text-xl font-black text-rose-900 block">
                {metrics ? `${metrics.phiPhatChuaThu.toLocaleString("vi-VN")}đ` : "0đ"}
              </span>
              <p className="text-xs text-rose-700 mt-1">
                Đang chờ tự động gộp thu vào chuyến tiếp theo ({metrics?.soKhoanPhatChuaThu || 0} lượt vi phạm).
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-3xl border border-emerald-200">
              <span className="text-xs font-black text-emerald-800 uppercase block mb-1">
                Tiền phạt hủy đã thu hồi
              </span>
              <span className="text-xl font-black text-emerald-900 block">
                {metrics ? `${metrics.phiPhatDaThu.toLocaleString("vi-VN")}đ` : "0đ"}
              </span>
              <p className="text-xs text-emerald-700 mt-1">
                Đã gộp thanh toán thành công ({metrics?.soKhoanPhatDaThu || 0} khoản phạt).
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-3xl border border-blue-200">
              <span className="text-xs font-black text-blue-800 uppercase block mb-1">
                Quy mô Khách hàng
              </span>
              <span className="text-xl font-black text-blue-900 block">
                {metrics ? `${metrics.tongSoKhachHang} tài khoản` : "0"}
              </span>
              <p className="text-xs text-blue-700 mt-1">
                Khách hàng đã đăng ký và sử dụng dịch vụ trên hệ thống.
              </p>
            </div>
          </div>

          {/* Phân bổ dịch vụ & Tình trạng vận hành */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
            <h3 className="font-black text-base text-gray-900 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Phân bổ Doanh thu & Chuyến đi theo Dịch vụ (QT-01)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics?.phanBoDichVu?.map((item: any) => (
                <div key={item.loaiDichVu} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wider block">
                    {item.loaiDichVu === "GRAB_BIKE"
                      ? "GrabBike"
                      : item.loaiDichVu === "GRAB_CAR_4"
                      ? "GrabCar 4 chỗ"
                      : "GrabCar 7 chỗ"}
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-bold">Số chuyến:</span>
                    <span className="text-sm font-black text-gray-900">{item.soChuyen} chuyến</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-bold">Doanh số:</span>
                    <span className="text-sm font-black text-emerald-700">
                      {item.doanhThu.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: GIÁM SÁT CHUYẾN XE (LIVE TRIP MONITORING)                       */}
      {/* ===================================================================== */}
      {activeTab === "trips" && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Giám sát Chuyến xe Toàn hệ thống</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Theo dõi tiến trình đặt cuốc, điều phối (QT-02), di chuyển và thanh toán theo thời gian thực.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className="bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PENDING">PENDING (Đang tìm tài xế)</option>
                <option value="ACCEPTED">ACCEPTED (Đã nhận cuốc)</option>
                <option value="ARRIVED">ARRIVED (Đã đến điểm đón)</option>
                <option value="IN_PROGRESS">IN_PROGRESS (Đang di chuyển)</option>
                <option value="COMPLETED">COMPLETED (Hoàn thành)</option>
                <option value="CANCELLED">CANCELLED (Đã hủy)</option>
              </select>

              <button
                type="button"
                onClick={fetchTrips}
                disabled={loadingTrips}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTrips ? "animate-spin text-emerald-600" : ""}`} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {loadingTrips ? (
            <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Đang tải danh sách chuyến xe...</span>
            </div>
          ) : trips.length === 0 ? (
            <div className="p-12 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200">
              <p className="text-xs font-black text-gray-600">Không có chuyến xe nào phù hợp bộ lọc</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Mã chuyến</th>
                    <th className="py-3 px-4">Khách hàng</th>
                    <th className="py-3 px-4">Tài xế & Xe</th>
                    <th className="py-3 px-4">Lộ trình</th>
                    <th className="py-3 px-4">Cước phí</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {trips.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-gray-900 block">
                          #{t.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          {t.loaiDichVu === "GRAB_BIKE"
                            ? "GrabBike"
                            : t.loaiDichVu === "GRAB_CAR_4"
                            ? "GrabCar 4c"
                            : "GrabCar 7c"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-black text-gray-900">{t.khachHang.hoTen}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{t.khachHang.soDienThoai}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {t.taiXe ? (
                          <div>
                            <span className="font-black text-gray-900 block">{t.taiXe.hoTen}</span>
                            <span className="bg-gray-100 text-gray-800 text-[10px] font-black px-1.5 py-0.5 rounded mr-1">
                              {t.taiXe.bienSoXe}
                            </span>
                            <span className="text-amber-500 text-[10px] font-bold">★ {t.taiXe.diemDanhGia}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">Chưa nhận (Đang tìm)</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="truncate text-gray-900 font-bold">
                          🟢 {t.diemDon || "Điểm đón"}
                        </div>
                        <div className="truncate text-gray-500 text-[11px]">
                          🔴 {t.diemTra || "Điểm đến"}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {t.quangDuongKm} km ~ {t.thoiGianDuKienPhut}p
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-black text-emerald-800 text-sm">
                          {t.soTienCuoiCung.toLocaleString("vi-VN")}đ
                        </div>
                        {t.tienGiam > 0 && (
                          <span className="text-[10px] text-emerald-600 block">
                            Voucher: -{t.tienGiam.toLocaleString("vi-VN")}đ
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {t.hoaDon?.phuongThucThanhToan || "TIEN_MAT"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                            t.trangThai === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : t.trangThai === "CANCELLED"
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : t.trangThai === "PENDING"
                              ? "bg-amber-100 text-amber-800 border-amber-200 animate-pulse"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }`}
                        >
                          {t.trangThai}
                        </span>
                        {t.lyDoHuy && (
                          <span className="block text-[10px] text-rose-600 mt-1 truncate max-w-[150px]">
                            {t.lyDoHuy}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {new Date(t.thoiGianDat).toLocaleTimeString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ĐỘI NGŨ TÀI XẾ (DRIVER FLEET)                                   */}
      {/* ===================================================================== */}
      {activeTab === "drivers" && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-600" />
                <span>Quản lý Đội ngũ Tài xế Toàn hệ thống</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Kiểm soát trạng thái hoạt động, giấy phép lái xe, phương tiện và đánh giá chất lượng tài xế.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchDrivers}
              disabled={loadingDrivers}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors self-start cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDrivers ? "animate-spin text-emerald-600" : ""}`} />
              <span>Làm mới danh sách</span>
            </button>
          </div>

          {loadingDrivers ? (
            <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Đang tải danh sách tài xế...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Tài xế</th>
                    <th className="py-3 px-4">Liên hệ</th>
                    <th className="py-3 px-4">Biển số & GPLX</th>
                    <th className="py-3 px-4">Loại dịch vụ</th>
                    <th className="py-3 px-4">Đánh giá sao</th>
                    <th className="py-3 px-4">Trạng thái khả dụng</th>
                    <th className="py-3 px-4 text-right">Can thiệp Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {drivers.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-black text-gray-900 block">{d.hoTen}</span>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {d.id}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-gray-900 font-bold">{d.soDienThoai}</div>
                        <div className="text-[11px] text-gray-500">{d.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="bg-gray-100 text-gray-900 text-xs font-black px-2 py-0.5 rounded-md border border-gray-200 block w-max">
                          {d.bienSoXe}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono block mt-0.5">
                          GPLX: {d.soGiayPhepLaiXe}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-black text-gray-800">
                        {d.loaiDichVu === "GRAB_BIKE"
                          ? "GrabBike"
                          : d.loaiDichVu === "GRAB_CAR_4"
                          ? "GrabCar 4 chỗ"
                          : "GrabCar 7 chỗ"}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-amber-500 font-black text-sm flex items-center gap-1">
                          ★ {d.diemDanhGia}
                        </span>
                        <span className="text-[10px] text-gray-400">({d.soLuotDanhGia} lượt đánh giá)</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                            d.trangThaiKhaDung === "SAN_SANG"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : d.trangThaiKhaDung === "DANG_DON_KHACH" || d.trangThaiKhaDung === "DANG_PHUC_VU"
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {d.trangThaiKhaDung}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleDriverStatus(d.id, d.trangThaiKhaDung)}
                          disabled={updatingDriverId === d.id}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer transition-colors ${
                            d.trangThaiKhaDung === "SAN_SANG"
                              ? "bg-gray-100 hover:bg-amber-50 text-gray-700 hover:text-amber-800 border border-gray-200"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          }`}
                        >
                          {updatingDriverId === d.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : d.trangThaiKhaDung === "SAN_SANG" ? (
                            "Cho tạm nghỉ"
                          ) : (
                            "Bật sẵn sàng"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: QUẢN LÝ MÃ KHUYẾN MẠI (QT-03 VOUCHERS)                          */}
      {/* ===================================================================== */}
      {activeTab === "vouchers" && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-emerald-600" />
                <span>Quản lý Mã Khuyến mại (Quy tắc QT-03)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cập nhật số lượng bằng Atomic Update trong Transaction ACID, chống Race Condition khi nhiều khách áp mã cùng lúc.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNewVoucherModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition-all self-start cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo mã Voucher mới</span>
            </button>
          </div>

          {loadingVouchers ? (
            <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Đang tải danh sách voucher...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Mã Voucher</th>
                    <th className="py-3 px-4">Chương trình</th>
                    <th className="py-3 px-4">Loại giảm</th>
                    <th className="py-3 px-4">Giá trị giảm</th>
                    <th className="py-3 px-4">Chi tiêu tối thiểu</th>
                    <th className="py-3 px-4">Số lượng còn</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {vouchers.map((v) => (
                    <tr key={v.id || v.maVoucher} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-black text-emerald-700 text-sm">{v.maVoucher}</td>
                      <td className="py-3.5 px-4 text-gray-900 font-bold">{v.tenChuongTrinh}</td>
                      <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">{v.loaiGiamGia}</td>
                      <td className="py-3.5 px-4 font-black text-gray-900">
                        {v.loaiGiamGia === "FIXED_AMOUNT"
                          ? `${Number(v.giaTriGiam).toLocaleString("vi-VN")}đ`
                          : `${v.giaTriGiam}%`}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {Number(v.dieuKienToiThieu).toLocaleString("vi-VN")}đ
                      </td>
                      <td className="py-3.5 px-4 font-black text-gray-900">{v.soLuong} lượt</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                            v.trangThai === "HOAT_DONG"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {v.trangThai}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleVoucher(v.id)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer"
                            title="Bật/Tắt trạng thái"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVoucher(v.id, v.maVoucher)}
                            className="p-1.5 bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-700 rounded-lg cursor-pointer"
                            title="Xóa voucher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: PHÊ DUYỆT QUẢN TRỊ VIÊN MỚI (PENDING ADMINS)                   */}
      {/* ===================================================================== */}
      {activeTab === "admins" && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-2xl border border-purple-200 mt-0.5">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-gray-900">
                    Phê duyệt Quản trị viên mới (Chờ kích hoạt)
                  </h3>
                  {pendingAdmins.length > 0 ? (
                    <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
                      {pendingAdmins.length} yêu cầu mới
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Đã kiểm duyệt toàn bộ
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Tài khoản đăng ký vai trò Quản trị viên phải được Quản trị viên hiện tại duyệt mới có quyền truy cập hệ thống.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchPendingAdmins}
              disabled={loadingAdmins}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors self-start cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmins ? "animate-spin text-purple-600" : ""}`} />
              <span>Làm mới danh sách</span>
            </button>
          </div>

          {/* THÔNG BÁO KẾT QUẢ THAO TÁC */}
          {actionSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-bold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionSuccessMsg(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {actionErrorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-900 font-bold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{actionErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionErrorMsg(null)}
                className="text-rose-700 hover:text-rose-900 text-xs ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {loadingAdmins && pendingAdmins.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Đang kiểm tra danh sách chờ duyệt...</span>
            </div>
          ) : pendingAdmins.length === 0 ? (
            <div className="p-8 bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-black text-gray-800">
                Hiện không có yêu cầu đăng ký Quản trị viên nào đang chờ duyệt
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Mọi tài khoản quản trị viên mới đăng ký từ giao diện Đăng ký sẽ xuất hiện tại đây để bạn phê duyệt.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b">
                  <tr>
                    <th className="py-3 px-4">Họ và tên</th>
                    <th className="py-3 px-4">Thông tin liên hệ</th>
                    <th className="py-3 px-4">Phòng ban & Chức vụ</th>
                    <th className="py-3 px-4">Thời gian đăng ký</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {pendingAdmins.map((adm) => (
                    <tr key={adm.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-gray-900">{adm.hoTen}</div>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {adm.id}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {adm.email && (
                            <div className="flex items-center gap-1.5 text-gray-700 font-bold">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <span>{adm.email}</span>
                            </div>
                          )}
                          {adm.soDienThoai && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span>{adm.soDienThoai}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-purple-900">
                          {adm.quanTriVien?.phongBan || "Vận hành"}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {adm.quanTriVien?.chucVu || "Quản trị viên"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(adm.createdAt).toLocaleString("vi-VN")}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1 w-max">
                          <Clock className="w-3 h-3" />
                          Chờ duyệt (Khóa)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveAdmin(adm.id, adm.hoTen)}
                            disabled={adminActionId === adm.id}
                            className="flex items-center gap-1 bg-[#00B14F] hover:bg-[#008A3D] disabled:bg-gray-300 text-white font-black px-3.5 py-1.5 rounded-xl shadow-sm text-xs cursor-pointer transition-colors"
                          >
                            {adminActionId === adm.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            <span>Phê duyệt</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRejectAdmin(adm.id, adm.hoTen)}
                            disabled={adminActionId === adm.id}
                            className="flex items-center gap-1 bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-700 font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-xs cursor-pointer transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: CÔNG NỢ & PHÍ PHẠT HỦY (DEBTS & PENALTIES)                       */}
      {/* ===================================================================== */}
      {activeTab === "debts" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Danh sách nợ cước QT-04 */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <span>Danh sách Khách hàng nợ cước (Ràng buộc QT-04)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Các chuyến xe đã hoàn thành nhưng chưa thanh toán hóa đơn. Hệ thống tự động chặn các tài khoản này đặt xe mới.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchDebts}
                disabled={loadingDebts}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDebts ? "animate-spin text-rose-600" : ""}`} />
                <span>Làm mới</span>
              </button>
            </div>

            {debtsData.unpaidInvoices.length === 0 ? (
              <div className="p-6 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-2xl text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-black text-emerald-900">Không có khách hàng nào đang nợ cước</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b">
                    <tr>
                      <th className="py-3 px-4">Khách hàng</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Mã chuyến nợ</th>
                      <th className="py-3 px-4">Số tiền nợ</th>
                      <th className="py-3 px-4">Thời gian hoàn thành</th>
                      <th className="py-3 px-4">Trạng thái đặt xe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {debtsData.unpaidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-black text-gray-900">{inv.khachHang.hoTen}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-700">{inv.khachHang.soDienThoai}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-500">#{inv.chuyenXeId.slice(-6).toUpperCase()}</td>
                        <td className="py-3.5 px-4 font-black text-rose-600 text-sm">
                          {inv.soTien.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">{new Date(inv.thoiGianDat).toLocaleString("vi-VN")}</td>
                        <td className="py-3.5 px-4">
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                            🔒 Đang bị chặn (QT-04)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Danh sách phạt hủy chưa thu QT-05 */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span>Các khoản Phạt hủy chuyến 10.000 VNĐ đang tồn đọng (QT-05)</span>
            </h3>
            <p className="text-xs text-gray-500">
              Khách hàng hủy chuyến khi tài xế đã di chuyển đón &gt; 5 phút. Khoản tiền này sẽ tự động gộp vào chuyến đặt tiếp theo.
            </p>

            {debtsData.uncollectedPenalties.length === 0 ? (
              <div className="p-6 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-2xl text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-1.5" />
                <p className="text-xs font-black text-emerald-900">Không có khoản phạt hủy nào đang tồn đọng</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b">
                    <tr>
                      <th className="py-3 px-4">Khách hàng vi phạm</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Thời gian tài xế đón</th>
                      <th className="py-3 px-4">Tiền phạt</th>
                      <th className="py-3 px-4">Lý do hủy</th>
                      <th className="py-3 px-4">Thời gian hủy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {debtsData.uncollectedPenalties.map((pen) => (
                      <tr key={pen.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-black text-gray-900">{pen.khachHang.hoTen}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-700">{pen.khachHang.soDienThoai}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-800">{pen.soPhutTaiXeDiChuyen} phút (&gt; 5p)</td>
                        <td className="py-3.5 px-4 font-black text-amber-900 text-sm">
                          {pen.phiHuyChuyen.toLocaleString("vi-VN")}đ
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">{pen.lyDoHuy}</td>
                        <td className="py-3.5 px-4 text-gray-500">{new Date(pen.thoiGianHuy).toLocaleString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: KIỂM ĐỊNH QUY TẮC OOAD & ARCHITECTURE                          */}
      {/* ===================================================================== */}
      {activeTab === "rules" && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl border border-gray-100 space-y-5 animate-in fade-in">
          <div>
            <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              Kiểm định Kiến trúc 13 Thực thể & 5 Ràng buộc Nghiệp vụ (QT-01 ➔ QT-05)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Toàn bộ hệ thống Backend và Frontend được chuẩn hóa theo đúng đặc tả OOAD.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4.5 rounded-3xl bg-gray-50 border border-gray-200">
              <span className="font-black text-xs text-gray-900 block mb-1">QT-01: Định giá tự động</span>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Cước = (Cự ly km × Đơn giá) + Phụ phí. Xử lý dưới 2 giây qua Map Adapter Factory.
              </p>
              <span className="text-[11px] font-black text-emerald-600 mt-2.5 block">✓ ĐÃ THỰC THI CHẶT CHẼ</span>
            </div>

            <div className="p-4.5 rounded-3xl bg-gray-50 border border-gray-200">
              <span className="font-black text-xs text-gray-900 block mb-1">QT-02: Điều phối 15s đếm ngược</span>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Quét Redis GEO trong bán kính 5km. Mời độc quyền từng tài xế với 15s đếm ngược. Tự động chuyển tài xế kế tiếp nếu timeout.
              </p>
              <span className="text-[11px] font-black text-emerald-600 mt-2.5 block">✓ ĐÃ THỰC THI CHẶT CHẼ</span>
            </div>

            <div className="p-4.5 rounded-3xl bg-gray-50 border border-gray-200">
              <span className="font-black text-xs text-gray-900 block mb-1">QT-03: Áp mã Khuyến mại</span>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Tối đa 01 voucher/chuyến. Trừ số lượng bằng Atomic Update trong Database Transaction, chống Race Condition. Tự động hoàn lại số lượng nếu hủy chuyến.
              </p>
              <span className="text-[11px] font-black text-emerald-600 mt-2.5 block">✓ ĐÃ THỰC THI CHẶT CHẼ</span>
            </div>

            <div className="p-4.5 rounded-3xl bg-gray-50 border border-gray-200">
              <span className="font-black text-xs text-gray-900 block mb-1">QT-04: Ràng buộc Công nợ</span>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Chặn tạo chuyến xe mới nếu khách có hóa đơn cũ đang ở trạng thái CHUA_THANH_TOAN (mã lỗi 403 Forbidden).
              </p>
              <span className="text-[11px] font-black text-emerald-600 mt-2.5 block">✓ ĐÃ THỰC THI CHẶT CHẼ</span>
            </div>

            <div className="p-4.5 rounded-3xl bg-gray-50 border border-gray-200">
              <span className="font-black text-xs text-gray-900 block mb-1">QT-05: Phí phạt hủy chuyến</span>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Nếu khách hủy khi tài xế đã di chuyển đón &gt; 5 phút, tự động áp phí phạt 10.000 VNĐ và cộng vào hóa đơn chuyến xe kế tiếp.
              </p>
              <span className="text-[11px] font-black text-emerald-600 mt-2.5 block">✓ ĐÃ THỰC THI CHẶT CHẼ</span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL TẠO VOUCHER MỚI (QT-03)                                         */}
      {/* ===================================================================== */}
      {newVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="font-black text-lg text-gray-900">Tạo mã Voucher khuyến mại mới</h3>
              <button
                type="button"
                onClick={() => setNewVoucherModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Mã Voucher (viết hoa):</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="VD: GRABSUMMER"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-black uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tên chương trình:</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Giảm 30.000đ chào hè"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Loại giảm giá:</label>
                  <select
                    value={newType}
                    onChange={(e: any) => setNewType(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold"
                  >
                    <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
                    <option value="PERCENTAGE">Phần trăm (%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    {newType === "FIXED_AMOUNT" ? "Số tiền giảm (VNĐ):" : "Phần trăm giảm (%):"}
                  </label>
                  <input
                    type="number"
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              {newType === "PERCENTAGE" && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Giảm tối đa (VNĐ):</label>
                  <input
                    type="number"
                    value={newMaxDiscount}
                    onChange={(e) => setNewMaxDiscount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Chi tiêu tối thiểu (VNĐ):</label>
                  <input
                    type="number"
                    value={newMinSpend}
                    onChange={(e) => setNewMinSpend(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Số lượng phát hành:</label>
                  <input
                    type="number"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setNewVoucherModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-xs cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creatingVoucher}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  {creatingVoucher ? "Đang lưu..." : "Tạo Voucher ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
