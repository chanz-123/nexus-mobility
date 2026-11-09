import { TripRepository } from "../repositories/trip.repository";
import { PricingService } from "../../pricing/pricing.service";
import { MapAdapterFactory } from "../../../common/adapters/map/map-adapter.factory";
import { CreateTripDto, EstimateFareDto } from "../dtos/trip.dto";
import { LoaiDichVu } from "@prisma/client";
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "../../../common/exceptions/app-error";
import { logger } from "../../../common/utils/logger";
import { dispatchService } from "../../dispatch/services/dispatch.service";

export class TripService {
  constructor(
    private readonly tripRepository: TripRepository = new TripRepository(),
    private readonly pricingService: PricingService = new PricingService()
  ) {}

  /**
   * Ước tính cước phí cho tất cả các loại dịch vụ (QT-01, QT-03)
   * Phản hồi dưới 2 giây.
   */
  public async estimateFare(dto: EstimateFareDto, customerId?: string) {
    const startTime = Date.now();
    const mapService = MapAdapterFactory.getMapService();

    // 1. Tính toán lộ trình từ Map Adapter
    const route = await mapService.calculateRoute(
      { latitude: dto.diemDon.viDo, longitude: dto.diemDon.kinhDo },
      { latitude: dto.diemTra.viDo, longitude: dto.diemTra.kinhDo }
    );

    // 2. Tìm voucher nếu có mã (không ném lỗi khi chỉ ước tính giá)
    let voucher = null;
    let voucherError: string | undefined;
    if (dto.maVoucher && dto.maVoucher.trim() !== "") {
      voucher = await this.tripRepository.findValidVoucher(dto.maVoucher.trim());
      if (!voucher) {
        voucherError = `Mã "${dto.maVoucher}" không tồn tại hoặc hết hạn`;
      }
    }

    // 3. Kiểm tra phí hủy tồn đọng nếu có thông tin khách (QT-05)
    let totalPendingCancelFee = 0;
    if (customerId) {
      const cancelFees = await this.tripRepository.getUncollectedCancellationFees(customerId);
      totalPendingCancelFee = cancelFees.reduce((sum, item) => sum + Number(item.phiHuyChuyen), 0);
    }

    // 4. Tính toán giá cước so sánh cho cả 3 loại dịch vụ
    const services = [LoaiDichVu.GRAB_BIKE, LoaiDichVu.GRAB_CAR_4, LoaiDichVu.GRAB_CAR_7];
    const options = services.map((serviceType) => {
      const breakdown = this.pricingService.calculateFare({
        loaiDichVu: serviceType,
        quangDuongKm: route.distanceKm,
        phiHuyTonDong: totalPendingCancelFee,
        voucher,
        strictVoucherCheck: false,
      });

      return {
        loaiDichVu: serviceType,
        ...breakdown,
      };
    });

    const executionTimeMs = Date.now() - startTime;
    logger.info(
      { distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, executionTimeMs },
      `[PRICING ENGINE] Ước tính cước hoàn tất trong ${executionTimeMs}ms`
    );

    return {
      quangDuongKm: route.distanceKm,
      thoiGianDuKienPhut: route.durationMinutes,
      waypoints: route.waypoints,
      voucherError,
      voucher: voucher
        ? {
            id: voucher.id,
            maVoucher: voucher.maVoucher,
            tenChuongTrinh: voucher.tenChuongTrinh,
            loaiGiamGia: voucher.loaiGiamGia,
            giaTriGiam: Number(voucher.giaTriGiam),
            giamToiDa: voucher.giamToiDa ? Number(voucher.giamToiDa) : null,
            dieuKienToiThieu: Number(voucher.dieuKienToiThieu),
          }
        : null,
      executionTimeMs,
      options,
    };
  }

  /**
   * Lấy danh sách mã khuyến mại đang hoạt động
   */
  public async getActiveVouchers() {
    return this.tripRepository.getActiveVouchers();
  }

  /**
   * Tạo khuyến mại mới (Dành cho Quản trị viên)
   */
  public async createVoucher(data: {
    maVoucher: string;
    tenChuongTrinh: string;
    loaiGiamGia: "FIXED_AMOUNT" | "PERCENTAGE";
    giaTriGiam: number;
    giamToiDa?: number;
    dieuKienToiThieu?: number;
    soLuong: number;
    ngayBatDau?: Date;
    ngayKetThuc?: Date;
  }) {
    return this.tripRepository.createVoucher(data);
  }

  /**
   * Tạo chuyến xe mới (QT-01, QT-03, QT-04, QT-05) và kích hoạt điều phối QT-02
   */
  public async createTrip(customerId: string, dto: CreateTripDto) {
    // 0. KIỂM TRA CHUYẾN XE HIỆN TẠI: Một khách hàng chỉ có 1 chuyến xe đang diễn ra
    const existingActiveTrip = await this.tripRepository.findActiveTripByCustomer(customerId);
    if (existingActiveTrip) {
      throw new BadRequestError(
        `Bạn đang có một chuyến xe chưa hoàn thành (Mã: ${existingActiveTrip.id}, trạng thái: ${existingActiveTrip.trangThai}). Vui lòng hoàn thành hoặc hủy chuyến hiện tại trước khi đặt xe mới.`
      );
    }

    // 1. KIỂM TRA CÔNG NỢ (Quy tắc QT-04): Chặn đặt xe nếu còn hóa đơn cũ chưa thanh toán
    const unpaidInvoice = await this.tripRepository.findUnpaidInvoicesByCustomer(customerId);
    if (unpaidInvoice) {
      throw new ForbiddenError(
        `Bạn có hóa đơn chuyến xe trước chưa thanh toán (Mã chuyến: ${unpaidInvoice.chuyenXe.id}, số tiền: ${Number(
          unpaidInvoice.soTienThanhToan
        ).toLocaleString("vi-VN")} VNĐ). Vui lòng thanh toán công nợ trước khi tiếp tục đặt xe mới.`
      );
    }

    // 2. TÍNH TOÁN LỘ TRÌNH QUA MAP ADAPTER
    const mapService = MapAdapterFactory.getMapService();
    const route = await mapService.calculateRoute(
      { latitude: dto.diemDon.viDo, longitude: dto.diemDon.kinhDo },
      { latitude: dto.diemTra.viDo, longitude: dto.diemTra.kinhDo }
    );

    // 3. KIỂM TRA PHÍ HỦY CHUYẾN TỒN ĐỌNG (Quy tắc QT-05)
    const pendingCancelFees = await this.tripRepository.getUncollectedCancellationFees(customerId);
    const totalPendingCancelFee = pendingCancelFees.reduce(
      (sum, item) => sum + Number(item.phiHuyChuyen),
      0
    );
    const pendingFeeIds = pendingCancelFees.map((f) => f.id);

    // 4. KIỂM TRA VOUCHER (Quy tắc QT-03)
    let voucher = null;
    if (dto.maVoucher) {
      voucher = await this.tripRepository.findValidVoucher(dto.maVoucher);
      if (!voucher) {
        throw new BadRequestError(`Mã khuyến mại "${dto.maVoucher}" không hợp lệ hoặc đã hết lượt sử dụng`);
      }
    }

    // 5. TÍNH CƯỚC CHUYẾN XE (Quy tắc QT-01)
    const pricing = this.pricingService.calculateFare({
      loaiDichVu: dto.loaiDichVu,
      quangDuongKm: route.distanceKm,
      phiHuyTonDong: totalPendingCancelFee,
      voucher,
      strictVoucherCheck: true,
    });

    // 6. TẠO CHUYẾN XE TRONG DATABASE TRANSACTION
    const trip = await this.tripRepository.createTripTransaction(
      customerId,
      dto,
      route,
      pricing,
      voucher?.id,
      pendingFeeIds
    );

    logger.info(
      {
        chuyenXeId: trip.id,
        khachHangId: customerId,
        soTien: Number(trip.soTienCuoiCung),
        loaiDichVu: trip.loaiDichVu,
      },
      "Tạo chuyến xe thành công. Đang kích hoạt điều phối tài xế (QT-02)..."
    );

    // 7. KÍCH HOẠT THUẬT TOÁN ĐIỀU PHỐI TÀI XẾ (QT-02) BẤT ĐỒNG BỘ
    dispatchService.startDispatch(trip.id).catch((err) => {
      logger.error({ err, tripId: trip.id }, "Lỗi trong luồng điều phối QT-02");
    });

    return trip;
  }

  /**
   * Lấy chi tiết chuyến xe
   */
  public async getTripDetails(tripId: string) {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Không tìm thấy chuyến xe");
    }
    return trip;
  }

  /**
   * Lấy lịch sử chuyến xe của người dùng
   */
  public async getMyTrips(userId: string, isDriver = false) {
    if (isDriver) {
      return this.tripRepository.findHistoryByDriver(userId);
    }
    return this.tripRepository.findHistoryByCustomer(userId);
  }
}
