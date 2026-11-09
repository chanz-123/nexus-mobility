import { Request, Response, NextFunction } from "express";
import { dispatchService } from "../services/dispatch.service";
import { geoService } from "../../geo/redis-geo.service";
import { prisma } from "../../../config/prisma";
import { SocketService } from "../../../common/socket/socket.service";
import { BadRequestError } from "../../../common/exceptions/app-error";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const LocationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().optional(),
});

export class DispatchController {
  /**
   * Cập nhật vị trí GPS thời gian thực của tài xế (lưu Redis GEO + ToaDoGPS)
   */
  public updateLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.user!.taiXeId || req.user!.id;
      const validated = LocationUpdateSchema.parse(req.body);

      // 1. Cập nhật Redis GEO
      await geoService.updateDriverLocation(driverId, validated.latitude, validated.longitude);

      // 2. Tìm xem tài xế có chuyến xe đang chạy không
      const activeTrip = await prisma.chuyenXe.findFirst({
        where: {
          taiXeId: driverId,
          trangThai: { in: ["ACCEPTED", "ARRIVED", "IN_PROGRESS"] },
          deletedAt: null,
        },
        select: { id: true },
      });

      // Nếu không có chuyến xe đang chạy, đảm bảo tài xế ở trạng thái SẴN SÀNG nhận đơn
      if (!activeTrip) {
        await prisma.taiXe.update({
          where: { nguoiDungId: driverId },
          data: { trangThaiKhaDung: "SAN_SANG" },
        }).catch(() => {});
      }

      // 3. Lưu lịch sử tọa độ vào bảng ToaDoGPS
      await prisma.toaDoGPS.create({
        data: {
          taiXeId: driverId,
          chuyenXeId: activeTrip?.id || null,
          kinhDo: new Prisma.Decimal(validated.longitude),
          viDo: new Prisma.Decimal(validated.latitude),
        },
      });

      // 4. Nếu có chuyến xe đang chạy -> Bắn vị trí trực tiếp cho khách hàng xem trên bản đồ
      if (activeTrip) {
        SocketService.getInstance().emitToTrip(activeTrip.id, "trip:driver_location", {
          taiXeId: driverId,
          latitude: validated.latitude,
          longitude: validated.longitude,
          heading: validated.heading,
          timestamp: new Date().toISOString(),
        });
        // @ts-expect-error legacy alias
        SocketService.getInstance().emitToTrip(activeTrip.id, "driver:location_updated", {
          lat: validated.latitude,
          lng: validated.longitude,
        });
      }

      res.status(200).json({
        success: true,
        message: "Cập nhật vị trí GPS thành công",
        data: {
          taiXeId: driverId,
          latitude: validated.latitude,
          longitude: validated.longitude,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Tài xế bấm Chấp nhận nhận chuyến (QT-02)
   */
  public acceptTrip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.user!.taiXeId || req.user!.id;
      const tripId = req.body?.tripId || req.params?.tripId;
      if (!tripId) {
        throw new BadRequestError("Mã chuyến xe là bắt buộc");
      }
      const result = await dispatchService.acceptTrip(driverId, tripId);

      res.status(200).json({
        success: true,
        message: "Tiếp nhận chuyến xe thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Tài xế bấm Từ chối nhận chuyến (QT-02)
   */
  public rejectTrip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.user!.taiXeId || req.user!.id;
      const tripId = req.body?.tripId || req.params?.tripId;
      if (!tripId) {
        throw new BadRequestError("Mã chuyến xe là bắt buộc");
      }
      await dispatchService.rejectTrip(driverId, tripId, req.body?.reason);

      res.status(200).json({
        success: true,
        message: "Đã từ chối nhận chuyến xe",
      });
    } catch (error) {
      next(error);
    }
  };
}
