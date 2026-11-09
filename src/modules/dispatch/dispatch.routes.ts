import { Router } from "express";
import { DispatchController } from "./controllers/dispatch.controller";
import { authenticateJwt } from "../../common/middlewares/auth.middleware";
import { requireRoles } from "../../common/middlewares/role.middleware";
import { VaiTro } from "@prisma/client";

const router = Router();
const controller = new DispatchController();

// Toàn bộ các route dispatch dành riêng cho Tài xế
router.use(authenticateJwt, requireRoles(VaiTro.TAI_XE));

// 1. Cập nhật tọa độ GPS
router.post("/location", controller.updateLocation);

// 2. Chấp nhận chuyến xe (QT-02)
router.post("/accept", controller.acceptTrip);
router.post("/trips/:tripId/accept", controller.acceptTrip);

// 3. Từ chối chuyến xe (QT-02)
router.post("/reject", controller.rejectTrip);
router.post("/trips/:tripId/reject", controller.rejectTrip);

export const dispatchRoutes = router;
