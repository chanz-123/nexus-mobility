import { Request, Response, NextFunction } from "express";
import { tripLifecycleService } from "../services/trip-lifecycle.service";
import { z } from "zod";

const CancelTripSchema = z.object({
  lyDoHuy: z.string().min(2, "Lý do hủy tối thiểu 2 ký tự").max(255),
});

export class TripLifecycleController {
  public arrive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.user!.taiXeId || req.user!.id;
      const tripId = req.params.id as string;
      const result = await tripLifecycleService.arriveAtPickup(driverId, tripId);

      res.status(200).json({
        success: true,
        message: "Đã cập nhật trạng thái: Tài xế đã đến điểm đón (ARRIVED)",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public start = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.user!.taiXeId || req.user!.id;
      const tripId = req.params.id as string;
      const result = await tripLifecycleService.startTrip(driverId, tripId);

      res.status(200).json({
        success: true,
        message: "Đã bắt đầu chuyến xe (IN_PROGRESS)",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.user!.taiXeId || req.user!.id;
      const tripId = req.params.id as string;
      const result = await tripLifecycleService.completeTrip(driverId, tripId);

      res.status(200).json({
        success: true,
        message: "Chuyến xe đã hoàn thành thành công (COMPLETED)",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const tripId = req.params.id as string;
      const validated = CancelTripSchema.parse(req.body);
      const result = await tripLifecycleService.cancelTrip(userId, tripId, validated.lyDoHuy);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getPaymentUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tripId = req.params.id as string;
      const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
      const result = await tripLifecycleService.createPaymentUrl(tripId, clientIp);

      res.status(200).json({
        success: true,
        message: "Khởi tạo URL thanh toán VNPay thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public handleIpn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // VNPay gửi params qua Query string (GET)
      const query = { ...req.query, ...req.body };
      const response = await tripLifecycleService.handleIpnWebhook(query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
