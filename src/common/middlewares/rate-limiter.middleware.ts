import rateLimit from "express-rate-limit";

/**
 * Rate Limiter chung cho toàn bộ API (100 requests / 1 phút mỗi IP ở production, 1000 ở dev)
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: "TOO_MANY_REQUESTS",
    message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.",
  },
});

/**
 * Rate Limiter cho các endpoint Auth/OTP (15 requests / 15 phút ở production, 300 ở dev)
 * Chống brute-force mật khẩu và spam gửi OTP trong production, đồng thời không gây kẹt khi test.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 15 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: "AUTH_RATE_LIMIT_EXCEEDED",
    message: "Thao tác đăng nhập/OTP vượt quá giới hạn cho phép. Vui lòng thử lại sau 15 phút.",
  },
});
