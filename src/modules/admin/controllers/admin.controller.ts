import { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service";
import { TrangThaiKhaDung } from "@prisma/client";

export class AdminController {
  constructor(private readonly adminService: AdminService = new AdminService()) {}

  /**
   * Thống kê toàn hệ thống
   */
  public getMetrics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = await this.adminService.getSystemMetrics();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Giám sát toàn bộ chuyến xe
   */
  public getTrips = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const trips = await this.adminService.getAllTrips({ status, limit });
      res.status(200).json({
        success: true,
        data: { trips },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Danh sách tài xế
   */
  public getDrivers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const drivers = await this.adminService.getAllDrivers();
      res.status(200).json({
        success: true,
        data: { drivers },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cập nhật trạng thái khả dụng tài xế
   */
  public updateDriverStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const driverId = req.params.id as string;
      const { status } = req.body;
      const result = await this.adminService.updateDriverStatus(driverId, status as TrangThaiKhaDung);
      res.status(200).json({
        success: true,
        message: `Đã cập nhật trạng thái tài xế sang ${status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Danh sách toàn bộ voucher
   */
  public getVouchers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vouchers = await this.adminService.getAllVouchers();
      res.status(200).json({
        success: true,
        data: { vouchers },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bật/Tắt voucher
   */
  public toggleVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const voucherId = req.params.id as string;
      const updated = await this.adminService.toggleVoucherStatus(voucherId);
      res.status(200).json({
        success: true,
        message: `Đã đổi trạng thái mã ${updated.maVoucher} sang ${updated.trangThai}`,
        data: { voucher: updated },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Xóa voucher
   */
  public deleteVoucher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const voucherId = req.params.id as string;
      const result = await this.adminService.deleteVoucher(voucherId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Danh sách công nợ & phạt hủy
   */
  public getDebts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const debts = await this.adminService.getDebtAndPenaltyRecords();
      res.status(200).json({
        success: true,
        data: debts,
      });
    } catch (error) {
      next(error);
    }
  };
}
