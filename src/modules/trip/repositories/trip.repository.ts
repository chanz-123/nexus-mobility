import { prisma } from "../../../config/prisma";
import {
  TrangThaiChuyenXe,
  TrangThaiThanhToan,
  TrangThaiKhuyenMai,
  Prisma,
} from "@prisma/client";
import { CreateTripDto } from "../dtos/trip.dto";
import { PricingBreakdown } from "../../pricing/pricing.service";
import { RouteCalculationResult } from "../../../common/adapters/map/map.interface";
import { ConflictError } from "../../../common/exceptions/app-error";

export class TripRepository {
  /**
   * Kiểm tra khách hàng có hóa đơn nào chưa thanh toán không (Quy tắc QT-04)
   */
  public async findUnpaidInvoicesByCustomer(khachHangId: string) {
    return prisma.hoaDon.findFirst({
      where: {
        chuyenXe: {
          khachHangId,
          deletedAt: null,
          trangThai: TrangThaiChuyenXe.COMPLETED,
        },
        trangThaiThanhToan: TrangThaiThanhToan.CHUA_THANH_TOAN,
      },
      include: {
        chuyenXe: {
          select: {
            id: true,
            thoiGianDat: true,
            soTienCuoiCung: true,
            loaiDichVu: true,
          },
        },
      },
    });
  }

  /**
   * Tìm chuyến xe đang hoạt động (chưa hoàn thành và chưa hủy) của khách hàng
   */
  public async findActiveTripByCustomer(khachHangId: string) {
    return prisma.chuyenXe.findFirst({
      where: {
        khachHangId,
        trangThai: {
          in: [
            TrangThaiChuyenXe.PENDING,
            TrangThaiChuyenXe.ACCEPTED,
            TrangThaiChuyenXe.ARRIVED,
            TrangThaiChuyenXe.IN_PROGRESS,
          ],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        trangThai: true,
      },
    });
  }

  /**
   * Lấy các khoản phí hủy chuyến tồn đọng chưa thu của khách hàng (Quy tắc QT-05)
   */
  public async getUncollectedCancellationFees(khachHangId: string) {
    return prisma.lichSuHuy.findMany({
      where: {
        nguoiHuyId: khachHangId,
        daThuPhi: false,
        phiHuyChuyen: { gt: 0 },
      },
    });
  }

  /**
   * Tìm voucher hợp lệ theo mã (Quy tắc QT-03)
   */
  public async findValidVoucher(maVoucher: string) {
    const now = new Date();
    return prisma.khuyenMai.findFirst({
      where: {
        maVoucher: maVoucher.toUpperCase(),
        trangThai: TrangThaiKhuyenMai.HOAT_DONG,
        soLuong: { gt: 0 },
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
        deletedAt: null,
      },
    });
  }

  /**
   * Lấy danh sách tất cả các voucher đang hoạt động
   */
  public async getActiveVouchers() {
    const now = new Date();
    let vouchers = await prisma.khuyenMai.findMany({
      where: {
        trangThai: TrangThaiKhuyenMai.HOAT_DONG,
        soLuong: { gt: 0 },
        ngayBatDau: { lte: now },
        ngayKetThuc: { gte: now },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    // Tự động khởi tạo dữ liệu mẫu nếu chưa có voucher nào trong hệ thống
    if (vouchers.length === 0) {
      const nextYear = new Date(now.getFullYear() + 1, 11, 31);
      await prisma.khuyenMai.createMany({
        data: [
          {
            maVoucher: "GRAB20K",
            tenChuongTrinh: "Giảm 20.000đ cho chuyến từ 40.000đ",
            loaiGiamGia: "FIXED_AMOUNT",
            giaTriGiam: 20000,
            dieuKienToiThieu: 40000,
            ngayBatDau: now,
            ngayKetThuc: nextYear,
            soLuong: 100,
            trangThai: TrangThaiKhuyenMai.HOAT_DONG,
          },
          {
            maVoucher: "GRAB15PCT",
            tenChuongTrinh: "Giảm 15% tối đa 30.000đ cho chuyến từ 50.000đ",
            loaiGiamGia: "PERCENTAGE",
            giaTriGiam: 15,
            giamToiDa: 30000,
            dieuKienToiThieu: 50000,
            ngayBatDau: now,
            ngayKetThuc: nextYear,
            soLuong: 50,
            trangThai: TrangThaiKhuyenMai.HOAT_DONG,
          },
          {
            maVoucher: "CHAOBANMOI",
            tenChuongTrinh: "Chào bạn mới - Giảm 10.000đ cho chuyến từ 20.000đ",
            loaiGiamGia: "FIXED_AMOUNT",
            giaTriGiam: 10000,
            dieuKienToiThieu: 20000,
            ngayBatDau: now,
            ngayKetThuc: nextYear,
            soLuong: 200,
            trangThai: TrangThaiKhuyenMai.HOAT_DONG,
          },
        ],
        skipDuplicates: true,
      });

      vouchers = await prisma.khuyenMai.findMany({
        where: {
          trangThai: TrangThaiKhuyenMai.HOAT_DONG,
          soLuong: { gt: 0 },
          ngayBatDau: { lte: now },
          ngayKetThuc: { gte: now },
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return vouchers;
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
    const now = new Date();
    const nextYear = new Date(now.getFullYear() + 1, 11, 31);
    return prisma.khuyenMai.create({
      data: {
        maVoucher: data.maVoucher.toUpperCase(),
        tenChuongTrinh: data.tenChuongTrinh,
        loaiGiamGia: data.loaiGiamGia,
        giaTriGiam: data.giaTriGiam,
        giamToiDa: data.giamToiDa ? data.giamToiDa : null,
        dieuKienToiThieu: data.dieuKienToiThieu || 0,
        soLuong: data.soLuong,
        ngayBatDau: data.ngayBatDau || now,
        ngayKetThuc: data.ngayKetThuc || nextYear,
        trangThai: TrangThaiKhuyenMai.HOAT_DONG,
      },
    });
  }

  /**
   * Tạo chuyến xe mới bọc hoàn toàn trong Database Transaction (ACID)
   * Đồng thời tạo: DiaDiem, ChuyenXe, HoaDon, LichTrinh, trừ Voucher và cập nhật Phí hủy
   */
  public async createTripTransaction(
    khachHangId: string,
    dto: CreateTripDto,
    route: RouteCalculationResult,
    pricing: PricingBreakdown,
    voucherId?: string,
    pendingCancelFeeIds: string[] = []
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Trừ số lượng voucher với điều kiện soLuong > 0 (chống Race Condition - QT-03)
      if (voucherId) {
        const updateResult = await tx.khuyenMai.updateMany({
          where: {
            id: voucherId,
            soLuong: { gt: 0 },
            trangThai: TrangThaiKhuyenMai.HOAT_DONG,
          },
          data: {
            soLuong: { decrement: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictError("Mã khuyến mại này vừa hết lượt sử dụng. Vui lòng thử lại.");
        }
      }

      // 2. Tạo hoặc lưu địa điểm đón và địa điểm trả
      const diemDon = await tx.diaDiem.create({
        data: {
          tenDiaDiem: dto.diemDon.tenDiaDiem,
          diaChiChiTiet: dto.diemDon.diaChiChiTiet,
          kinhDo: new Prisma.Decimal(dto.diemDon.kinhDo),
          viDo: new Prisma.Decimal(dto.diemDon.viDo),
        },
      });

      const diemTra = await tx.diaDiem.create({
        data: {
          tenDiaDiem: dto.diemTra.tenDiaDiem,
          diaChiChiTiet: dto.diemTra.diaChiChiTiet,
          kinhDo: new Prisma.Decimal(dto.diemTra.kinhDo),
          viDo: new Prisma.Decimal(dto.diemTra.viDo),
        },
      });

      // 3. Tạo ChuyenXe (trạng thái ban đầu: PENDING)
      const chuyenXe = await tx.chuyenXe.create({
        data: {
          khachHangId,
          diemDonId: diemDon.id,
          diemTraId: diemTra.id,
          khuyenMaiId: voucherId || null,
          loaiDichVu: dto.loaiDichVu,
          trangThai: TrangThaiChuyenXe.PENDING,
          quangDuongKm: new Prisma.Decimal(route.distanceKm),
          thoiGianDuKienPhut: route.durationMinutes,
          tienGiam: new Prisma.Decimal(pricing.tienGiam),
          soTienCuoiCung: new Prisma.Decimal(pricing.soTienCuoiCung),
        },
      });

      // 4. Tạo HoaDon (trạng thái: CHUA_THANH_TOAN)
      await tx.hoaDon.create({
        data: {
          chuyenXeId: chuyenXe.id,
          tongTien: new Prisma.Decimal(pricing.tongTienGoc),
          phuPhi: new Prisma.Decimal(pricing.phuPhiGioCaoDiem + pricing.phiHuyTonDong),
          tienGiam: new Prisma.Decimal(pricing.tienGiam),
          soTienThanhToan: new Prisma.Decimal(pricing.soTienCuoiCung),
          phuongThucThanhToan: dto.phuongThucThanhToan,
          trangThaiThanhToan: TrangThaiThanhToan.CHUA_THANH_TOAN,
        },
      });

      // 5. Cập nhật các khoản phạt hủy tồn đọng đã được gộp thu vào chuyến này (QT-05)
      if (pendingCancelFeeIds.length > 0) {
        await tx.lichSuHuy.updateMany({
          where: { id: { in: pendingCancelFeeIds } },
          data: {
            daThuPhi: true,
            chuyenXeThuPhiId: chuyenXe.id,
          },
        });
      }

      // 6. Tạo các mốc lộ trình dự kiến (LichTrinh)
      if (route.waypoints && route.waypoints.length > 0) {
        const baseTime = Date.now();
        await tx.lichTrinh.createMany({
          data: route.waypoints.map((wp) => ({
            chuyenXeId: chuyenXe.id,
            thuTuDiem: wp.orderIndex,
            kinhDo: new Prisma.Decimal(wp.latitude),
            viDo: new Prisma.Decimal(wp.longitude),
            thoiGianDuKienDen: new Date(baseTime + wp.estimatedArrivalSeconds * 1000),
          })),
        });
      }

      // 7. Truy vấn lại đầy đủ quan hệ để phản hồi
      return tx.chuyenXe.findUniqueOrThrow({
        where: { id: chuyenXe.id },
        include: {
          diemDon: true,
          diemTra: true,
          khuyenMai: true,
          hoaDon: true,
          lichTrinh: { orderBy: { thuTuDiem: "asc" } },
        },
      });
    });
  }

  /**
   * Lấy chi tiết chuyến xe theo ID
   */
  public async findById(id: string) {
    return prisma.chuyenXe.findUnique({
      where: { id, deletedAt: null },
      include: {
        diemDon: true,
        diemTra: true,
        khuyenMai: true,
        hoaDon: true,
        taiXe: {
          include: {
            nguoiDung: {
              select: {
                hoTen: true,
                soDienThoai: true,
              },
            },
          },
        },
        khachHang: {
          include: {
            nguoiDung: {
              select: {
                hoTen: true,
                soDienThoai: true,
              },
            },
          },
        },
        lichTrinh: { orderBy: { thuTuDiem: "asc" } },
      },
    });
  }

  /**
   * Lấy lịch sử chuyến xe của khách hàng
   */
  public async findHistoryByCustomer(khachHangId: string) {
    return prisma.chuyenXe.findMany({
      where: { khachHangId, deletedAt: null },
      orderBy: { thoiGianDat: "desc" },
      include: {
        diemDon: true,
        diemTra: true,
        hoaDon: true,
      },
    });
  }

  /**
   * Lấy lịch sử chuyến xe của tài xế
   */
  public async findHistoryByDriver(taiXeId: string) {
    return prisma.chuyenXe.findMany({
      where: { taiXeId, deletedAt: null },
      orderBy: { thoiGianDat: "desc" },
      include: {
        diemDon: true,
        diemTra: true,
        hoaDon: true,
      },
    });
  }
}
