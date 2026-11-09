import React, { useState, useEffect } from "react";
import { useAuth, DEMO_ACCOUNTS, formatAuthErrorMessage } from "../context/auth.context";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { BrandLogo } from "../components/BrandLogo";
import {
  Lock,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Car,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Shield,
  KeyRound,
  Check,
  Globe,
  Send,
} from "lucide-react";

// Vector minh họa xe máy Grab Rider khớp ảnh mẫu
const GrabScooterHeroIllustration: React.FC = () => {
  return (
    <div className="w-full bg-[#EBF7F0] rounded-[28px] overflow-hidden p-3.5 sm:p-4 flex items-center justify-center relative shadow-sm border border-[#00B14F]/10">
      <svg
        viewBox="0 0 380 200"
        className="w-full max-h-[175px] drop-shadow-sm select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Nền nhà phố tối giản mờ */}
        <rect x="75" y="60" width="46" height="95" rx="4" fill="#CEEBD9" opacity="0.8" />
        <rect x="85" y="70" width="8" height="12" rx="1.5" fill="#E8F7EE" />
        <rect x="101" y="70" width="8" height="12" rx="1.5" fill="#E8F7EE" />
        <rect x="85" y="90" width="8" height="12" rx="1.5" fill="#E8F7EE" />
        <rect x="101" y="90" width="8" height="12" rx="1.5" fill="#E8F7EE" />

        <rect x="127" y="40" width="40" height="115" rx="4" fill="#BCE4CC" opacity="0.85" />
        <rect x="137" y="50" width="8" height="35" rx="1" fill="#E8F7EE" />
        <rect x="151" y="50" width="8" height="35" rx="1" fill="#E8F7EE" />

        <rect x="250" y="50" width="48" height="105" rx="4" fill="#CEEBD9" opacity="0.8" />
        <rect x="260" y="63" width="10" height="12" rx="1.5" fill="#E8F7EE" />
        <rect x="276" y="63" width="10" height="12" rx="1.5" fill="#E8F7EE" />
        <rect x="260" y="83" width="10" height="12" rx="1.5" fill="#E8F7EE" />
        <rect x="276" y="83" width="10" height="12" rx="1.5" fill="#E8F7EE" />

        {/* Cành lá 2 bên */}
        <g opacity="0.9">
          <path d="M72 140C62 130 62 110 74 100C76 112 74 130 72 140Z" fill="#52A478" />
          <path d="M75 140C85 130 88 115 80 105C76 115 75 130 75 140Z" fill="#75C299" />
          <path d="M55 150C48 140 50 127 60 120C62 130 60 143 55 150Z" fill="#67B68B" />
          <path d="M73 165L73 135" stroke="#468B66" strokeWidth="2.5" strokeLinecap="round" />

          <path d="M310 140C320 130 320 110 308 100C306 112 308 130 310 140Z" fill="#52A478" />
          <path d="M307 140C297 130 294 115 302 105C306 115 307 130 307 140Z" fill="#75C299" />
          <path d="M327 150C334 140 332 127 322 120C320 130 322 143 327 150Z" fill="#67B68B" />
          <path d="M309 165L309 135" stroke="#468B66" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Bánh xe sau */}
        <circle cx="152" cy="150" r="22" fill="#1C3829" />
        <circle cx="152" cy="150" r="14" fill="#EBF7F0" />
        <circle cx="152" cy="150" r="7" fill="#008A3D" />

        {/* Bánh xe trước */}
        <circle cx="266" cy="150" r="22" fill="#1C3829" />
        <circle cx="266" cy="150" r="14" fill="#EBF7F0" />
        <circle cx="266" cy="150" r="7" fill="#008A3D" />

        {/* Khung thân xe Grab Scooter */}
        <path
          d="M130 133C130 127 134 123 140 123H190L198 143H225L245 105H265L248 147H230L215 130H180L170 147H136C132 147 130 143 130 139V133Z"
          fill="#00B14F"
        />
        <path d="M140 123H190V131H135C135 127 137 123 140 123Z" fill="#008A3D" />

        {/* Yên xe */}
        <path
          d="M142 119C142 115 146 112 150 112H196C200 112 204 115 204 119V123H142V119Z"
          fill="#1C2430"
        />

        {/* Chắn bùn trước và tay lái */}
        <path d="M245 105L254 85H262L254 107L245 105Z" fill="#008A3D" />
        <rect x="252" y="81" width="16" height="5" rx="2.5" fill="#1C2430" />
        <path d="M264 100L274 102V110L264 108V100Z" fill="#FFFFFF" />

        {/* Người lái - Quần áo & Chân */}
        <path d="M188 117L204 135L216 135L202 115H188Z" fill="#1A4329" />
        <path d="M202 133L220 143H234L228 137L212 130L202 133Z" fill="#1C2430" />
        <path d="M218 141H238C240 141 242 143 241 145L239 149H216L218 141Z" fill="#FFFFFF" />
        <rect x="216" y="147" width="24" height="2" fill="#1C3829" />

        {/* Áo người lái */}
        <path d="M192 73C182 77 178 90 180 105L194 117L214 113L216 87L204 73H192Z" fill="#FDF8EE" />
        <path d="M198 79L225 97L235 93L212 75L198 79Z" fill="#FDF8EE" />

        {/* Cánh tay & Bàn tay */}
        <path d="M225 97L254 87L258 92L231 101L225 97Z" fill="#F8D3B3" />
        <circle cx="258" cy="88" r="5" fill="#F8D3B3" />

        {/* Cổ & Mặt */}
        <path d="M204 63H214V73H204V63Z" fill="#F8D3B3" />
        <path d="M208 50C208 45 214 39 222 39C230 39 236 45 236 53C236 59 231 64 224 64H214L208 50Z" fill="#F8D3B3" />
        <path d="M232 53L226 55L230 58H234L232 53Z" fill="#F1BE96" />

        {/* Mũ bảo hiểm Grab xanh */}
        <path d="M204 47C204 33 215 25 230 25C245 25 254 35 252 49H204V47Z" fill="#00B14F" />
        <path d="M200 47H255C257 47 258 49 256 51L252 53H202L200 47Z" fill="#008A3D" />
        <path d="M208 51L214 62L218 61L213 51H208Z" fill="#1C3829" />

        {/* Bóng xe */}
        <ellipse cx="208" cy="175" rx="90" ry="7" fill="#CCE8D7" opacity="0.7" />
      </svg>
    </div>
  );
};

// Hàm nhận diện thời gian thực SĐT vs Email
const detectType = (val: string): "EMPTY" | "PHONE" | "EMAIL" => {
  const trimmed = val.trim();
  if (!trimmed) return "EMPTY";
  if (trimmed.includes("@") || /[a-zA-Z]/.test(trimmed)) {
    return "EMAIL";
  }
  return "PHONE";
};

const checkValidPhone = (phone: string): boolean => {
  let cleaned = phone.trim().replace(/[\s().-]/g, "");
  if (cleaned.startsWith("+84")) cleaned = "0" + cleaned.slice(3);
  else if (cleaned.startsWith("84") && cleaned.length === 11) cleaned = "0" + cleaned.slice(2);
  else if (/^[35789][0-9]{8}$/.test(cleaned)) cleaned = "0" + cleaned;
  return /^0(3|5|7|8|9)[0-9]{8}$/.test(cleaned);
};

const checkValidEmail = (email: string): boolean => {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim().toLowerCase());
};

export const AuthPage: React.FC = () => {
  const { login, register, quickLogin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);

  // TAB CHÍNH: ĐĂNG NHẬP HOẶC ĐĂNG KÝ
  const [tab, setTab] = useState<"LOGIN" | "REGISTER">("LOGIN");

  // Ô NHẬP DUY NHẤT: SỐ ĐIỆN THOẠI HOẶC EMAIL
  const [identifier, setIdentifier] = useState<string>(() => {
    return localStorage.getItem("grab_saved_account") || "";
  });

  // Mật khẩu & thông tin tài khoản
  const [matKhau, setMatKhau] = useState<string>("Grab@2026");
  const [xacNhanMatKhau, setXacNhanMatKhau] = useState<string>("Grab@2026");
  const [hoTen, setHoTen] = useState<string>("");
  const [vaiTro, setVaiTro] = useState<"KHACH_HANG" | "TAI_XE" | "QUAN_TRI_VIEN">("KHACH_HANG");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [rememberAccount, setRememberAccount] = useState<boolean>(true);

  // Dành riêng cho đối tác tài xế
  const [soGiayPhepLaiXe, setSoGiayPhepLaiXe] = useState<string>("790123456789");
  const [bienSoXe, setBienSoXe] = useState<string>("29A-999.99");
  const [loaiDichVu, setLoaiDichVu] = useState<"GRAB_BIKE" | "GRAB_CAR_4" | "GRAB_CAR_7">("GRAB_CAR_4");

  // Dành riêng cho quản trị viên
  const [phongBan, setPhongBan] = useState<string>("Vận hành");
  const [chucVu, setChucVu] = useState<string>("Chuyên viên điều phối");

  // Mã xác thực OTP (bắt buộc dành riêng cho Đăng ký)
  const [registerOtpCode, setRegisterOtpCode] = useState<string>("");

  // Trạng thái gửi OTP & Cooldown
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [realEmailSent, setRealEmailSent] = useState<boolean>(false);

  // Loading & Thông báo
  const [loading, setLoading] = useState<boolean>(false);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Toggle bảng tài khoản kiểm thử
  const [showDemoDrawer, setShowDemoDrawer] = useState<boolean>(false);
  const [quickLoadingTarget, setQuickLoadingTarget] = useState<string | null>(null);

  // Ngôn ngữ
  const [currentLang, setCurrentLang] = useState<"vi" | "en">("vi");

  // Nhận diện kiểu identifier hiện tại
  const currentType = detectType(identifier);

  // Đếm ngược gửi lại OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const getSafeRedirectTarget = (role: string): string => {
    const rawParam = queryParams.get("redirect");
    const stateFrom = (location.state as any)?.from;
    const target = rawParam || (typeof stateFrom === "string" ? stateFrom : stateFrom?.pathname);

    if (target && typeof target === "string" && !target.startsWith("/auth")) {
      // Ngăn ngừa chuyển nhầm tài khoản không đủ quyền
      if (target.startsWith("/admin") && role !== "QUAN_TRI_VIEN") return "/";
      if (target.startsWith("/driver") && role !== "TAI_XE") return "/";
      return target;
    }

    if (role === "TAI_XE") return "/driver";
    if (role === "QUAN_TRI_VIEN") return "/admin";
    return "/";
  };

  const redirectByRole = (role: string) => {
    const target = getSafeRedirectTarget(role);
    navigate(target, { replace: true });
  };

  // Tự động chuyển hướng nếu phiên đăng nhập đã tồn tại
  useEffect(() => {
    if (user) {
      redirectByRole(user.vaiTro);
    }
  }, [user]);

  // Kiểm tra tính hợp lệ của input
  const isInputValid = (): boolean => {
    const trimmed = identifier.trim();
    if (!trimmed) return false;
    if (currentType === "EMAIL") return checkValidEmail(trimmed);
    if (currentType === "PHONE") return checkValidPhone(trimmed);
    return false;
  };

  // GỬI MÃ OTP (Thực tế qua SMTP Email hoặc SMS SĐT)
  // GỬI MÃ XÁC THỰC OTP (Dành riêng cho Đăng ký)
  const handleSendRegisterOtp = async (targetOverride?: string) => {
    const target = (targetOverride || identifier).trim();
    if (!target) {
      setError("Vui lòng nhập Số điện thoại hoặc Email trước khi nhận mã OTP");
      return false;
    }

    const type = detectType(target);
    if (type === "EMAIL" && !checkValidEmail(target)) {
      setError("Địa chỉ Email chưa đúng định dạng (Ví dụ: ban@gmail.com)");
      return false;
    }
    if (type === "PHONE" && !checkValidPhone(target)) {
      setError("Số điện thoại không hợp lệ (Ví dụ: 0901234567 hoặc 901234567)");
      return false;
    }

    setSendingOtp(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.post("/auth/send-otp", { taiKhoan: target });
      const data = res.data.data;

      setOtpCooldown(60);
      setRealEmailSent(Boolean(data.realEmailSent));

      if (data.realEmailSent) {
        setSuccessMsg(
          `Mã OTP xác thực đã được gửi về email thực ${data.recipient}. Vui lòng mở Hộp thư đến (hoặc Spam)!`
        );
      } else {
        setSuccessMsg(res.data.message || `Mã xác thực OTP đã gửi thành công tới ${data.recipient || target}!`);
      }
      return true;
    } catch (err: any) {
      setError(formatAuthErrorMessage(err));
      return false;
    } finally {
      setSendingOtp(false);
    }
  };

  // ĐĂNG NHẬP BẰNG MẬT KHẨU (Email hoặc Số điện thoại + Mật khẩu, KHÔNG CẦN OTP)
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = identifier.trim();

    if (!cleanTarget) {
      setError("Vui lòng nhập Số điện thoại hoặc Email");
      return;
    }

    if (!isInputValid()) {
      setError(
        currentType === "EMAIL"
          ? "Địa chỉ Email chưa đúng định dạng"
          : "Số điện thoại di động chưa đúng định dạng"
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (rememberAccount) {
      localStorage.setItem("grab_saved_account", cleanTarget);
    }

    try {
      const loggedInUser = await login(cleanTarget, matKhau);
      setSuccessMsg(`Đăng nhập thành công! Đang chuyển hướng...`);
      redirectByRole(loggedInUser.vaiTro);
    } catch (err: any) {
      setError(err.message || formatAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ĐĂNG KÝ TÀI KHOẢN MỚI
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = identifier.trim();

    if (!cleanTarget) {
      setError("Vui lòng nhập Số điện thoại hoặc Email để đăng ký");
      return;
    }

    if (!isInputValid()) {
      setError(
        currentType === "EMAIL"
          ? "Địa chỉ Email chưa đúng định dạng (VD: ban@gmail.com)"
          : "Số điện thoại di động chưa đúng định dạng (VD: 0901234567)"
      );
      return;
    }

    if (!hoTen.trim()) {
      setError("Vui lòng nhập đầy đủ Họ và tên");
      return;
    }

    if (matKhau.length < 6) {
      setError("Mật khẩu phải có tối thiểu 6 ký tự");
      return;
    }

    if (matKhau !== xacNhanMatKhau) {
      setError("Mật khẩu xác nhận không khớp với mật khẩu đã nhập");
      return;
    }

    if (!registerOtpCode || registerOtpCode.trim().length !== 6) {
      setError("Vui lòng bấm 'Gửi mã OTP' và nhập đủ 6 chữ số mã xác thực OTP để hoàn tất đăng ký");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        taiKhoan: cleanTarget,
        matKhau,
        hoTen: hoTen.trim(),
        vaiTro,
        otpCode: registerOtpCode.trim(),
      };

      if (cleanTarget.includes("@")) {
        payload.email = cleanTarget;
      } else {
        payload.soDienThoai = cleanTarget;
      }

      if (vaiTro === "TAI_XE") {
        payload.soGiayPhepLaiXe = soGiayPhepLaiXe.trim();
        payload.bienSoXe = bienSoXe.trim();
        payload.loaiDichVu = loaiDichVu;
      } else if (vaiTro === "QUAN_TRI_VIEN") {
        payload.phongBan = phongBan.trim();
        payload.chucVu = chucVu.trim();
      }

      const registeredUser: any = await register(payload);
      if (registeredUser?.pendingApproval || vaiTro === "QUAN_TRI_VIEN") {
        setSuccessMsg(
          "Đăng ký thành công! Tài khoản Quản trị viên cần được Quản trị viên hiện tại duyệt trước khi có thể đăng nhập."
        );
        setTimeout(() => {
          setTab("LOGIN");
        }, 3000);
      } else {
        setSuccessMsg(`Tạo tài khoản thành công! Đang chuyển hướng...`);
        setTimeout(() => redirectByRole(registeredUser.vaiTro), 500);
      }
    } catch (err: any) {
      setError(err.message || formatAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Tester Login
  const handleQuickLogin = async (targetId: string, fallbackRole: string) => {
    try {
      setQuickLoadingTarget(targetId);
      setError(null);
      setSuccessMsg(null);
      const loggedIn = await quickLogin(targetId);
      const role = loggedIn?.vaiTro || fallbackRole;
      redirectByRole(role);
    } catch (err: any) {
      setError(err.message || formatAuthErrorMessage(err));
    } finally {
      setQuickLoadingTarget(null);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F5F6F8] flex flex-col justify-between items-center px-4 py-5 sm:py-8 text-[#1C1C1C]">
      {/* KHUNG CARD CHUẨN THIẾT KẾ GRAB */}
      <div className="w-full max-w-[430px] bg-white rounded-[32px] shadow-xl shadow-gray-200/70 border border-gray-100 p-5 sm:p-7 relative flex flex-col justify-between my-auto">
        
        <div>
          {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG: LOGO THƯƠNG HIỆU + NGÔN NGỮ */}
          <header className="flex items-center justify-between w-full mb-4">
            <BrandLogo theme="nexus" size="sm" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentLang(currentLang === "vi" ? "en" : "vi")}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200/70 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-gray-600" />
                <span>{currentLang === "vi" ? "Tiếng Việt" : "English"}</span>
              </button>
            </div>
          </header>

          {/* BANNER MINH HỌA HERO: HÌNH ẢNH GRAB RIDER THEO ẢNH MẪU */}
          <div className="mb-5 animate-in fade-in">
            <GrabScooterHeroIllustration />
            <div className="space-y-1.5 pt-3">
              <h1 className="text-[25px] sm:text-[27px] font-black text-[#1C1C1C] leading-[1.15] tracking-tight">
                Đi đâu cũng gần,
                <br />
                có Grab đồng hành.
              </h1>
              <p className="text-xs sm:text-[13px] text-gray-500 font-medium leading-relaxed">
                {tab === "LOGIN"
                  ? "Đăng nhập bằng số điện thoại hoặc email để bắt đầu chuyến đi của bạn."
                  : "Đăng ký tài khoản mới bằng số điện thoại hoặc email để đồng hành cùng Grab."}
              </p>
            </div>
          </div>

          {/* TAB CHUYỂN ĐỔI CHÍNH: [ ĐĂNG NHẬP ] vs [ ĐĂNG KÝ ] */}
          <div className="flex items-center bg-[#F2F4F7] p-1 rounded-2xl mb-4 select-none">
            <button
              type="button"
              onClick={() => {
                setTab("LOGIN");
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "LOGIN"
                  ? "bg-white text-[#00853E] shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#00B14F]" />
              <span>Đăng nhập</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab("REGISTER");
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "REGISTER"
                  ? "bg-white text-[#00853E] shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <User className="w-3.5 h-3.5 text-[#00B14F]" />
              <span>Đăng ký</span>
            </button>
          </div>

          {/* THÔNG BÁO LỖI NẾU CÓ */}
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* THÔNG BÁO THÀNH CÔNG */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{successMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* PHẦN ĐĂNG NHẬP (EMAIL HOẶC SĐT + MẬT KHẨU, KHÔNG CẦN OTP) */}
          {/* ======================================================== */}
          {tab === "LOGIN" && (
            <form onSubmit={handlePasswordLoginSubmit} className="space-y-4 animate-in fade-in">
              {/* Ô NHẬP DUY NHẤT: SỐ ĐIỆN THOẠI HOẶC EMAIL (KHỚP 100% ẢNH MẪU) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-[#1C1C1C]">
                    Số điện thoại hoặc Email
                  </label>
                  {currentType === "EMAIL" && (
                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-600" />
                      <span>Email</span>
                    </span>
                  )}
                  {currentType === "PHONE" && (
                    <span className="text-[10px] font-black text-[#00853E] bg-[#E8F8EE] px-2 py-0.5 rounded-full border border-[#00B14F]/30 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#00B14F]" />
                      <span>SĐT (+84)</span>
                    </span>
                  )}
                </div>

                {/* Ô NHẬP VIỀN XANH GRAB THEO ẢNH */}
                <div className="relative flex items-center w-full bg-white border-2 border-[#00B14F] rounded-2xl p-1 transition-all focus-within:ring-4 focus-within:ring-[#00B14F]/15">
                  {currentType === "EMAIL" ? (
                    <div className="flex items-center gap-1 pl-3 pr-2.5 py-1.5 text-xs font-black text-blue-700 border-r border-gray-200 select-none">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Email</span>
                    </div>
                  ) : currentType === "PHONE" ? (
                    <div className="flex items-center gap-1 pl-3 pr-2.5 py-1.5 text-sm font-black text-[#1C1C1C] border-r border-gray-200 select-none">
                      <span className="text-base leading-none">🇻🇳</span>
                      <span>+84</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 pl-3 pr-2 py-1.5 text-[11px] font-black text-gray-500 border-r border-gray-200 select-none">
                      <span>🇻🇳 +84</span>
                      <span className="text-gray-300">/</span>
                      <Mail className="w-3 h-3 text-gray-400" />
                    </div>
                  )}

                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={currentType === "EMAIL" ? "buithutrang149506@gmail.com" : "090 123 4567 hoặc email"}
                    className="w-full bg-transparent border-none py-2.5 px-3 text-sm sm:text-base font-bold text-[#1C1C1C] focus:outline-none placeholder-gray-400"
                    required
                  />

                  {isInputValid() && (
                    <div className="pr-3 text-emerald-600">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Ô NHẬP MẬT KHẨU */}
              <div>
                <label className="text-xs font-black text-[#1C1C1C] block mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={matKhau}
                    onChange={(e) => setMatKhau(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    required
                    className="w-full bg-[#F9FAFB] border border-gray-300 rounded-2xl pl-11 pr-11 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00B14F] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* GHI NHỚ ĐĂNG NHẬP */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(e) => setRememberAccount(e.target.checked)}
                    className="w-4 h-4 text-[#00B14F] rounded border-gray-300 focus:ring-[#00B14F]"
                  />
                  <span className="text-xs font-bold text-gray-600">Ghi nhớ tài khoản này</span>
                </label>
              </div>

              {/* NÚT TIẾP TỤC (KHỚP NGUYÊN BẢN ẢNH MẪU GRAB) */}
              <button
                type="submit"
                disabled={loading || !identifier.trim() || !matKhau}
                className="w-full bg-[#00B14F] hover:bg-[#008A3D] active:scale-[0.99] text-white font-black py-4 rounded-2xl shadow-lg shadow-[#00B14F]/20 text-base flex items-center justify-center gap-2 cursor-pointer transition-all disabled:bg-gray-300 disabled:shadow-none mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <span>Tiếp tục</span>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* PHẦN THỰC THI 3: ĐĂNG KÝ TÀI KHOẢN MỚI ĐẦY ĐỦ */}
          {/* ======================================================== */}
          {tab === "REGISTER" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3 animate-in fade-in">
              {/* Chọn vai trò */}
              <div>
                <label className="text-[11px] font-black text-gray-700 block mb-1.5">
                  Loại tài khoản đăng ký:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVaiTro("KHACH_HANG")}
                    className={`p-2 rounded-xl border text-center text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      vaiTro === "KHACH_HANG"
                        ? "bg-[#E8F8EE] border-[#00B14F] text-[#00853E]"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Khách hàng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVaiTro("TAI_XE")}
                    className={`p-2 rounded-xl border text-center text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      vaiTro === "TAI_XE"
                        ? "bg-[#E8F8EE] border-[#00B14F] text-[#00853E]"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Tài xế Grab</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVaiTro("QUAN_TRI_VIEN")}
                    className={`p-2 rounded-xl border text-center text-xs font-black transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      vaiTro === "QUAN_TRI_VIEN"
                        ? "bg-purple-50 border-purple-400 text-purple-800"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Quản trị viên</span>
                  </button>
                </div>
              </div>

              {/* SỐ ĐIỆN THOẠI HOẶC EMAIL ĐỂ NHẬN MÃ OTP */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black text-gray-700">
                    Số điện thoại hoặc Email (nhận mã OTP):
                  </label>
                  {currentType === "EMAIL" && (
                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-600" />
                      <span>Email</span>
                    </span>
                  )}
                  {currentType === "PHONE" && (
                    <span className="text-[10px] font-black text-[#00853E] bg-[#E8F8EE] px-2 py-0.5 rounded-full border border-[#00B14F]/30 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#00B14F]" />
                      <span>SĐT (+84)</span>
                    </span>
                  )}
                </div>

                <div className="relative flex items-center w-full bg-white border-2 border-[#00B14F] rounded-xl p-1 transition-all focus-within:ring-4 focus-within:ring-[#00B14F]/15">
                  {currentType === "EMAIL" ? (
                    <div className="flex items-center gap-1 pl-3 pr-2.5 py-1 text-xs font-black text-blue-700 border-r border-gray-200 select-none">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Email</span>
                    </div>
                  ) : currentType === "PHONE" ? (
                    <div className="flex items-center gap-1 pl-3 pr-2.5 py-1 text-xs font-black text-[#1C1C1C] border-r border-gray-200 select-none">
                      <span className="text-base leading-none">🇻🇳</span>
                      <span>+84</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 pl-3 pr-2 py-1 text-[11px] font-black text-gray-500 border-r border-gray-200 select-none">
                      <span>🇻🇳 +84</span>
                      <span className="text-gray-300">/</span>
                      <Mail className="w-3 h-3 text-gray-400" />
                    </div>
                  )}

                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={currentType === "EMAIL" ? "buithutrang149506@gmail.com" : "090 123 4567 hoặc email"}
                    className="w-full bg-transparent border-none py-1.5 px-3 text-xs sm:text-sm font-bold text-[#1C1C1C] focus:outline-none placeholder-gray-400"
                    required
                  />

                  {isInputValid() && (
                    <div className="pr-2 text-emerald-600">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Họ và tên */}
              <div>
                <label className="text-[11px] font-black text-gray-700 block mb-1">Họ và tên đầy đủ:</label>
                <input
                  type="text"
                  value={hoTen}
                  onChange={(e) => setHoTen(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  required
                  className="w-full bg-[#F9FAFB] border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00B14F]"
                />
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="text-[11px] font-black text-gray-700 block mb-1">Mật khẩu (tối thiểu 6 ký tự):</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={matKhau}
                    onChange={(e) => setMatKhau(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-[#F9FAFB] border border-gray-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00B14F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black text-gray-700">Xác nhận mật khẩu:</label>
                  {xacNhanMatKhau && (
                    <span
                      className={`text-[10px] font-bold ${
                        matKhau === xacNhanMatKhau ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {matKhau === xacNhanMatKhau ? "✓ Khớp" : "✕ Chưa khớp"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={xacNhanMatKhau}
                    onChange={(e) => setXacNhanMatKhau(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className={`w-full bg-[#F9FAFB] border rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00B14F] ${
                      xacNhanMatKhau && matKhau !== xacNhanMatKhau
                        ? "border-rose-300"
                        : "border-gray-300"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* XÁC THỰC MÃ OTP BẮT BUỘC ĐỂ ĐĂNG KÝ (OTP DÀNH RIÊNG CHO ĐĂNG KÝ) */}
              <div className="p-3.5 bg-[#F0FDF4] border-2 border-[#00B14F]/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#00853E] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#00B14F]" />
                    <span>Mã xác thực OTP (Bắt buộc):</span>
                  </label>
                  {realEmailSent && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Đã gửi Email
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={registerOtpCode}
                    onChange={(e) => setRegisterOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Mã OTP 6 số"
                    required
                    className="flex-1 bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-black tracking-widest text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00B14F]"
                  />

                  <button
                    type="button"
                    onClick={() => handleSendRegisterOtp()}
                    disabled={sendingOtp || otpCooldown > 0}
                    className="bg-[#00B14F] hover:bg-[#008A3D] disabled:bg-gray-300 text-white font-black text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm flex-shrink-0"
                  >
                    {sendingOtp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : otpCooldown > 0 ? (
                      <span>Gửi lại ({otpCooldown}s)</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi mã OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Thông tin đối tác tài xế */}
              {vaiTro === "TAI_XE" && (
                <div className="p-3 bg-[#F0FDF4] border border-[#00B14F]/30 rounded-xl space-y-2">
                  <span className="text-[11px] font-black text-[#00853E] uppercase block">
                    Thông tin phương tiện:
                  </span>
                  <input
                    type="text"
                    value={bienSoXe}
                    onChange={(e) => setBienSoXe(e.target.value)}
                    placeholder="Biển số xe (29A-999.99)"
                    required
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={soGiayPhepLaiXe}
                    onChange={(e) => setSoGiayPhepLaiXe(e.target.value)}
                    placeholder="Số GPLX (Bằng lái xe)"
                    required
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                  <select
                    value={loaiDichVu}
                    onChange={(e: any) => setLoaiDichVu(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="GRAB_BIKE">GrabBike (Xe máy 2 bánh)</option>
                    <option value="GRAB_CAR_4">GrabCar 4 chỗ</option>
                    <option value="GRAB_CAR_7">GrabCar 7 chỗ</option>
                  </select>
                </div>
              )}

              {/* Thông tin Quản trị viên */}
              {vaiTro === "QUAN_TRI_VIEN" && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-purple-900 font-black text-[11px] uppercase">
                    <Shield className="w-3.5 h-3.5 text-purple-700" />
                    <span>Hồ sơ Quản trị viên:</span>
                  </div>
                  <input
                    type="text"
                    value={phongBan}
                    onChange={(e) => setPhongBan(e.target.value)}
                    placeholder="Phòng ban (Vận hành / Giám sát)"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={chucVu}
                    onChange={(e) => setChucVu(e.target.value)}
                    placeholder="Chức vụ (Chuyên viên điều phối)"
                    className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-snug flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block">⚠️ Chính sách kiểm duyệt bảo mật:</span>
                      Tài khoản Quản trị viên sau khi đăng ký sẽ ở trạng thái chờ duyệt. Cần có <strong>Quản trị viên hiện tại</strong> đăng nhập và phê duyệt thì tài khoản mới có thể sử dụng.
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full bg-[#00B14F] hover:bg-[#008A3D] active:scale-[0.99] text-white font-black py-3.5 rounded-2xl shadow-lg shadow-[#00B14F]/20 text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer transition-all disabled:bg-gray-300 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <span>Tạo tài khoản Grab</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* ======================================================== */}
        {/* FOOTER ĐIỀU KHOẢN VÀ AN TÂM HÀNH TRÌNH (KHỚP 100% ẢNH MẪU) */}
        {/* ======================================================== */}
        <div className="pt-5 mt-auto">
          <p className="text-center text-[11px] text-gray-500 font-normal leading-relaxed px-2">
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <a href="#terms" className="text-gray-700 underline hover:text-[#00B14F]">
              Điều khoản sử dụng
            </a>{" "}
            và{" "}
            <a href="#privacy" className="text-gray-700 underline hover:text-[#00B14F]">
              Chính sách bảo mật
            </a>{" "}
            của Grab.
          </p>

          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 mt-3 select-none">
            <div className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center text-emerald-600">
              <Check className="w-2.5 h-2.5" />
            </div>
            <span>An tâm trên mọi hành trình</span>
          </div>

          {/* ACCORDION TÀI KHOẢN MẪU CHẤM ĐIỂM THU GỌN */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDemoDrawer(!showDemoDrawer)}
              className="w-full py-1.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[11px] font-bold text-gray-600 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#00B14F]" />
                <span>Tài khoản kiểm thử chấm điểm ({DEMO_ACCOUNTS.length})</span>
              </div>
              {showDemoDrawer ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {showDemoDrawer && (
              <div className="mt-2 space-y-1.5 animate-in fade-in">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.phone}
                    type="button"
                    onClick={() => handleQuickLogin(acc.email || acc.phone, acc.role)}
                    disabled={!!quickLoadingTarget}
                    className="w-full text-left p-2 rounded-xl border border-gray-200 hover:border-[#00B14F] hover:bg-[#F0FDF4] transition-all flex items-center justify-between cursor-pointer text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800">{acc.name}</span>
                      <span className="text-[10px] text-gray-400">{acc.desc}</span>
                    </div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      {acc.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
