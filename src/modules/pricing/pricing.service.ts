import { LoaiDichVu, LoaiGiamGia, KhuyenMai } from "@prisma/client";
import { SERVICE_TARIFFS, ServiceTariff } from "./pricing.constants";
import { BadRequestError } from "../../common/exceptions/app-error";

export interface PricingInput {
  loaiDichVu: LoaiDichVu;
  quangDuongKm: number;
  phiHuyTonDong?: number; // Phí phạt 10.000đ từ chuyến trước (QT-05)
  voucher?: KhuyenMai | null;
  strictVoucherCheck?: boolean; // false khi tính cước ước tính, true khi tạo chuyến xe
}

export interface PricingBreakdown {
  quangDuongKm: number;
  giaMoCua: number;
  cuocQuangDuong: number;
  phuPhiGioCaoDiem: number;
  phiHuyTonDong: number;
  tongTienGoc: number;      // Trước khi giảm giá
  tienGiam: number;          // Tiền voucher giảm (QT-03)
  soTienCuoiCung: number;   // Số tiền khách cần trả
  maVoucher?: string;
  voucherMessage?: string;
}

export class PricingService {
  /**
   * Tính toán cước phí tự động theo QT-01:
   * Cước = (Cự ly km × Đơn giá) + Phụ phí [+ Phí phạt hủy tồn đọng QT-05]
   * Xử lý dưới 2 giây.
   */
  public calculateFare(input: PricingInput): PricingBreakdown {
    const tariff: ServiceTariff = SERVICE_TARIFFS[input.loaiDichVu];
    if (!tariff) {
      throw new BadRequestError(`Không tìm thấy biểu giá cho loại dịch vụ: ${input.loaiDichVu}`);
    }

    const distance = Math.max(0.5, input.quangDuongKm);

    // 1. Tính giá mở cửa và cước theo km
    const giaMoCua = tariff.basePrice;
    let cuocQuangDuong = 0;
    if (distance > tariff.baseDistanceKm) {
      const extraKm = distance - tariff.baseDistanceKm;
      cuocQuangDuong = Math.round(extraKm * tariff.pricePerKm);
    }

    // 2. Tính phụ phí giờ cao điểm (7h-9h sáng & 17h-19h tối: phụ phí 10.000đ)
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
    const phuPhiGioCaoDiem = isPeakHour ? 10000 : 0;

    // 3. Phí phạt hủy từ chuyến trước (QT-05)
    const phiHuyTonDong = input.phiHuyTonDong || 0;

    // 4. Tổng tiền cước xe và tổng tiền gốc
    const tienCuocXe = giaMoCua + cuocQuangDuong + phuPhiGioCaoDiem;
    const tongTienGoc = tienCuocXe + phiHuyTonDong;

    // 5. Tính giảm giá theo voucher (QT-03: Tối đa 01 voucher/chuyến)
    // Voucher chỉ giảm trên cước di chuyển, không trừ vào phí phạt hủy tồn đọng
    let tienGiam = 0;
    let voucherMessage: string | undefined;

    if (input.voucher) {
      const minSpend = Number(input.voucher.dieuKienToiThieu);
      if (tienCuocXe < minSpend) {
        if (input.strictVoucherCheck) {
          throw new BadRequestError(
            `Voucher ${input.voucher.maVoucher} yêu cầu giá trị cước chuyến xe tối thiểu từ ${minSpend.toLocaleString("vi-VN")} VNĐ`
          );
        } else {
          voucherMessage = `Đơn tối thiểu ${minSpend.toLocaleString("vi-VN")}đ`;
        }
      } else {
        tienGiam = this.calculateVoucherDiscount(tienCuocXe, input.voucher);
        // Tiền giảm không được vượt quá tiền cước chuyến đi
        tienGiam = Math.min(tienGiam, tienCuocXe);
      }
    }

    // 6. Số tiền cuối cùng (Cước sau giảm + Phí phạt hủy tồn đọng QT-05)
    const soTienCuoiCung = Math.max(0, tienCuocXe - tienGiam) + phiHuyTonDong;

    return {
      quangDuongKm: Number(distance.toFixed(2)),
      giaMoCua,
      cuocQuangDuong,
      phuPhiGioCaoDiem,
      phiHuyTonDong,
      tongTienGoc,
      tienGiam,
      soTienCuoiCung,
      maVoucher: input.voucher?.maVoucher,
      voucherMessage,
    };
  }

  /**
   * Tính số tiền giảm của Voucher (QT-03)
   */
  public calculateVoucherDiscount(tongTien: number, voucher: KhuyenMai): number {
    let discount = 0;
    if (voucher.loaiGiamGia === LoaiGiamGia.FIXED_AMOUNT) {
      discount = Number(voucher.giaTriGiam);
    } else if (voucher.loaiGiamGia === LoaiGiamGia.PERCENTAGE) {
      const percentage = Number(voucher.giaTriGiam);
      discount = Math.round(tongTien * (percentage / 100));

      if (voucher.giamToiDa !== null) {
        const maxDiscount = Number(voucher.giamToiDa);
        discount = Math.min(discount, maxDiscount);
      }
    }

    // Không được giảm vượt quá tổng tiền gốc
    return Math.min(discount, tongTien);
  }
}
