import React from "react";
import { Car, Users } from "lucide-react";

export type ServiceType = "GRAB_BIKE" | "GRAB_CAR_4" | "GRAB_CAR_7";

interface ServiceOption {
  loaiDichVu: ServiceType;
  name: string;
  desc: string;
  capacity: string;
  soTienCuoiCung: number;
  tongTienGoc: number;
  tienGiam: number;
  icon: typeof Car;
}

interface ServiceSelectorProps {
  selectedService: ServiceType;
  onSelect: (type: ServiceType) => void;
  options: ServiceOption[];
  disabled?: boolean;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  selectedService,
  onSelect,
  options,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const isSelected = selectedService === opt.loaiDichVu;
        const Icon = opt.icon;

        return (
          <div
            key={opt.loaiDichVu}
            onClick={() => !disabled && onSelect(opt.loaiDichVu)}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
              isSelected
                ? "border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            } ${disabled ? "opacity-60 cursor-not-allowed" : "active:scale-[0.99]"}`}
          >
            {/* Cột trái: Icon xe + Tên loại xe + Số chỗ */}
            <div className="flex items-center gap-4">
              <div
                className={`p-3.5 rounded-2xl transition-all ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <Icon className="w-7 h-7" />
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h4 className="font-black text-base sm:text-lg text-gray-900 tracking-tight">
                    {opt.name}
                  </h4>
                  <span className="flex items-center gap-1 text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
                    <Users className="w-3.5 h-3.5 text-gray-500" />
                    {opt.capacity}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 font-semibold mt-0.5">{opt.desc}</p>
              </div>
            </div>

            {/* Cột phải: Giá cước to, rõ ràng */}
            <div className="text-right">
              {opt.tienGiam > 0 && (
                <span className="text-xs sm:text-sm text-gray-400 line-through font-bold mr-2 block sm:inline">
                  {opt.tongTienGoc.toLocaleString("vi-VN")}đ
                </span>
              )}
              <span className="text-lg sm:text-2xl font-black text-emerald-700">
                {opt.soTienCuoiCung.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
