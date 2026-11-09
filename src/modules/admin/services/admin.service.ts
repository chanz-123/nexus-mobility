import { prisma } from "../../../config/prisma";
import {
  TrangThaiChuyenXe,
  TrangThaiThanhToan,
  TrangThaiKhaDung,
  TrangThaiKhuyenMai,
} from "@prisma/client";
import { NotFoundError } from "../../../common/exceptions/app-error";

export class AdminService {
  /**
   * Lấy số liệu thống kê thời gian thực toàn hệ thống
   */
  public async getSystemMetrics() {
    const [
      paidInvoices,
      completedTripsCount,
      cancelledTripsCount,
      activeTripsCount,
      totalTripsCount,
      totalDriversCount,
      readyDriversCount,
      busyDriversCount,
      totalCustomersCount,
      activeVouchersCount,
      uncollectedPenalties,
      collectedPenalties,
      tripsByService,
    ] = await Promise.all([
      // 1. Tổng doanh thu từ các hóa đơn đã thanh toán thành công
      prisma.hoaDon.aggregate({
        where: {
          trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN,
        },
        _sum: {
          soTienThanhToan: true,
        },
      }),

      // 2. Số chuyến thành công
      prisma.chuyenXe.count({
        where: { trangThai: TrangThaiChuyenXe.COMPLETED },
      }),

      // 3. Số chuyến bị hủy
      prisma.chuyenXe.count({
        where: { trangThai: TrangThaiChuyenXe.CANCELLED },
      }),

      // 4. Số chuyến đang chạy (PENDING, ACCEPTED, ARRIVED, IN_PROGRESS)
      prisma.chuyenXe.count({
        where: {
          trangThai: {
            in: [
              TrangThaiChuyenXe.PENDING,
              TrangThaiChuyenXe.ACCEPTED,
              TrangThaiChuyenXe.ARRIVED,
              TrangThaiChuyenXe.IN_PROGRESS,
            ],
          },
        },
      }),

      // 5. Tổng số chuyến xe
      prisma.chuyenXe.count(),

      // 6. Tổng số tài xế
      prisma.taiXe.count(),

      // 7. Số tài xế sẵn sàng nhận cuốc (SAN_SANG)
      prisma.taiXe.count({
        where: { trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG },
      }),

      // 8. Số tài xế đang phục vụ hoặc đang nhận đơn
      prisma.taiXe.count({
        where: {
          trangThaiKhaDung: {
            in: [TrangThaiKhaDung.DANG_PHUC_VU, TrangThaiKhaDung.DANG_NHAN_DON],
          },
        },
      }),

      // 9. Tổng số khách hàng
      prisma.khachHang.count(),

      // 10. Số voucher đang hoạt động
      prisma.khuyenMai.count({
        where: {
          trangThai: TrangThaiKhuyenMai.HOAT_DONG,
          deletedAt: null,
        },
      }),

      // 11. Phí phạt hủy tồn đọng chưa thu (QT-05)
      prisma.lichSuHuy.aggregate({
        where: { daThuPhi: false, phiHuyChuyen: { gt: 0 } },
        _sum: { phiHuyChuyen: true },
        _count: true,
      }),

      // 12. Phí phạt hủy đã thu (QT-05)
      prisma.lichSuHuy.aggregate({
        where: { daThuPhi: true, phiHuyChuyen: { gt: 0 } },
        _sum: { phiHuyChuyen: true },
        _count: true,
      }),

      // 13. Phân bổ chuyến đi theo loại dịch vụ
      prisma.chuyenXe.groupBy({
        by: ["loaiDichVu"],
        _count: { id: true },
        _sum: { soTienCuoiCung: true },
      }),
    ]);

    const tongDoanhThu = Number(paidInvoices._sum.soTienThanhToan || 0);
    const tyLeHuy =
      totalTripsCount > 0
        ? Number(((cancelledTripsCount / totalTripsCount) * 100).toFixed(1))
        : 0;

    return {
      tongDoanhThu,
      soChuyenThanhCong: completedTripsCount,
      soChuyenBiHuy: cancelledTripsCount,
      soChuyenDangChay: activeTripsCount,
      tongSoChuyen: totalTripsCount,
      tyLeHuy,
      tongSoTaiXe: totalDriversCount,
      taiXeSanSang: readyDriversCount,
      taiXeDangBan: busyDriversCount,
      tongSoKhachHang: totalCustomersCount,
      soVoucherKhaDung: activeVouchersCount,
      phiPhatChuaThu: Number(uncollectedPenalties._sum.phiHuyChuyen || 0),
      soKhoanPhatChuaThu: uncollectedPenalties._count || 0,
      phiPhatDaThu: Number(collectedPenalties._sum.phiHuyChuyen || 0),
      soKhoanPhatDaThu: collectedPenalties._count || 0,
      phanBoDichVu: tripsByService.map((item) => ({
        loaiDichVu: item.loaiDichVu,
        soChuyen: item._count.id,
        doanhThu: Number(item._sum.soTienCuoiCung || 0),
      })),
    };
  }

  /**
   * Lấy danh sách toàn bộ chuyến xe trong hệ thống (Giám sát chuyến xe trực tiếp)
   */
  public async getAllTrips(query: { status?: string; limit?: number }) {
    const limit = query.limit ? Math.min(100, Math.max(1, query.limit)) : 50;
    const where: any = { deletedAt: null };

    if (query.status && query.status !== "ALL") {
      where.trangThai = query.status as TrangThaiChuyenXe;
    }

    const trips = await prisma.chuyenXe.findMany({
      where,
      take: limit,
      orderBy: { thoiGianDat: "desc" },
      include: {
        diemDon: true,
        diemTra: true,
        khachHang: {
          include: {
            nguoiDung: {
              select: {
                id: true,
                hoTen: true,
                soDienThoai: true,
                email: true,
              },
            },
          },
        },
        taiXe: {
          include: {
            nguoiDung: {
              select: {
                id: true,
                hoTen: true,
                soDienThoai: true,
              },
            },
          },
        },
        hoaDon: true,
        khuyenMai: true,
        lichSuHuy: true,
      },
    });

    return trips.map((t) => ({
      id: t.id,
      trangThai: t.trangThai,
      loaiDichVu: t.loaiDichVu,
      thoiGianDat: t.thoiGianDat,
      thoiGianNhan: t.thoiGianNhan,
      thoiGianHoanThanh: t.thoiGianHoanThanh,
      quangDuongKm: Number(t.quangDuongKm),
      thoiGianDuKienPhut: t.thoiGianDuKienPhut,
      soTienCuoiCung: Number(t.soTienCuoiCung),
      tienGiam: Number(t.tienGiam),
      lyDoHuy: t.lyDoHuy,
      diemDon: t.diemDon?.tenDiaDiem,
      diaChiDon: t.diemDon?.diaChiChiTiet,
      diemTra: t.diemTra?.tenDiaDiem,
      diaChiTra: t.diemTra?.diaChiChiTiet,
      khachHang: {
        id: t.khachHang.nguoiDung.id,
        hoTen: t.khachHang.nguoiDung.hoTen,
        soDienThoai: t.khachHang.nguoiDung.soDienThoai,
      },
      taiXe: t.taiXe
        ? {
            id: t.taiXe.nguoiDung.id,
            hoTen: t.taiXe.nguoiDung.hoTen,
            soDienThoai: t.taiXe.nguoiDung.soDienThoai,
            bienSoXe: t.taiXe.bienSoXe,
            loaiDichVu: t.taiXe.loaiDichVu,
            diemDanhGia: Number(t.taiXe.diemDanhGia),
          }
        : null,
      hoaDon: t.hoaDon
        ? {
            id: t.hoaDon.id,
            tongTien: Number(t.hoaDon.tongTien),
            tienGiam: Number(t.hoaDon.tienGiam),
            phuPhi: Number(t.hoaDon.phuPhi),
            soTienThanhToan: Number(t.hoaDon.soTienThanhToan),
            phuongThucThanhToan: t.hoaDon.phuongThucThanhToan,
            trangThaiThanhToan: t.hoaDon.trangThaiThanhToan,
          }
        : null,
      khuyenMai: t.khuyenMai
        ? {
            maVoucher: t.khuyenMai.maVoucher,
            tenChuongTrinh: t.khuyenMai.tenChuongTrinh,
          }
        : null,
      lichSuHuy: t.lichSuHuy
        ? {
            soPhutTaiXeDiChuyen: t.lichSuHuy.soPhutTaiXeDiChuyen,
            phiHuyChuyen: Number(t.lichSuHuy.phiHuyChuyen),
            daThuPhi: t.lichSuHuy.daThuPhi,
            lyDoHuy: t.lichSuHuy.lyDoHuy,
          }
        : null,
    }));
  }

  /**
   * Lấy danh sách tài xế trên toàn hệ thống
   */
  public async getAllDrivers() {
    const drivers = await prisma.taiXe.findMany({
      include: {
        nguoiDung: {
          select: {
            id: true,
            hoTen: true,
            soDienThoai: true,
            email: true,
            trangThai: true,
            createdAt: true,
          },
        },
      },
      orderBy: { ngayThamGia: "desc" },
    });

    return drivers.map((d) => ({
      id: d.nguoiDungId,
      hoTen: d.nguoiDung.hoTen,
      soDienThoai: d.nguoiDung.soDienThoai,
      email: d.nguoiDung.email,
      trangThaiNguoiDung: d.nguoiDung.trangThai,
      bienSoXe: d.bienSoXe,
      soGiayPhepLaiXe: d.soGiayPhepLaiXe,
      loaiDichVu: d.loaiDichVu,
      trangThaiKhaDung: d.trangThaiKhaDung,
      diemDanhGia: Number(d.diemDanhGia),
      soLuotDanhGia: d.soLuotDanhGia,
      ngayThamGia: d.ngayThamGia,
    }));
  }

  /**
   * Cập nhật trạng thái khả dụng của tài xế (Quản trị viên can thiệp)
   */
  public async updateDriverStatus(driverId: string, status: TrangThaiKhaDung) {
    const driver = await prisma.taiXe.findUnique({
      where: { nguoiDungId: driverId },
    });

    if (!driver) {
      throw new NotFoundError("Không tìm thấy tài xế trong hệ thống");
    }

    const updated = await prisma.taiXe.update({
      where: { nguoiDungId: driverId },
      data: { trangThaiKhaDung: status },
      include: {
        nguoiDung: {
          select: { hoTen: true },
        },
      },
    });

    return {
      driverId,
      hoTen: updated.nguoiDung.hoTen,
      trangThaiKhaDung: updated.trangThaiKhaDung,
    };
  }

  /**
   * Lấy danh sách toàn bộ voucher (kể cả đã hết lượt, hết hạn, tạm dừng)
   */
  public async getAllVouchers() {
    const vouchers = await prisma.khuyenMai.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return vouchers.map((v) => ({
      id: v.id,
      maVoucher: v.maVoucher,
      tenChuongTrinh: v.tenChuongTrinh,
      loaiGiamGia: v.loaiGiamGia,
      giaTriGiam: Number(v.giaTriGiam),
      giamToiDa: v.giamToiDa ? Number(v.giamToiDa) : null,
      dieuKienToiThieu: Number(v.dieuKienToiThieu),
      soLuong: v.soLuong,
      ngayBatDau: v.ngayBatDau,
      ngayKetThuc: v.ngayKetThuc,
      trangThai: v.trangThai,
      createdAt: v.createdAt,
    }));
  }

  /**
   * Bật/Tắt trạng thái hoạt động của Voucher
   */
  public async toggleVoucherStatus(voucherId: string) {
    const voucher = await prisma.khuyenMai.findUnique({
      where: { id: voucherId, deletedAt: null },
    });

    if (!voucher) {
      throw new NotFoundError("Không tìm thấy mã khuyến mại");
    }

    const nextStatus =
      voucher.trangThai === TrangThaiKhuyenMai.HOAT_DONG
        ? TrangThaiKhuyenMai.HET_HAN
        : TrangThaiKhuyenMai.HOAT_DONG;

    const updated = await prisma.khuyenMai.update({
      where: { id: voucherId },
      data: { trangThai: nextStatus },
    });

    return updated;
  }

  /**
   * Xóa mềm mã khuyến mại
   */
  public async deleteVoucher(voucherId: string) {
    const voucher = await prisma.khuyenMai.findUnique({
      where: { id: voucherId, deletedAt: null },
    });

    if (!voucher) {
      throw new NotFoundError("Không tìm thấy mã khuyến mại");
    }

    await prisma.khuyenMai.update({
      where: { id: voucherId },
      data: { deletedAt: new Date() },
    });

    return { success: true, message: `Đã xóa mã khuyến mại ${voucher.maVoucher}` };
  }

  /**
   * Lấy danh sách công nợ khách hàng (QT-04) và phí phạt tồn đọng (QT-05)
   */
  public async getDebtAndPenaltyRecords() {
    const [unpaidInvoices, uncollectedPenalties] = await Promise.all([
      // Hóa đơn chưa thanh toán của các chuyến xe đã hoàn thành
      prisma.hoaDon.findMany({
        where: {
          trangThaiThanhToan: TrangThaiThanhToan.CHUA_THANH_TOAN,
          chuyenXe: {
            trangThai: TrangThaiChuyenXe.COMPLETED,
            deletedAt: null,
          },
        },
        include: {
          chuyenXe: {
            include: {
              khachHang: {
                include: {
                  nguoiDung: {
                    select: {
                      id: true,
                      hoTen: true,
                      soDienThoai: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { chuyenXe: { thoiGianDat: "desc" } },
      }),

      // Các khoản phí phạt hủy tồn đọng chưa thu (QT-05)
      prisma.lichSuHuy.findMany({
        where: {
          daThuPhi: false,
          phiHuyChuyen: { gt: 0 },
        },
        include: {
          nguoiHuy: {
            select: {
              id: true,
              hoTen: true,
              soDienThoai: true,
              email: true,
            },
          },
          chuyenXe: {
            select: {
              id: true,
              loaiDichVu: true,
              thoiGianDat: true,
            },
          },
        },
        orderBy: { thoiGianHuy: "desc" },
      }),
    ]);

    return {
      unpaidInvoices: unpaidInvoices.map((inv) => ({
        id: inv.id,
        chuyenXeId: inv.chuyenXeId,
        soTien: Number(inv.soTienThanhToan),
        thoiGianDat: inv.chuyenXe.thoiGianDat,
        khachHang: {
          id: inv.chuyenXe.khachHang.nguoiDung.id,
          hoTen: inv.chuyenXe.khachHang.nguoiDung.hoTen,
          soDienThoai: inv.chuyenXe.khachHang.nguoiDung.soDienThoai,
          email: inv.chuyenXe.khachHang.nguoiDung.email,
        },
      })),
      uncollectedPenalties: uncollectedPenalties.map((pen) => ({
        id: pen.id,
        chuyenXeId: pen.chuyenXeId,
        phiHuyChuyen: Number(pen.phiHuyChuyen),
        soPhutTaiXeDiChuyen: pen.soPhutTaiXeDiChuyen,
        lyDoHuy: pen.lyDoHuy,
        thoiGianHuy: pen.thoiGianHuy,
        khachHang: {
          id: pen.nguoiHuy.id,
          hoTen: pen.nguoiHuy.hoTen,
          soDienThoai: pen.nguoiHuy.soDienThoai,
          email: pen.nguoiHuy.email,
        },
      })),
    };
  }
}
