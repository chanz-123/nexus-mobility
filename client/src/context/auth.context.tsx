import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  api,
  getStoredAccessToken,
  setStoredTokens,
  clearStoredTokens,
  UserRole,
  getTargetRoleForPath,
} from "../api/client";

export interface UserProfile {
  id: string;
  soDienThoai?: string | null;
  email?: string | null;
  hoTen: string;
  vaiTro: "KHACH_HANG" | "TAI_XE" | "QUAN_TRI_VIEN";
  trangThai: string;
  profile?: any;
}

export interface RegisterPayload {
  taiKhoan?: string;
  soDienThoai?: string;
  email?: string;
  matKhau: string;
  hoTen: string;
  vaiTro: "KHACH_HANG" | "TAI_XE" | "QUAN_TRI_VIEN";
  otpCode?: string;
  soGiayPhepLaiXe?: string;
  bienSoXe?: string;
  loaiDichVu?: "GRAB_BIKE" | "GRAB_CAR_4" | "GRAB_CAR_7";
  phongBan?: string;
  chucVu?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (taiKhoan: string, matKhau: string) => Promise<UserProfile>;
  loginWithOtp: (taiKhoan: string, otpCode: string) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<UserProfile & { pendingApproval?: boolean }>;
  logout: () => Promise<void>;
  quickLogin: (identifier: string) => Promise<UserProfile>;
  refreshSession: (forcedRole?: UserRole) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_ACCOUNTS = [
  {
    name: "Nguyễn Văn Minh (Khách hàng sạch nợ)",
    phone: "0901234567",
    email: "minh.nguyen@grab.com",
    role: "KHACH_HANG" as const,
    desc: "Đặt xe bình thường",
  },
  {
    name: "Trần Thị Lan (Khách đang nợ cước)",
    phone: "0908889999",
    email: "lan.tran@grab.com",
    role: "KHACH_HANG" as const,
    desc: "Kiểm thử chặn đặt xe QT-04",
  },
  {
    name: "Lê Hoàng Nam (Tài xế Ô tô 4 chỗ)",
    phone: "0912345678",
    email: "nam.le@grab.com",
    role: "TAI_XE" as const,
    desc: "Nhận chuyến GrabCar 4 chỗ",
  },
  {
    name: "Phạm Quốc Bảo (Tài xế Xe máy)",
    phone: "0919876543",
    email: "bao.pham@grab.com",
    role: "TAI_XE" as const,
    desc: "Nhận chuyến GrabBike",
  },
  {
    name: "Vũ Đức Thắng (Quản trị viên)",
    phone: "0988888888",
    email: "thang.vu@grab.com",
    role: "QUAN_TRI_VIEN" as const,
    desc: "Quản trị hệ thống, điều phối",
  },
];

export const formatAuthErrorMessage = (err: any): string => {
  if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
    return err.response.data.errors.map((e: any) => e.message).join(" • ");
  }
  if (err.response?.data?.message) {
    return err.response.data.message;
  }
  if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
    return "Không thể kết nối đến máy chủ Backend (Port 4000). Vui lòng đảm bảo backend đang chạy!";
  }
  return err.message || "Đã xảy ra lỗi xác thực, vui lòng thử lại!";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getStoredAccessToken());
  const [loading, setLoading] = useState<boolean>(true);

  // Lấy hồ sơ người dùng hiện tại theo phân hệ độc lập của tab
  const refreshSession = useCallback(async (forcedRole?: UserRole): Promise<UserProfile | null> => {
    const targetRole = forcedRole || getTargetRoleForPath(window.location.pathname);
    let currentToken = getStoredAccessToken(targetRole);

    // Nếu tab mở trang chuyên biệt (/driver hoặc /admin hoặc /) mà chưa có token cho vai trò này:
    // Tự động cấp phiên làm việc mẫu tương ứng để phân hệ này hoạt động ngay lập tức (phục vụ trình bày)
    if (!currentToken && !window.location.pathname.startsWith("/auth")) {
      try {
        const demoPhone =
          targetRole === "TAI_XE"
            ? "0912345678" // Lê Hoàng Nam
            : targetRole === "QUAN_TRI_VIEN"
            ? "0988888888" // Vũ Đức Thắng
            : "0901234567"; // Nguyễn Văn Minh
        const res = await api.post("/auth/login", { taiKhoan: demoPhone, matKhau: "Grab@2026" });
        const { user: demoUser, tokens } = res.data.data;
        setStoredTokens(tokens.accessToken, tokens.refreshToken, targetRole);
        setUser(demoUser);
        setToken(tokens.accessToken);
        setLoading(false);
        return demoUser;
      } catch {
        // Fallback tiếp tục bên dưới
      }
    }

    if (!currentToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await api.get("/auth/me");
      const fetchedUser = res.data?.data?.user;
      setUser(fetchedUser);
      setToken(currentToken);
      return fetchedUser;
    } catch {
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await refreshSession();
      if (isMounted) setLoading(false);
    })();

    // Lắng nghe sự kiện đăng xuất cục bộ trong tab này
    const handleLogoutEvent = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener("auth:logout", handleLogoutEvent);

    return () => {
      isMounted = false;
      window.removeEventListener("auth:logout", handleLogoutEvent);
    };
  }, [refreshSession]);

  const login = async (taiKhoan: string, matKhau: string): Promise<UserProfile> => {
    try {
      const res = await api.post("/auth/login", {
        taiKhoan: taiKhoan.trim(),
        matKhau,
      });
      const { user: loggedInUser, tokens } = res.data.data;

      setStoredTokens(tokens.accessToken, tokens.refreshToken, loggedInUser.vaiTro);
      setToken(tokens.accessToken);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err: any) {
      throw new Error(formatAuthErrorMessage(err));
    }
  };

  const loginWithOtp = async (taiKhoan: string, otpCode: string): Promise<UserProfile> => {
    try {
      const res = await api.post("/auth/login-otp", {
        taiKhoan: taiKhoan.trim(),
        otpCode: otpCode.trim(),
      });
      const { user: loggedInUser, tokens } = res.data.data;

      setStoredTokens(tokens.accessToken, tokens.refreshToken, loggedInUser.vaiTro);
      setToken(tokens.accessToken);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err: any) {
      throw new Error(formatAuthErrorMessage(err));
    }
  };

  const register = async (payload: RegisterPayload): Promise<UserProfile & { pendingApproval?: boolean }> => {
    try {
      const res = await api.post("/auth/register", payload);
      const { user: registeredUser, tokens, pendingApproval } = res.data.data;

      if (tokens && !pendingApproval) {
        setStoredTokens(tokens.accessToken, tokens.refreshToken, registeredUser.vaiTro);
        setToken(tokens.accessToken);
        setUser(registeredUser);
      }
      return { ...registeredUser, pendingApproval };
    } catch (err: any) {
      throw new Error(formatAuthErrorMessage(err));
    }
  };

  const quickLogin = async (identifier: string): Promise<UserProfile> => {
    return login(identifier, "Grab@2026");
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Bỏ qua lỗi mạng khi logout
    } finally {
      clearStoredTokens();
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithOtp,
        register,
        logout,
        quickLogin,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
