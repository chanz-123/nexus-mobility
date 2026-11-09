import { Request, Response, NextFunction } from "express";
import { TripService } from "../services/trip.service";
import { EstimateFareSchema, CreateTripSchema } from "../dtos/trip.dto";
import { VaiTro } from "@prisma/client";

export class TripController {
  constructor(private readonly tripService: TripService = new TripService()) {}

  /**
   * API Ước tính cước phí (QT-01)
   */
  public estimateFare = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = EstimateFareSchema.parse(req.body);
      const customerId = req.user?.id;
      const result = await this.tripService.estimateFare(validated, customerId);

      res.status(200).json({
        success: true,
        message: "Ước tính giá cước thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * API Lấy danh sách mã khuyến mại đang hoạt động
   */
  public getActiveVouchers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vouchers = await this.tripService.getActiveVouchers();
      res.status(200).json({
        success: true,
        data: { vouchers },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * API Tạo mã khuyến mại mới (Dành cho Quản trị viên)
   */
  public createVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { maVoucher, tenChuongTrinh, loaiGiamGia, giaTriGiam, giamToiDa, dieuKienToiThieu, soLuong, ngayBatDau, ngayKetThuc } = req.body;
      const voucher = await this.tripService.createVoucher({
        maVoucher,
        tenChuongTrinh,
        loaiGiamGia,
        giaTriGiam: Number(giaTriGiam),
        giamToiDa: giamToiDa ? Number(giamToiDa) : undefined,
        dieuKienToiThieu: dieuKienToiThieu ? Number(dieuKienToiThieu) : 0,
        soLuong: Number(soLuong) || 100,
        ngayBatDau: ngayBatDau ? new Date(ngayBatDau) : undefined,
        ngayKetThuc: ngayKetThuc ? new Date(ngayKetThuc) : undefined,
      });

      res.status(201).json({
        success: true,
        message: `Đã tạo thành công mã khuyến mại ${voucher.maVoucher}`,
        data: { voucher },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * API Tạo chuyến xe mới (QT-01, QT-03, QT-04, QT-05)
   */
  public createTrip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = CreateTripSchema.parse(req.body);
      const customerId = req.user!.id; // Đã qua authenticateJwt
      const trip = await this.tripService.createTrip(customerId, validated);

      res.status(201).json({
        success: true,
        message: "Đặt chuyến xe thành công. Đang tìm tài xế gần nhất...",
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Lấy lịch sử chuyến đi của tôi
   */
  public getMyTrips = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const isDriver = req.user!.vaiTro === VaiTro.TAI_XE;
      const trips = await this.tripService.getMyTrips(userId, isDriver);

      res.status(200).json({
        success: true,
        data: { trips },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Lấy thông tin chi tiết một chuyến xe
   */
  public getTripDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tripId = req.params.id as string;
      const trip = await this.tripService.getTripDetails(tripId);

      res.status(200).json({
        success: true,
        data: { trip },
      });
    } catch (error) {
      next(error);
    }
  };
}
