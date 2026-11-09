import { Router } from "express";
import { AdminController } from "./controllers/admin.controller";
import { authenticateJwt } from "../../common/middlewares/auth.middleware";
import { requireRoles } from "../../common/middlewares/role.middleware";
import { VaiTro } from "@prisma/client";

const router = Router();
const controller = new AdminController();

// Tất cả các route bên dưới bắt buộc phải đăng nhập và có vai trò QUAN_TRI_VIEN
router.use(authenticateJwt, requireRoles(VaiTro.QUAN_TRI_VIEN));

// 1. Thống kê số liệu thời gian thực
router.get("/metrics", controller.getMetrics);

// 2. Giám sát toàn bộ chuyến xe trong hệ thống
router.get("/trips", controller.getTrips);

// 3. Quản lý đội ngũ tài xế
router.get("/drivers", controller.getDrivers);
router.patch("/drivers/:id/status", controller.updateDriverStatus);

// 4. Quản lý mã khuyến mại (QT-03)
router.get("/vouchers", controller.getVouchers);
router.patch("/vouchers/:id/toggle", controller.toggleVoucher);
router.delete("/vouchers/:id", controller.deleteVoucher);

// 5. Kiểm tra công nợ khách hàng (QT-04) & Phí phạt tồn đọng (QT-05)
router.get("/debts", controller.getDebts);

export const adminRoutes = router;
