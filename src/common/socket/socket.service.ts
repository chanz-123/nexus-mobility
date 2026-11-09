import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { JwtUtil } from "../utils/jwt.util";
import { logger } from "../utils/logger";
import { AuthUser } from "../types/auth.types";
import { ServerToClientEvents, ClientToServerEvents } from "./socket.types";
import { prisma } from "../../config/prisma";
import { VaiTro, TrangThaiNguoiDung } from "@prisma/client";

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthUser }>;

export class SocketService {
  private static instance: SocketService;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: AuthUser }> | null = null;

  public static getInstance(): SocketService {
    if (!this.instance) {
      this.instance = new SocketService();
    }
    return this.instance;
  }

  public initialize(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    // 1. JWT Authentication Middleware cho Socket connection
    this.io.use(async (socket: AppSocket, next) => {
      try {
        const token =
          (socket.handshake.auth?.token as string) ||
          (socket.handshake.headers.authorization?.replace("Bearer ", "") as string);

        if (!token) {
          return next(new Error("Xác thực thất bại: Thiếu JWT Token"));
        }

        const decoded = JwtUtil.verifyAccessToken(token);
        const user = await prisma.nguoiDung.findUnique({
          where: { id: decoded.userId },
          include: {
            khachHang: { select: { nguoiDungId: true } },
            taiXe: { select: { nguoiDungId: true } },
            quanTriVien: { select: { nguoiDungId: true } },
          },
        });

        if (!user || user.deletedAt !== null || user.trangThai === TrangThaiNguoiDung.TAM_KHOA) {
          return next(new Error("Tài khoản không hợp lệ hoặc đã bị khóa"));
        }

        socket.data.user = {
          id: user.id,
          soDienThoai: user.soDienThoai || "",
          email: user.email || undefined,
          hoTen: user.hoTen,
          vaiTro: user.vaiTro,
          trangThai: user.trangThai,
          khachHangId: user.khachHang?.nguoiDungId,
          taiXeId: user.taiXe?.nguoiDungId,
          quanTriVienId: user.quanTriVien?.nguoiDungId,
        };

        next();
      } catch (err) {
        logger.warn({ err }, "Socket Auth Handshake rejected");
        next(new Error("Token không hợp lệ hoặc đã hết hạn"));
      }
    });

    // 2. Xử lý Connection & Rooms
    this.io.on("connection", (socket: AppSocket) => {
      const user = socket.data.user;
      logger.info({ userId: user.id, vaiTro: user.vaiTro, socketId: socket.id }, "Client đã kết nối Socket");

      // Room riêng theo User ID
      socket.join(`user:${user.id}`);

      // Nếu là Tài xế -> vào room riêng cho tài xế
      if (user.vaiTro === VaiTro.TAI_XE) {
        if (user.taiXeId) socket.join(`driver:${user.taiXeId}`);
        socket.join(`driver:${user.id}`);
      }

      // Khách hoặc Tài xế tham gia theo dõi chuyến xe
      socket.on("trip:join", ({ tripId }) => {
        socket.join(`trip:${tripId}`);
        logger.debug({ userId: user.id, tripId }, "User đã tham gia room chuyến xe");
      });

      socket.on("disconnect", (reason) => {
        logger.info({ userId: user.id, reason }, "Client đã ngắt kết nối Socket");
      });
    });

    return this.io;
  }

  public getIO() {
    if (!this.io) {
      throw new Error("SocketService chưa được khởi tạo với HttpServer!");
    }
    return this.io;
  }

  /**
   * Bắn sự kiện đến một tài xế cụ thể (Exclusive Offer)
   */
  public emitToDriver(driverId: string, event: keyof ServerToClientEvents, payload: unknown) {
    if (!this.io) return;
    // @ts-expect-error dynamic emit
    this.io.to(`driver:${driverId}`).emit(event, payload);
    // @ts-expect-error dynamic emit
    this.io.to(`user:${driverId}`).emit(event, payload);
  }

  /**
   * Bắn sự kiện đến một người dùng cụ thể
   */
  public emitToUser(userId: string, event: keyof ServerToClientEvents, payload: unknown) {
    if (!this.io) return;
    // @ts-expect-error dynamic emit
    this.io.to(`user:${userId}`).emit(event, payload);
  }

  /**
   * Bắn sự kiện đến tất cả thành viên trong phòng chuyến xe (Khách + Tài xế)
   */
  public emitToTrip(tripId: string, event: keyof ServerToClientEvents, payload: unknown) {
    if (!this.io) return;
    // @ts-expect-error dynamic emit
    this.io.to(`trip:${tripId}`).emit(event, payload);
  }
}
