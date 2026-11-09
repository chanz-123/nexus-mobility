import { Router } from "express";
import { TripController } from "./controllers/trip.controller";
import { TripLifecycleController } from "./controllers/trip-lifecycle.controller";
import { authenticateJwt } from "../../common/middlewares/auth.middleware";
import { requireRoles } from "../../common/middlewares/role.middleware";
import { VaiTro } from "@prisma/client";

const router = Router();
const tripController = new TripController();
const lifecycleController = new TripLifecycleController();

// 1. Webhook IPN từ cổng thanh toán VNPay (Public, kiểm tra HMAC SHA-512)
router.get("/payment/vnpay-ipn", lifecycleController.handleIpn);
router.post("/payment/vnpay-ipn", lifecycleController.handleIpn);

// 2. Ước tính giá cước (Public hoặc Khách hàng)
router.post("/estimate-fare", tripController.estimateFare);

// 2b. Danh sách mã khuyến mại đang hoạt động (Public / Khách hàng)
router.get("/vouchers", tripController.getActiveVouchers);

// 2c. Tạo mã khuyến mại mới (Dành cho Quản trị viên)
router.post(
  "/vouchers",
  authenticateJwt,
  requireRoles(VaiTro.QUAN_TRI_VIEN),
  tripController.createVoucher
);

// 3. Đặt chuyến xe mới (Bắt buộc vai trò KHACH_HANG)
router.post(
  "/",
  authenticateJwt,
  requireRoles(VaiTro.KHACH_HANG),
  tripController.createTrip
);

// 4. Lịch sử chuyến xe của tôi
router.get("/history/my-trips", authenticateJwt, tripController.getMyTrips);

// 5. Vòng đời chuyến xe (Dành cho Tài xế: ARRIVED -> IN_PROGRESS -> COMPLETED)
router.post(
  "/:id/arrive",
  authenticateJwt,
  requireRoles(VaiTro.TAI_XE),
  lifecycleController.arrive
);
router.patch(
  "/:id/arrive",
  authenticateJwt,
  requireRoles(VaiTro.TAI_XE),
  lifecycleController.arrive
);
router.post(
  "/:id/start",
  authenticateJwt,
  requireRoles(VaiTro.TAI_XE),
  lifecycleController.start
);
router.patch(
  "/:id/start",
  authenticateJwt,
  requireRoles(VaiTro.TAI_XE),
  lifecycleController.start
);
router.post(
  "/:id/complete",
  authenticateJwt,
  requireRoles(VaiTro.TAI_XE),
  lifecycleController.complete
);
router.patch(
  "/:id/complete",
  authenticateJwt,
  requireRoles(VaiTro.TAI_XE),
  lifecycleController.complete
);

// 6. Hủy chuyến xe & phạt phí 10.000 VNĐ (QT-05)
router.post("/:id/cancel", authenticateJwt, lifecycleController.cancel);

// 7. Tạo liên kết thanh toán VNPay
router.post("/:id/payment-url", authenticateJwt, lifecycleController.getPaymentUrl);

// 8. Chi tiết một chuyến xe
router.get("/:id", authenticateJwt, tripController.getTripDetails);

export const tripRoutes = router;
