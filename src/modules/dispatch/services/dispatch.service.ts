import { prisma } from "../../../config/prisma";
import { geoService } from "../../geo/redis-geo.service";
import { SocketService } from "../../../common/socket/socket.service";
import { PhoneUtil } from "../../../common/utils/phone.util";
import { logger } from "../../../common/utils/logger";
import {
  TrangThaiKhaDung,
  TrangThaiChuyenXe,
  LoaiDichVu,
} from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../../common/exceptions/app-error";

interface ActiveDispatch {
  tripId: string;
  candidateDriverIds: string[];
  currentDriverIndex: number;
  timerHandle: NodeJS.Timeout | null;
  excludedDriverIds: Set<string>;
}

export class DispatchService {
  private static instance: DispatchService;
  // Quản lý các chuyến xe đang trong quá trình điều phối: tripId -> ActiveDispatch
  private activeDispatches = new Map<string, ActiveDispatch>();
  private static readonly DISPATCH_COUNTDOWN_SECONDS = 15; // 15 giây đếm ngược (QT-02)
  private static readonly SEARCH_RADIUS_KM = 5.0; // Bán kính tìm tài xế 5km

  public static getInstance(): DispatchService {
    if (!this.instance) {
      this.instance = new DispatchService();
    }
    return this.instance;
  }

  /**
   * Bắt đầu luồng điều phối tìm tài xế cho chuyến xe mới (QT-02)
   */
  public async startDispatch(tripId: string): Promise<void> {
    const trip = await prisma.chuyenXe.findUnique({
      where: { id: tripId },
      include: { diemDon: true, diemTra: true, khachHang: true },
    });

    if (!trip || trip.trangThai !== TrangThaiChuyenXe.PENDING) {
      logger.warn({ tripId }, "Chuyến xe không tồn tại hoặc không ở trạng thái PENDING để điều phối");
      return;
    }

    const pickupLat = Number(trip.diemDon.viDo);
    const pickupLon = Number(trip.diemDon.kinhDo);

    // 1. Quét tìm các tài xế trong bán kính 5km qua Redis GEO
    const nearby = await geoService.findNearbyDrivers(
      pickupLat,
      pickupLon,
      DispatchService.SEARCH_RADIUS_KM,
      trip.loaiDichVu
    );

    const serviceFilter =
      trip.loaiDichVu === LoaiDichVu.GRAB_CAR_4
        ? { in: [LoaiDichVu.GRAB_CAR_4, LoaiDichVu.GRAB_CAR_7] }
        : trip.loaiDichVu;

    let eligibleDriverIds: string[] = [];

    // 2. Lọc tài xế từ DB theo kết quả Redis GEO: đúng loại dịch vụ và đang ở trạng thái SAN_SANG
    if (nearby.length > 0) {
      const driverIds = nearby.map((d) => d.taiXeId);
      const availableDrivers = await prisma.taiXe.findMany({
        where: {
          nguoiDungId: { in: driverIds },
          loaiDichVu: serviceFilter,
          trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG,
          nguoiDung: { deletedAt: null },
        },
      });

      eligibleDriverIds = nearby
        .filter((n) => availableDrivers.some((d) => d.nguoiDungId === n.taiXeId))
        .map((n) => n.taiXeId);
    }

    // 3. FALLBACK: Nếu Redis GEO chưa có tọa độ (khoảng cách > 5km hoặc driver chưa ping GPS),
    // tự động tìm các tài xế SẴN SÀNG trong DB có loại xe phù hợp để điều phối
    if (eligibleDriverIds.length === 0) {
      const dbDrivers = await prisma.taiXe.findMany({
        where: {
          loaiDichVu: serviceFilter,
          trangThaiKhaDung: { in: [TrangThaiKhaDung.SAN_SANG, TrangThaiKhaDung.DANG_NHAN_DON] },
          nguoiDung: { deletedAt: null },
        },
        select: { nguoiDungId: true },
        take: 5,
      });

      eligibleDriverIds = dbDrivers.map((d) => d.nguoiDungId);
      if (eligibleDriverIds.length > 0) {
        logger.info(
          { tripId, count: eligibleDriverIds.length },
          `[QT-02] Không tìm thấy tài xế qua GPS. Sử dụng fallback ${eligibleDriverIds.length} tài xế sẵn sàng từ Database.`
        );
      }
    }

    if (eligibleDriverIds.length === 0) {
      this.handleNoDriverFound(trip.id, trip.khachHangId);
      return;
    }

    logger.info(
      { tripId, count: eligibleDriverIds.length },
      `[QT-02] Tìm thấy ${eligibleDriverIds.length} tài xế SẴN SÀNG phù hợp. Bắt đầu chào đơn độc quyền.`
    );

    // 3. Khởi tạo đối tượng ActiveDispatch
    const dispatch: ActiveDispatch = {
      tripId,
      candidateDriverIds: eligibleDriverIds,
      currentDriverIndex: 0,
      timerHandle: null,
      excludedDriverIds: new Set<string>(),
    };

    this.activeDispatches.set(tripId, dispatch);

    // 4. Bắn offer đến tài xế đầu tiên
    await this.offerTripToCurrentDriver(dispatch);
  }

  /**
   * Bắn sự kiện mời nhận chuyến (Exclusive Offer) tới tài xế hiện tại kèm timer 15s (QT-02)
   */
  private async offerTripToCurrentDriver(dispatch: ActiveDispatch): Promise<void> {
    if (dispatch.currentDriverIndex >= dispatch.candidateDriverIds.length) {
      // Đã thử hết danh sách tài xế nhưng không ai nhận
      const trip = await prisma.chuyenXe.findUnique({ where: { id: dispatch.tripId } });
      if (trip) {
        this.handleNoDriverFound(dispatch.tripId, trip.khachHangId);
      }
      this.activeDispatches.delete(dispatch.tripId);
      return;
    }

    const currentDriverId = dispatch.candidateDriverIds[dispatch.currentDriverIndex];
    if (!currentDriverId || dispatch.excludedDriverIds.has(currentDriverId)) {
      dispatch.currentDriverIndex++;
      return this.offerTripToCurrentDriver(dispatch);
    }

    const trip = await prisma.chuyenXe.findUnique({
      where: { id: dispatch.tripId },
      include: { diemDon: true, diemTra: true },
    });

    if (!trip || trip.trangThai !== TrangThaiChuyenXe.PENDING) {
      this.activeDispatches.delete(dispatch.tripId);
      return;
    }

    // Cập nhật trạng thái tài xế sang DANG_NHAN_DON (cửa sổ 15s)
    await prisma.taiXe.update({
      where: { nguoiDungId: currentDriverId },
      data: { trangThaiKhaDung: TrangThaiKhaDung.DANG_NHAN_DON },
    });

    // Tính cự ly từ tài xế đến điểm đón
    const driverLoc = await geoService.getDriverLocation(currentDriverId);
    let distanceToPickup = 0.5;
    if (driverLoc) {
      const dLat = (driverLoc.latitude - Number(trip.diemDon.viDo)) * 111;
      const dLon = (driverLoc.longitude - Number(trip.diemDon.kinhDo)) * 111;
      distanceToPickup = Number(Math.sqrt(dLat * dLat + dLon * dLon).toFixed(1));
    }

    // Bắn WebSocket độc quyền tới riêng tài xế này
    const socketService = SocketService.getInstance();
    const offerPayload = {
      tripId: trip.id,
      loaiDichVu: trip.loaiDichVu,
      quangDuongKm: Number(trip.quangDuongKm),
      thoiGianDuKienPhut: trip.thoiGianDuKienPhut,
      soTienCuoiCung: Number(trip.soTienCuoiCung),
      diemDon: {
        tenDiaDiem: trip.diemDon.tenDiaDiem,
        diaChiChiTiet: trip.diemDon.diaChiChiTiet,
        kinhDo: Number(trip.diemDon.kinhDo),
        viDo: Number(trip.diemDon.viDo),
      },
      diemTra: {
        tenDiaDiem: trip.diemTra.tenDiaDiem,
        diaChiChiTiet: trip.diemTra.diaChiChiTiet,
        kinhDo: Number(trip.diemTra.kinhDo),
        viDo: Number(trip.diemTra.viDo),
      },
      distanceToPickupKm: distanceToPickup,
      countdownSeconds: DispatchService.DISPATCH_COUNTDOWN_SECONDS,
      expiresAt: new Date(Date.now() + DispatchService.DISPATCH_COUNTDOWN_SECONDS * 1000).toISOString(),
    };

    socketService.emitToDriver(currentDriverId, "dispatch:offer", offerPayload);
    // @ts-expect-error legacy alias
    socketService.emitToDriver(currentDriverId, "driver:new_offer", offerPayload);

    logger.info(
      { tripId: trip.id, driverId: currentDriverId, countdown: DispatchService.DISPATCH_COUNTDOWN_SECONDS },
      `[QT-02] Đã bắn sự kiện mời nhận chuyến tới tài xế. Bắt đầu đếm ngược 15s.`
    );

    // Kích hoạt đồng hồ đếm ngược 15 giây (QT-02)
    dispatch.timerHandle = setTimeout(async () => {
      logger.warn(
        { tripId: trip.id, driverId: currentDriverId },
        `[QT-02] Hết 15 giây timeout! Tài xế không phản hồi. Tự động chuyển sang tài xế kế tiếp.`
      );

      // Trả trạng thái tài xế về SAN_SANG
      await prisma.taiXe.update({
        where: { nguoiDungId: currentDriverId },
        data: { trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG },
      });

      // Thông báo timeout cho tài xế
      socketService.emitToDriver(currentDriverId, "dispatch:timeout", {
        tripId: trip.id,
        message: "Hết thời gian 15 giây nhận chuyến xe",
      });

      dispatch.excludedDriverIds.add(currentDriverId);
      dispatch.currentDriverIndex++;

      // Gọi tài xế kế tiếp
      await this.offerTripToCurrentDriver(dispatch);
    }, DispatchService.DISPATCH_COUNTDOWN_SECONDS * 1000);
  }

  /**
   * Tài xế bấm Chấp nhận chuyến (Accept)
   */
  public async acceptTrip(driverId: string, tripId: string) {
    const dispatch = this.activeDispatches.get(tripId);
    if (dispatch && dispatch.timerHandle) {
      clearTimeout(dispatch.timerHandle);
    }

    // Thực hiện trong Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.chuyenXe.findUnique({
        where: { id: tripId },
        include: { diemDon: true, diemTra: true },
      });

      if (!trip) {
        throw new NotFoundError("Không tìm thấy chuyến xe");
      }

      if (trip.trangThai !== TrangThaiChuyenXe.PENDING) {
        throw new BadRequestError("Chuyến xe này đã được tài xế khác tiếp nhận hoặc đã bị hủy");
      }

      const now = new Date();

      // Cập nhật ChuyenXe: ACCEPTED, gán taiXeId, mốc thời gian nhận
      const updatedTrip = await tx.chuyenXe.update({
        where: { id: tripId },
        data: {
          taiXeId: driverId,
          trangThai: TrangThaiChuyenXe.ACCEPTED,
          thoiGianNhan: now,
        },
      });

      // Cập nhật Tài xế: DANG_PHUC_VU
      const updatedDriver = await tx.taiXe.update({
        where: { nguoiDungId: driverId },
        data: {
          trangThaiKhaDung: TrangThaiKhaDung.DANG_PHUC_VU,
        },
        include: {
          nguoiDung: { select: { hoTen: true, soDienThoai: true } },
        },
      });

      return { trip: updatedTrip, driver: updatedDriver, now };
    });

    // Lấy vị trí hiện tại của tài xế
    const driverLoc = (await geoService.getDriverLocation(driverId)) || { latitude: 21.0056, longitude: 105.8431 };

    // Bắn sự kiện cho Khách hàng: Tài xế đã nhận cuốc
    const socketService = SocketService.getInstance();
    const assignedPayload = {
      tripId,
      taiXe: {
        id: result.driver.nguoiDungId,
        hoTen: result.driver.nguoiDung.hoTen,
        soDienThoaiMasked: PhoneUtil.mask(result.driver.nguoiDung.soDienThoai),
        bienSoXe: result.driver.bienSoXe,
        diemDanhGia: Number(result.driver.diemDanhGia),
        loaiDichVu: result.driver.loaiDichVu,
        currentLocation: driverLoc,
      },
      thoiGianNhan: result.now.toISOString(),
    };

    socketService.emitToTrip(tripId, "trip:driver_assigned", assignedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToTrip(tripId, "trip:accepted", assignedPayload);

    socketService.emitToTrip(tripId, "trip:status_updated", {
      tripId,
      status: TrangThaiChuyenXe.ACCEPTED,
      timestamp: result.now.toISOString(),
      taiXe: assignedPayload.taiXe,
      thoiGianNhan: result.now.toISOString(),
    });

    // Bắn trực tiếp đến room cá nhân của khách hàng (Đảm bảo khách nhận được ngay lập tức)
    socketService.emitToUser(result.trip.khachHangId, "trip:driver_assigned", assignedPayload);
    // @ts-expect-error legacy alias
    socketService.emitToUser(result.trip.khachHangId, "trip:accepted", assignedPayload);
    socketService.emitToUser(result.trip.khachHangId, "trip:status_updated", {
      tripId,
      status: TrangThaiChuyenXe.ACCEPTED,
      timestamp: result.now.toISOString(),
      taiXe: assignedPayload.taiXe,
      thoiGianNhan: result.now.toISOString(),
    });

    this.activeDispatches.delete(tripId);
    logger.info({ tripId, driverId }, "[QT-02] Tài xế đã chấp nhận chuyến xe thành công!");

    return result;
  }

  /**
   * Tài xế bấm Từ chối chuyến (Reject)
   */
  public async rejectTrip(driverId: string, tripId: string, reason?: string) {
    const dispatch = this.activeDispatches.get(tripId);
    if (!dispatch) return;

    if (dispatch.timerHandle) {
      clearTimeout(dispatch.timerHandle);
    }

    // Trả trạng thái tài xế về SAN_SANG
    await prisma.taiXe.update({
      where: { nguoiDungId: driverId },
      data: { trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG },
    });

    logger.info({ tripId, driverId, reason }, "[QT-02] Tài xế chủ động từ chối chuyến. Chuyển sang tài xế kế tiếp.");

    dispatch.excludedDriverIds.add(driverId);
    dispatch.currentDriverIndex++;

    // Chuyển sang tài xế kế tiếp
    await this.offerTripToCurrentDriver(dispatch);
  }

  /**
   * Hủy tiến trình điều phối (khi khách hủy chuyến xe trong lúc đang tìm tài xế)
   */
  public async cancelDispatch(tripId: string, reason?: string) {
    const dispatch = this.activeDispatches.get(tripId);
    if (!dispatch) return;

    if (dispatch.timerHandle) {
      clearTimeout(dispatch.timerHandle);
      dispatch.timerHandle = null;
    }

    const currentDriverId = dispatch.candidateDriverIds[dispatch.currentDriverIndex];
    if (currentDriverId) {
      try {
        await prisma.taiXe.update({
          where: { nguoiDungId: currentDriverId },
          data: { trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG },
        });

        const socketService = SocketService.getInstance();
        // @ts-expect-error custom event
        socketService.emitToDriver(currentDriverId, "dispatch:cancelled", {
          tripId,
          message: reason || "Khách hàng đã hủy yêu cầu đặt xe",
        });
        socketService.emitToDriver(currentDriverId, "dispatch:timeout", {
          tripId,
          message: reason || "Khách hàng đã hủy chuyến xe",
        });
      } catch (err) {
        logger.error({ err, currentDriverId }, "Lỗi khi giải phóng tài xế khi hủy dispatch");
      }
    }

    this.activeDispatches.delete(tripId);
    logger.info({ tripId, reason }, "[QT-02] Đã hủy tiến trình điều phối chuyến xe thành công");
  }

  private async handleNoDriverFound(tripId: string, customerId: string) {
    logger.warn({ tripId }, "[QT-02] Không tìm thấy tài xế khả dụng trong khu vực. Tiến hành dọn dẹp.");

    try {
      const trip = await prisma.chuyenXe.findUnique({
        where: { id: tripId },
      });

      if (trip && trip.trangThai === TrangThaiChuyenXe.PENDING) {
        await prisma.$transaction(async (tx) => {
          // 1. Cập nhật chuyến xe sang CANCELLED
          await tx.chuyenXe.update({
            where: { id: tripId },
            data: {
              trangThai: TrangThaiChuyenXe.CANCELLED,
              lyDoHuy: "Không tìm thấy tài xế khả dụng trong khu vực (QT-02)",
            },
          });

          // 2. Hoàn lại số lượng voucher nếu khách có áp mã (QT-03)
          if (trip.khuyenMaiId) {
            await tx.khuyenMai.update({
              where: { id: trip.khuyenMaiId },
              data: { soLuong: { increment: 1 } },
            }).catch(() => {});
          }

          // 3. Xóa hóa đơn chưa thanh toán của chuyến xe này
          await tx.hoaDon.deleteMany({
            where: { chuyenXeId: tripId },
          });

          // 4. Khôi phục các khoản phí hủy tồn đọng chưa thu để chuyến sau thu tiếp (QT-05)
          await tx.lichSuHuy.updateMany({
            where: { chuyenXeThuPhiId: tripId },
            data: { daThuPhi: false, chuyenXeThuPhiId: null },
          });
        });
      }
    } catch (err) {
      logger.error({ err, tripId }, "Lỗi dọn dẹp khi không tìm thấy tài xế");
    }

    const socketService = SocketService.getInstance();
    const payload = {
      tripId,
      message: "Hiện tại các tài xế trong khu vực đều đang bận. Vui lòng thử lại sau ít phút.",
    };
    socketService.emitToUser(customerId, "dispatch:no_driver", payload);
    socketService.emitToTrip(tripId, "dispatch:no_driver", payload);
    // @ts-expect-error legacy alias
    socketService.emitToTrip(tripId, "trip:no_driver", payload);
    this.activeDispatches.delete(tripId);
  }
}

export const dispatchService = DispatchService.getInstance();
