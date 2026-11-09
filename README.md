# 🚗 NỀN TẢNG ĐẶT XE TRỰC TUYẾN (GRAB RIDE-HAILING PLATFORM)

Nền tảng đặt xe trực tuyến thương mại tương tự Grab, tuân thủ nghiêm ngặt chuẩn **Clean Code**, **SOLID**, bảo mật cao và khả năng mở rộng (Scalability).

---

## 🏗️ 1. TECH STACK BẮT BUỘC
* **Backend:** Node.js 20+ với TypeScript 5.6 (Kiến trúc phân tầng Controller - Service - Repository).
* **Database:** MySQL 8.0 với Prisma ORM (Type-safety, CUID PKs, Soft Delete `onDelete: Restrict`).
* **Caching & Real-time:** Redis 7 (Redis GEO Spatial Indexing `GEOADD`/`GEOSEARCH` với In-memory Spatial Fallback) và Socket.io.
* **Frontend:** React 18 (Vite) + Tailwind CSS + Lucide Icons + Leaflet (Bản đồ OpenStreetMap trực quan thời gian thực).
* **Bảo mật:** Helmet, CORS, Rate Limiting chống DDoS & brute-force, bcrypt (salt 10), JWT Access (15m) + Refresh Token (7d, Rotation).

---

## 📋 2. ÁNH XẠ 13 THỰC THỂ & QUY TẮC NGHIỆP VỤ (OOAD)

### 13 Thực thể cốt lõi:
1. `NguoiDung`: Thực thể cơ sở (Khóa chính CUID, ẩn SĐT khi log/nhắn tin, soft delete `deletedAt`).
2. `KhachHang`: Hồ sơ khách hàng.
3. `TaiXe`: Hồ sơ tài xế (Số GPLX, biển số, loại dịch vụ, trạng thái khả dụng, điểm sao đánh giá).
4. `QuanTriVien`: Hồ sơ quản trị điều hành.
5. `DiaDiem`: Tọa độ GPS kinh độ/vĩ độ, địa chỉ đón/trả.
6. `KhuyenMai`: Voucher giảm giá (`FIXED_AMOUNT` hoặc `PERCENTAGE`, điều kiện tối thiểu, số lượng).
7. `ChuyenXe`: Chuyến đi (trạng thái `PENDING` -> `ACCEPTED` -> `ARRIVED` -> `IN_PROGRESS` -> `COMPLETED`/`CANCELLED`).
8. `HoaDon`: Hóa đơn tiền mặt, ví điện tử, thẻ ngân hàng.
9. `DanhGia`: Đánh giá 1-5 sao và nhận xét.
10. `LichSuHuy`: Ghi nhận lý do hủy, số phút tài xế di chuyển, phí phạt 10.000 VNĐ (QT-05).
11. `TinNhan`: Nhắn tin nội bộ bảo vệ danh tính, ẩn số điện thoại.
12. `LichTrinh`: Các mốc lộ trình ETA dự kiến từ Map API.
13. `ToaDoGPS`: Tọa độ thực tế theo thời gian thực của tài xế.

### 5 Quy tắc nghiệp vụ bắt buộc:
* **QT-01 (Định giá tự động):** Cước = (Cự ly km × Đơn giá) + Phụ phí. Xử lý dưới 2 giây qua Map Adapter (~3ms).
* **QT-02 (Điều phối độc quyền):** Quét Redis GEO trong bán kính 5km. Bắn lệnh mời nhận cuốc độc quyền 15 giây đếm ngược tới tài xế gần nhất. Quá 15s tự động chuyển tài xế tiếp theo.
* **QT-03 (Khuyến mại & Chống Race Condition):** Tối đa 01 voucher/chuyến. Trừ `soLuong` bằng Atomic Update trong Database Transaction.
* **QT-04 (Chặn nợ cước):** Chặn tạo chuyến xe mới nếu có `HoaDon` cũ đang ở trạng thái `CHUA_THANH_TOAN` (403 Forbidden).
* **QT-05 (Phí hủy 10.000đ):** Tự động cộng 10.000 VNĐ vào hóa đơn chuyến sau nếu khách hủy khi tài xế đã di chuyển đón > 5 phút.

---

## 🚀 3. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### Cửa sổ 1: Chạy Backend API (Port 4000)
```cmd
D:
cd \grab-platform
npm install
npm run dev
```

### Cửa sổ 2: Chạy Frontend Web App (Port 3000)
```cmd
D:
cd \grab-platform\client
npm install
npm run dev
```
👉 Mở trình duyệt truy cập: **`http://localhost:3000`**

---

## 👥 4. TÀI KHOẢN MẪU ĐỂ TEST (MẬT KHẨU CHUNG: `Grab@2026`)

| Tên người dùng | Số điện thoại | Vai trò | Mục đích kiểm thử |
| :--- | :---: | :---: | :--- |
| **Nguyễn Văn Minh** | `0901234567` | Khách hàng | Đặt chuyến xe bình thường (Sạch nợ) |
| **Trần Thị Lan** | `0908889999` | Khách hàng | **Kiểm thử QT-04: Bị chặn đặt xe do nợ cước** |
| **Lê Hoàng Nam** | `0912345678` | Tài xế Ô tô | Nhận chuyến GrabCar 4 chỗ, biển số 29A-886.88 |
| **Phạm Quốc Bảo** | `0919876543` | Tài xế Xe máy | Nhận chuyến GrabBike, biển số 30G-559.12 |
| **Vũ Đức Thắng** | `0988888888` | Quản trị viên | Dashboard điều phối, quản lý Voucher |
