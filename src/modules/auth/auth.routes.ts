import { Router } from "express";
import { AuthController } from "./controllers/auth.controller";
import { authRateLimiter } from "../../common/middlewares/rate-limiter.middleware";
import { authenticateJwt } from "../../common/middlewares/auth.middleware";
import { requireRoles } from "../../common/middlewares/role.middleware";
import { VaiTro } from "@prisma/client";

const router = Router();
const controller = new AuthController();

// Public routes (có gắn authRateLimiter chống tấn công dò mật khẩu và spam OTP)
router.post("/send-otp", authRateLimiter, controller.sendOtp);
router.post("/verify-otp", authRateLimiter, controller.verifyOtp);
router.post("/register", authRateLimiter, controller.register);
router.post("/login", authRateLimiter, controller.login);
router.post("/login-otp", authRateLimiter, controller.loginWithOtp);
router.post("/refresh", controller.refresh);

// Protected routes (yêu cầu đăng nhập JWT)
router.post("/logout", authenticateJwt, controller.logout);
router.get("/me", authenticateJwt, controller.me);

// Quản trị viên quản lý và phê duyệt tài khoản Quản trị viên mới
router.get(
  "/pending-admins",
  authenticateJwt,
  requireRoles(VaiTro.QUAN_TRI_VIEN),
  controller.getPendingAdmins
);
router.post(
  "/approve-admin/:id",
  authenticateJwt,
  requireRoles(VaiTro.QUAN_TRI_VIEN),
  controller.approveAdmin
);
router.post(
  "/reject-admin/:id",
  authenticateJwt,
  requireRoles(VaiTro.QUAN_TRI_VIEN),
  controller.rejectAdmin
);

export const authRoutes = router;
