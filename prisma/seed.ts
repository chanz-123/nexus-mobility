import { PrismaClient, VaiTro, LoaiDichVu, TrangThaiChuyenXe, TrangThaiThanhToan, PhuongThucThanhToan, LoaiGiamGia, TrangThaiKhaDung } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Grab@2026"; // chỉ dùng cho dữ liệu mẫu

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  // Idempotent: seed lại không bị trùng (hỗ trợ cả Số điện thoại và Email)
  const user = (soDienThoai: string, email: string, hoTen: string, vaiTro: VaiTro) =>
    prisma.nguoiDung.upsert({
      where: { soDienThoai },
      update: { email },
      create: { soDienThoai, email, hoTen, vaiTro, matKhauHash: hash },
    });

  const [minh, lan, nam, bao, thang] = await Promise.all([
    user("0901234567", "minh.nguyen@grab.com", "Nguyễn Văn Minh", VaiTro.KHACH_HANG),
    user("0908889999", "lan.tran@grab.com", "Trần Thị Lan", VaiTro.KHACH_HANG),
    user("0912345678", "nam.le@grab.com", "Lê Hoàng Nam", VaiTro.TAI_XE),
    user("0919876543", "bao.pham@grab.com", "Phạm Quốc Bảo", VaiTro.TAI_XE),
    user("0988888888", "thang.vu@grab.com", "Vũ Đức Thắng", VaiTro.QUAN_TRI_VIEN),
  ]);

  for (const k of [minh, lan]) {
    await prisma.khachHang.upsert({ where: { nguoiDungId: k.id }, update: {}, create: { nguoiDungId: k.id } });
  }

  await prisma.taiXe.upsert({
    where: { nguoiDungId: nam.id },
    update: {},
    create: { nguoiDungId: nam.id, soGiayPhepLaiXe: "790123456789", bienSoXe: "29A-886.88", loaiDichVu: LoaiDichVu.GRAB_CAR_4, trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG, diemDanhGia: 4.92, soLuotDanhGia: 120 },
  });
  await prisma.taiXe.upsert({
    where: { nguoiDungId: bao.id },
    update: {},
    create: { nguoiDungId: bao.id, soGiayPhepLaiXe: "790987654321", bienSoXe: "30G-559.12", loaiDichVu: LoaiDichVu.GRAB_BIKE, trangThaiKhaDung: TrangThaiKhaDung.SAN_SANG, diemDanhGia: 4.85, soLuotDanhGia: 86 },
  });
  await prisma.quanTriVien.upsert({
    where: { nguoiDungId: thang.id },
    update: {},
    create: { nguoiDungId: thang.id, phongBan: "Trung tâm Điều hành", chucVu: "Quản trị viên Hệ thống" },
  });

  // Địa điểm (Hà Nội)
  const places = [
    ["ĐH Bách Khoa Hà Nội", "1 Đại Cồ Việt, Hai Bà Trưng", 105.8431, 21.0056],
    ["Hồ Hoàn Kiếm", "Đinh Tiên Hoàng, Hoàn Kiếm", 105.8525, 21.0285],
    ["Bến xe Mỹ Đình", "20 Phạm Hùng, Nam Từ Liêm", 105.7783, 21.0287],
    ["Royal City", "72A Nguyễn Trãi, Thanh Xuân", 105.8156, 21.0028],
    ["Lotte Center Hà Nội", "54 Liễu Giai, Ba Đình", 105.8123, 21.0319],
  ] as const;
  const dd = await prisma.diaDiem.count();
  if (dd === 0) {
    await prisma.diaDiem.createMany({
      data: places.map(([tenDiaDiem, diaChiChiTiet, kinhDo, viDo]) => ({ tenDiaDiem, diaChiChiTiet, kinhDo, viDo })),
    });
  }
  const [bk, hg] = await prisma.diaDiem.findMany({ take: 2, orderBy: { createdAt: "asc" } });

  // Khuyến mại
  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, 11, 31);
  await prisma.khuyenMai.upsert({
    where: { maVoucher: "GRAB20K" },
    update: {},
    create: { maVoucher: "GRAB20K", tenChuongTrinh: "Giảm 20.000đ cho chuyến từ 40.000đ", loaiGiamGia: LoaiGiamGia.FIXED_AMOUNT, giaTriGiam: 20000, dieuKienToiThieu: 40000, ngayBatDau: now, ngayKetThuc: nextYear, soLuong: 100 },
  });
  await prisma.khuyenMai.upsert({
    where: { maVoucher: "GRAB15PCT" },
    update: {},
    create: { maVoucher: "GRAB15PCT", tenChuongTrinh: "Giảm 15% tối đa 30.000đ", loaiGiamGia: LoaiGiamGia.PERCENTAGE, giaTriGiam: 15, giamToiDa: 30000, dieuKienToiThieu: 50000, ngayBatDau: now, ngayKetThuc: nextYear, soLuong: 50 },
  });

  // Dữ liệu chuyến mẫu (chỉ tạo khi DB chưa có chuyến)
  if ((await prisma.chuyenXe.count()) === 0 && bk && hg) {
    // Minh: chuyến đã hoàn thành + đã thanh toán
    const done = await prisma.chuyenXe.create({
      data: {
        khachHangId: minh.id, taiXeId: nam.id, diemDonId: bk.id, diemTraId: hg.id,
        loaiDichVu: LoaiDichVu.GRAB_CAR_4, trangThai: TrangThaiChuyenXe.COMPLETED,
        thoiGianNhan: new Date(now.getTime() - 40 * 60000), thoiGianHoanThanh: new Date(now.getTime() - 15 * 60000),
        quangDuongKm: 4.2, thoiGianDuKienPhut: 14, soTienCuoiCung: 80400,
      },
    });
    await prisma.hoaDon.create({
      data: { chuyenXeId: done.id, tongTien: 70400, phuPhi: 10000, soTienThanhToan: 80400, phuongThucThanhToan: PhuongThucThanhToan.VI_DIEN_TU, trangThaiThanhToan: TrangThaiThanhToan.DA_THANH_TOAN, maGiaoDichCong: "SEED-TXN-0001", thoiGianThanhToan: now },
    });

    // Lan: còn nợ cước -> test QT-04 (bị chặn đặt xe)
    const debt = await prisma.chuyenXe.create({
      data: {
        khachHangId: lan.id, taiXeId: bao.id, diemDonId: hg.id, diemTraId: bk.id,
        loaiDichVu: LoaiDichVu.GRAB_BIKE, trangThai: TrangThaiChuyenXe.COMPLETED,
        thoiGianHoanThanh: new Date(now.getTime() - 3600000),
        quangDuongKm: 4.2, thoiGianDuKienPhut: 14, soTienCuoiCung: 110500,
      },
    });
    await prisma.hoaDon.create({
      data: { chuyenXeId: debt.id, tongTien: 110500, soTienThanhToan: 110500, phuongThucThanhToan: PhuongThucThanhToan.THE_NGAN_HANG, trangThaiThanhToan: TrangThaiThanhToan.CHUA_THANH_TOAN },
    });
  }

  console.log("Seed hoàn tất. Mật khẩu mẫu cho mọi tài khoản:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
