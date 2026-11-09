import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const ACCESS_TOKEN_KEY = "grab_access_token";
export const REFRESH_TOKEN_KEY = "grab_refresh_token";

export type UserRole = "KHACH_HANG" | "TAI_XE" | "QUAN_TRI_VIEN";

export const ROLE_TOKEN_KEYS: Record<UserRole, string> = {
  KHACH_HANG: "grab_token_KHACH_HANG",
  TAI_XE: "grab_token_TAI_XE",
  QUAN_TRI_VIEN: "grab_token_QUAN_TRI_VIEN",
};

export const getTargetRoleForPath = (pathname: string): UserRole => {
  if (pathname.startsWith("/driver")) return "TAI_XE";
  if (pathname.startsWith("/admin")) return "QUAN_TRI_VIEN";
  return "KHACH_HANG";
};

export const getStoredAccessToken = (targetRole?: UserRole): string | null => {
  const role = targetRole || getTargetRoleForPath(window.location.pathname);
  const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const sessionRole = sessionStorage.getItem("grab_user_role");

  // Nếu tab hiện tại đã có token và đúng vai trò yêu cầu (hoặc đang ở /auth)
  if (sessionToken && (!targetRole || sessionRole === role || window.location.pathname.startsWith("/auth"))) {
    return sessionToken;
  }

  // Lấy token riêng của vai trò tương ứng đã lưu trong localStorage
  const roleToken = localStorage.getItem(ROLE_TOKEN_KEYS[role]);
  if (roleToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, roleToken);
    sessionStorage.setItem("grab_user_role", role);
    return roleToken;
  }

  // Nếu vai trò yêu cầu là TAI_XE hoặc QUAN_TRI_VIEN (hoặc targetRole được truyền rõ ràng):
  // KHÔNG được trả token của vai trò khác (như khách hàng) vì sẽ làm sai danh tính phiên làm việc!
  if (targetRole || role === "TAI_XE" || role === "QUAN_TRI_VIEN") {
    return null;
  }

  return sessionToken || localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getStoredRefreshToken = (targetRole?: UserRole): string | null => {
  const role = targetRole || getTargetRoleForPath(window.location.pathname);
  const roleRefresh = localStorage.getItem(`${ROLE_TOKEN_KEYS[role]}_refresh`);
  if (roleRefresh) return roleRefresh;

  const sessionRole = sessionStorage.getItem("grab_user_role");
  if (!targetRole || sessionRole === role) {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
};

export const setStoredTokens = (accessToken: string, refreshToken?: string, role?: UserRole) => {
  const activeRole = role || (sessionStorage.getItem("grab_user_role") as UserRole) || getTargetRoleForPath(window.location.pathname);

  // 1. Lưu vào sessionStorage cho riêng tab này để các tab độc lập 100%
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem("grab_user_role", activeRole);
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  // 2. Lưu phiên theo vai trò vào localStorage để tab mới mở thuộc phân hệ này dùng
  if (activeRole && ROLE_TOKEN_KEYS[activeRole]) {
    localStorage.setItem(ROLE_TOKEN_KEYS[activeRole], accessToken);
    if (refreshToken) {
      localStorage.setItem(`${ROLE_TOKEN_KEYS[activeRole]}_refresh`, refreshToken);
    }
  }

  // 3. Cập nhật phiên chung fallback
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearStoredTokens = () => {
  const activeRole = sessionStorage.getItem("grab_user_role") as UserRole;
  if (activeRole && ROLE_TOKEN_KEYS[activeRole]) {
    localStorage.removeItem(ROLE_TOKEN_KEYS[activeRole]);
    localStorage.removeItem(`${ROLE_TOKEN_KEYS[activeRole]}_refresh`);
  }
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem("grab_user_role");
  window.dispatchEvent(new Event("auth:logout"));
};

export const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Gắn Bearer Token tự động
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Hàng đợi các request bị hoãn trong lúc Refresh Token đang chạy
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Tự động Refresh Token khi gặp 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Bỏ qua các endpoint auth không cần refresh
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/register");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = getStoredRefreshToken();

      if (!refreshToken) {
        clearStoredTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post("/api/v1/auth/refresh", {
          refreshToken,
        });

        const newTokens = refreshResponse.data?.data?.tokens;
        if (!newTokens?.accessToken) {
          throw new Error("Không nhận được access token mới từ máy chủ");
        }

        setStoredTokens(newTokens.accessToken, newTokens.refreshToken);
        processQueue(null, newTokens.accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error, null);
        clearStoredTokens();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
