import React from "react";

export type BrandTheme = "nexus" | "pulse" | "aura" | "veloce";

interface BrandLogoProps {
  theme?: BrandTheme;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  customBadge?: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  theme = "nexus",
  size = "md",
  showBadge = true,
  customBadge,
  className = "",
}) => {
  const iconDimensions = {
    sm: "w-8 h-8 rounded-xl",
    md: "w-10 h-10 rounded-2xl",
    lg: "w-14 h-14 rounded-3xl",
  };

  const textDimensions = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  const badgeDimensions = {
    sm: "text-[9px] px-2 py-0.5 tracking-wider",
    md: "text-[10px] px-2.5 py-0.5 tracking-wider",
    lg: "text-xs px-3 py-1 tracking-widest",
  };

  // Cấu hình các phong cách thương hiệu công nghệ cao cấp
  const brandConfigs = {
    nexus: {
      namePrefix: "NEXUS",
      nameSuffix: "",
      badgeDefault: "MOBILITY",
      gradient: "from-emerald-600 via-teal-600 to-cyan-500",
      textColor: "text-emerald-950",
      accentColor: "text-emerald-600",
      badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-300/80",
      shadow: "shadow-emerald-600/25",
      svg: (
        // Biểu tượng Nexus: Liên kết Möbius 2 giao điểm uốn lượn tượng trưng cho Mạng lưới kết nối Khách - Tài xế
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[68%] h-[68%]"
        >
          <path
            d="M6 22L16 6L26 22"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
          />
          <path
            d="M10 26L16 16L22 26"
            stroke="#A7F3D0"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="2.2" fill="white" />
        </svg>
      ),
    },
    pulse: {
      namePrefix: "PULSE",
      nameSuffix: "GO",
      badgeDefault: "SMART RIDE",
      gradient: "from-emerald-500 via-green-600 to-teal-700",
      textColor: "text-gray-900",
      accentColor: "text-teal-600",
      badgeBg: "bg-teal-50 text-teal-800 border-teal-300",
      shadow: "shadow-teal-600/25",
      svg: (
        // Biểu tượng Pulse: Xung nhịp tốc độ & định vị GPS
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[68%] h-[68%]"
        >
          <path
            d="M4 16H9L13 7L19 25L23 16H28"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    aura: {
      namePrefix: "AURA",
      nameSuffix: "DRIVE",
      badgeDefault: "PLATFORM",
      gradient: "from-teal-600 to-emerald-700",
      textColor: "text-slate-900",
      accentColor: "text-emerald-600",
      badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-300",
      shadow: "shadow-emerald-700/25",
      svg: (
        // Biểu tượng Aura: Cánh cung khí động học tinh giản
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[68%] h-[68%]"
        >
          <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="2.8" opacity="0.4" />
          <path
            d="M8 16C8 11.58 11.58 8 16 8C20.42 8 24 11.58 24 16"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="3.5" fill="white" />
        </svg>
      ),
    },
    veloce: {
      namePrefix: "VELO",
      nameSuffix: "RIDE",
      badgeDefault: "EXPRESS",
      gradient: "from-emerald-600 to-cyan-600",
      textColor: "text-gray-900",
      accentColor: "text-cyan-600",
      badgeBg: "bg-cyan-50 text-cyan-800 border-cyan-300",
      shadow: "shadow-cyan-600/25",
      svg: (
        // Biểu tượng Velo: Mũi tên tốc độ đôi
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[68%] h-[68%]"
        >
          <path
            d="M9 7L18 16L9 25M16 7L25 16L16 25"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  };

  const config = brandConfigs[theme] || brandConfigs.nexus;
  const badgeText = customBadge || config.badgeDefault;

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Biểu tượng Vector Hình khối Công nghệ cao */}
      <div
        className={`${iconDimensions[size]} bg-gradient-to-tr ${config.gradient} flex items-center justify-center shadow-lg ${config.shadow} flex-shrink-0 transition-transform duration-200 hover:scale-105 border border-white/20`}
      >
        {config.svg}
      </div>

      {/* Typography thương hiệu */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-baseline tracking-tight">
          <span
            className={`font-black ${config.textColor} ${textDimensions[size]}`}
            style={{ letterSpacing: "-0.035em" }}
          >
            {config.namePrefix}
          </span>
          {config.nameSuffix && (
            <span
              className={`font-black ${config.accentColor} ${textDimensions[size]} ml-0.5`}
              style={{ letterSpacing: "-0.035em" }}
            >
              {config.nameSuffix}
            </span>
          )}
        </div>

        {showBadge && (
          <span
            className={`font-black uppercase rounded-full border shadow-sm ${config.badgeBg} ${badgeDimensions[size]}`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
