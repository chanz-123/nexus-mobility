import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth.context";
import { useSocket } from "../context/socket.context";
import { BrandLogo } from "./BrandLogo";
import {
  LogOut,
  Radio,
  User,
  Shield,
  Car,
  UserCheck,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // Ẩn hoàn toàn Navbar trên trang Xác thực để giữ nguyên vẹn 100% giao diện Grab chuẩn
  if (location.pathname === "/auth") {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    if (location.pathname === "/driver" || location.pathname === "/admin") {
      navigate("/");
    }
  };

  const getRoleLabel = () => {
    if (!user) return null;
    if (user.vaiTro === "TAI_XE") {
      return (
        <Link
          to="/driver"
          title="Đến trang Tài xế"
          className="flex items-center gap-1.5 text-sm font-black bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-3.5 py-1.5 rounded-full border border-emerald-300 transition-colors"
        >
          <Car className="w-4 h-4 text-emerald-700" />
          Tài xế Đối tác
        </Link>
      );
    }
    if (user.vaiTro === "QUAN_TRI_VIEN") {
      return (
        <Link
          to="/admin"
          title="Đến trang Quản trị"
          className="flex items-center gap-1.5 text-sm font-black bg-purple-100 text-purple-800 hover:bg-purple-200 px-3.5 py-1.5 rounded-full border border-purple-300 transition-colors"
        >
          <Shield className="w-4 h-4 text-purple-700" />
          Quản trị viên
        </Link>
      );
    }
    return (
      <Link
        to="/"
        title="Đến trang Đặt xe"
        className="flex items-center gap-1.5 text-sm font-black bg-blue-100 text-blue-800 hover:bg-blue-200 px-3.5 py-1.5 rounded-full border border-blue-300 transition-colors"
      >
        <UserCheck className="w-4 h-4 text-blue-700" />
        Khách hàng
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="w-full px-4 sm:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo - Futuristic Mobility Platform */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center group">
            <BrandLogo theme="nexus" size="md" />
          </Link>
        </div>

        {/* Right Section: Socket Status, Role Badge, User Info, Logout */}
        <div className="flex items-center gap-3.5">
          {/* Realtime Status */}
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-black transition-all ${
              !user
                ? "bg-gray-100 text-gray-600 border border-gray-300"
                : connected
                ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                : "bg-amber-50 text-amber-700 border border-amber-300"
            }`}
          >
            <Radio
              className={`w-4 h-4 ${
                !user
                  ? "text-gray-400"
                  : connected
                  ? "text-emerald-600 animate-pulse"
                  : "text-amber-500 animate-bounce"
              }`}
            />
            <span className="hidden md:inline">
              {!user
                ? "Chưa đăng nhập"
                : connected
                ? "Realtime Online"
                : "Đang nối Realtime..."}
            </span>
          </div>

          {/* Role Badge if logged in */}
          {user && <div className="hidden sm:block">{getRoleLabel()}</div>}

          {/* User Profile Info & Logout */}
          {user ? (
            <div className="flex items-center gap-3 border-l-2 pl-3.5 border-gray-200">
              <div className="text-right hidden sm:block">
                <span className="text-sm sm:text-base font-black text-gray-900 block leading-tight">
                  {user.hoTen}
                </span>
                <span className="text-xs text-gray-500 font-bold">{user.soDienThoai || user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-3 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-sm sm:text-base font-black shadow-lg shadow-emerald-600/25 transition-all"
            >
              <User className="w-4 h-4" />
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
