import { prisma } from "../../../config/prisma";
import { SocketService } from "../../../common/socket/socket.service";
import { paymentGateway } from "../../../common/adapters/payment/vnpay.adapter";
import {
  TrangThaiChuyenXe,
  TrangThaiKhaDung,
  TrangThaiThanhToan,
  PhuongThucThanhToan,
  Prisma,
} from "@prisma/client";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../../common/exceptions/app-error";
import { logger } from "../../../common/utils/logger";
import { dispatchService } from "../../dispatch/services/dispatch.service";

export class TripLifecycleService {
  /**
   * Tài xế đã đến điểm đón khách (ARRIVED)
   */
  public async arriveAtPickup(driverId: string, tripId: string) {
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId, deletedAt: null },
    });

    if (!trip) throw new NotFoundError("Không tìm thấy chuyến xe");
    if (trip.taiXeId !== driverId) throw new ForbiddenError("Bạn không phải tài xế của chuyến xe này");
    if (trip.trangThai !== TrangThaiChuyenXe.ACCEPTED) {
      throw new BadRequestError(`Không thể chuyển trạng thái sang ARRIVED từ ${trip.trangThai}`);
    }

    const updated = await prisma.chuyenXe.update({
      where: { id: tripId },
      data: { trangThai: TrangThaiChuyenXe.ARRIVED },
    });

    const socketService = SocketService.getInstance();
    const arrivedPayload = {
      tripId,
      status: TrangThaiChuyenXe.ARRIVED,
      timestamp: new Date().toISOString(),
    };
    socketService.emitToTrip(tripId, "trip:status_updated", arrivedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToTrip(tripId, "trip:driver_arrived", { tripId });

    socketService.emitToUser(trip.khachHangId, "trip:status_updated", arrivedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToUser(trip.khachHangId, "trip:driver_arrived", { tripId });

    return updated;
  }

  /**
   * Khách đã lên xe, bắt đầu di chuyển (IN_PROGRESS)
   */
  public async startTrip(driverId: string, tripId: string) {
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId, deletedAt: null },
    });

    if (!trip) throw new NotFoundError("Không tìm thấy chuyến xe");
    if (trip.taiXeId !== driverId) throw new ForbiddenError("Bạn không phải tài xế của chuyến xe này");
    if (trip.trangThai !== TrangThaiChuyenXe.ARRIVED && trip.trangThai !== TrangThaiChuyenXe.ACCEPTED) {
      throw new BadRequestError(`Không thể bắt đầu chuyến xe khi đang ở trạng thái ${trip.trangThai}`);
    }

    const updated = await prisma.chuyenXe.update({
      where: { id: tripId },
      data: { trangThai: TrangThaiChuyenXe.IN_PROGRESS },
    });

    const socketService = SocketService.getInstance();
    const startedPayload = {
      tripId,
      status: TrangThaiChuyenXe.IN_PROGRESS,
      timestamp: new Date().toISOString(),
    };
    socketService.emitToTrip(tripId, "trip:status_updated", startedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToTrip(tripId, "trip:started", { tripId });

    socketService.emitToUser(trip.khachHangId, "trip:status_updated", startedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToUser(trip.khachHangId, "trip:started", { tripId });

    return updated;
  }

  /**
   * Hoàn thành chuyến xe (COMPLETED)
   */
  public async completeTrip(driverId: string, tripId: string) {
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId, deletedAt: null },
      include: { hoaDon: true },
    });

    if (!trip) throw new NotFoundError("Không tìm thấy chuyến xe");
    if (trip.taiXeId !== driverId) throw new ForbiddenError("Bạn không phải tài xế của chuyến xe này");
    if (trip.trangThai !== TrangThaiChuyenXe.IN_PROGRESS) {
      throw new BadRequestError(`Chỉ có thể hoàn thành chuyến xe khi đang ở trạng thái IN_PROGRESS (hiện tại: ${trip.trangThai})`);
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật ChuyenXe: COMPLETED
      const updatedTrip = await tx.chuyenXe.update({
        where: { id: tripId },
        data: {
          trangThai: TrangThaiChuyenXe.COMPLETED,
          thoiGianHoanThanh: now,
        },
        include: { hoaDon: true },
      });

      // 2. Trả tài xế về trạng thái SAN_SANG để nhận cuốc tiếp theo
      await tx.taiXe.update({
        where: { nguoiDungId: driverId },
        data: { trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG },
      });

      // 3. Nếu là TIEN_MAT -> Đánh dấu hóa đơn đã thanh toán xong
      if (trip.hoaDon && trip.hoaDon.phuongThucThanhToan === PhuongThucThanhToan.TIEN_MAT) {
        await tx.hoaDon.update({
          where: { id: trip.hoaDon.id },
          data: {
            trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN,
            thoiGianThanhToan: now,
          },
        });
      }

      return updatedTrip;
    });

    const socketService = SocketService.getInstance();
    const completedPayload = {
      tripId,
      status: TrangThaiChuyenXe.COMPLETED,
      timestamp: now.toISOString(),
      hoaDon: trip.hoaDon,
    };
    socketService.emitToTrip(tripId, "trip:status_updated", completedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToTrip(tripId, "trip:completed", { tripId, hoaDon: trip.hoaDon });

    socketService.emitToUser(trip.khachHangId, "trip:status_updated", completedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToUser(trip.khachHangId, "trip:completed", { tripId, hoaDon: trip.hoaDon });

    logger.info({ tripId, driverId }, "Chuyến xe đã hoàn thành thành công.");
    return result;
  }

  /**
   * Hủy chuyến xe & Xử lý phí phạt 10.000 VNĐ theo Quy tắc QT-05
   */
  public async cancelTrip(userId: string, tripId: string, lyDoHuy: string) {
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId, deletedAt: null },
    });

    if (!trip) throw new NotFoundError("Không tìm thấy chuyến xe");

    if (trip.trangThai === TrangThaiChuyenXe.COMPLETED) {
      throw new BadRequestError("Chuyến xe đã hoàn thành, không thể hủy");
    }

    if (trip.trangThai === TrangThaiChuyenXe.CANCELLED) {
      throw new BadRequestError("Chuyến xe này đã bị hủy trước đó");
    }

    if (trip.trangThai === TrangThaiChuyenXe.IN_PROGRESS) {
      throw new BadRequestError("Chuyến xe đang trong quá trình di chuyển chở khách, không thể hủy ngang!");
    }

    // TÍNH TOÁN QUY TẮC QT-05 (PHÍ HỦY CHUYẾN):
    // Cộng 10.000 VNĐ vào chuyến sau nếu khách hủy khi tài xế đã di chuyển đón > 5 phút
    let soPhutTaiXeDiChuyen = 0;
    let phiHuyChuyen = 0;
    let daThuPhi = true;

    if (trip.taiXeId && trip.thoiGianNhan) {
      const diffMs = Date.now() - trip.thoiGianNhan.getTime();
      soPhutTaiXeDiChuyen = Math.floor(diffMs / (60 * 1000));

      if (soPhutTaiXeDiChuyen > 5) {
        phiHuyChuyen = 10000; // Áp dụng phạt 10.000đ theo QT-05
        daThuPhi = false;     // Chưa thu -> Sẽ tự động gộp vào chuyến đặt sau
        logger.warn(
          { tripId, customerId: userId, soPhut: soPhutTaiXeDiChuyen },
          "[QT-05] Khách hàng hủy chuyến khi tài xế đã di chuyển đón > 5 phút. Áp dụng phí phạt 10.000 VNĐ cho chuyến sau."
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật ChuyenXe sang CANCELLED
      const cancelledTrip = await tx.chuyenXe.update({
        where: { id: tripId },
        data: {
          trangThai: TrangThaiChuyenXe.CANCELLED,
          lyDoHuy,
        },
      });

      // 2. Ghi nhận lịch sử hủy chuyến (LichSuHuy)
      const cancelRecord = await tx.lichSuHuy.create({
        data: {
          chuyenXeId: trip.id,
          nguoiHuyId: userId,
          lyDoHuy,
          soPhutTaiXeDiChuyen,
          phiHuyChuyen: new Prisma.Decimal(phiHuyChuyen),
          daThuPhi,
        },
      });

      // 3. Nếu đã có tài xế, giải phóng tài xế về SAN_SANG
      if (trip.taiXeId) {
        await tx.taiXe.update({
          where: { nguoiDungId: trip.taiXeId },
          data: { trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG },
        });
      }

      // 4. Hoàn lại số lượng voucher nếu khách có áp mã (QT-03)
      if (trip.khuyenMaiId) {
        await tx.khuyenMai.update({
          where: { id: trip.khuyenMaiId },
          data: { soLuong: { increment: 1 } },
        }).catch(() => {});
      }

      // 5. Xóa hóa đơn chưa thanh toán của chuyến bị hủy này (tránh tính nhầm nợ cước)
      await tx.hoaDon.deleteMany({
        where: { chuyenXeId: trip.id },
      });

      // 6. Hoàn lại các khoản phí phạt tồn đọng đã gộp vào chuyến này để chuyến sau thu tiếp (QT-05)
      await tx.lichSuHuy.updateMany({
        where: { chuyenXeThuPhiId: trip.id },
        data: { daThuPhi: false, chuyenXeThuPhiId: null },
      });

      return { cancelledTrip, cancelRecord, phiHuyChuyen, soPhutTaiXeDiChuyen };
    });

    // 4. Nếu chuyến xe đang trong quá trình điều phối (PENDING), hủy active dispatch và giải phóng tài xế
    await dispatchService.cancelDispatch(tripId, lyDoHuy);

    // 5. Bắn socket thông báo cho mọi người trong room chuyến xe
    const socketService = SocketService.getInstance();
    const cancelPayload = {
      tripId,
      status: TrangThaiChuyenXe.CANCELLED,
      timestamp: new Date().toISOString(),
      message: "Chuyến xe đã bị hủy.",
    };
    socketService.emitToTrip(tripId, "trip:status_updated", cancelPayload);
    // @ts-expect-error legacy alias
    socketService.emitToTrip(tripId, "trip:cancelled", cancelPayload);

    // Bắn trực tiếp đến khách hàng
    socketService.emitToUser(trip.khachHangId, "trip:status_updated", cancelPayload);
    // @ts-expect-error legacy alias
    socketService.emitToUser(trip.khachHangId, "trip:cancelled", cancelPayload);

    // 6. Nếu chuyến xe đã có tài xế nhận, gửi thông báo trực tiếp đến tài xế
    if (trip.taiXeId) {
      socketService.emitToDriver(trip.taiXeId, "trip:status_updated", {
        tripId,
        status: TrangThaiChuyenXe.CANCELLED,
        timestamp: new Date().toISOString(),
      });
      // @ts-expect-error legacy alias
      socketService.emitToDriver(trip.taiXeId, "trip:cancelled", {
        tripId,
        message: "Khách hàng đã hủy chuyến xe.",
      });
    }

    return {
      success: true,
      message:
        result.phiHuyChuyen > 0
          ? `Đã hủy chuyến. Bạn bị áp dụng phí phạt ${result.phiHuyChuyen.toLocaleString("vi-VN")} VNĐ (do tài xế đã di chuyển ${result.soPhutTaiXeDiChuyen} phút đón bạn) theo quy tắc QT-05. Phí này sẽ được cộng vào chuyến kế tiếp.`
          : "Đã hủy chuyến xe thành công (miễn phí phạt).",
      data: result,
    };
  }

  /**
   * Tạo liên kết thanh toán trực tuyến qua cổng VNPay (Adapter Pattern)
   */
  public async createPaymentUrl(tripId: string, clientIp: string) {
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId, deletedAt: null },
      include: { hoaDon: true },
    });

    if (!trip || !trip.hoaDon) {
      throw new NotFoundError("Không tìm thấy chuyến xe hoặc hóa đơn thanh toán");
    }

    if (trip.hoaDon.trangThaiThanhToan === TrangThaiThanhToan.DA_THANH_TOAN) {
      throw new BadRequestError("Hóa đơn này đã được thanh toán hoàn tất trước đó");
    }

    const orderDesc = `Thanh toan cuoc xe Grab trip ${trip.id}`;
    const payment = await paymentGateway.createPaymentUrl({
      invoiceId: trip.hoaDon.id,
      tripId: trip.id,
      amount: Number(trip.hoaDon.soTienThanhToan),
      orderDescription: orderDesc,
      clientIp,
    });

    return payment;
  }

  /**
   * Xử lý Webhook IPN từ Cổng thanh toán (Kiểm tra HMAC SHA-512)
   */
  public async handleIpnWebhook(query: Record<string, unknown>) {
    const verification = paymentGateway.verifyIpnWebhook(query);

    if (!verification.isValid) {
      logger.error({ query }, "[WEBHOOK IPN] Chữ ký HMAC SHA-512 không hợp lệ! Phát hiện nghi vấn giả mạo gói tin.");
      return { RspCode: "97", Message: "Invalid Checksum" };
    }

    const tripId = verification.invoiceId;
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId },
      include: { hoaDon: true },
    });

    if (!trip || !trip.hoaDon) {
      return { RspCode: "01", Message: "Order Not Found" };
    }

    if (trip.hoaDon.trangThaiThanhToan === TrangThaiThanhToan.DA_THANH_TOAN) {
      return { RspCode: "02", Message: "Order already confirmed" };
    }

    if (verification.isSuccess) {
      // Cập nhật trạng thái hóa đơn thành DA_THANH_TOAN trong Database Transaction
      await prisma.hoaDon.update({
        where: { id: trip.hoaDon.id },
        data: {
          trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN,
          maGiaoDichCong: verification.gatewayTransactionId,
          thoiGianThanhToan: new Date(),
        },
      });

      logger.info(
        { tripId, gatewayTxnId: verification.gatewayTransactionId, amount: verification.amount },
        "[WEBHOOK IPN] Xác thực thanh toán VNPay thành công 100%!"
      );

      // Bắn sự kiện Socket thông báo thanh toán thành công
      SocketService.getInstance().emitToTrip(tripId, "trip:status_updated", {
        tripId,
        status: trip.trangThai,
        timestamp: new Date().toISOString(),
      });
    }

    return { RspCode: "00", Message: "Confirm Success" };
  }
}

export const tripLifecycleService = new TripLifecycleService();
