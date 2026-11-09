import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./common/utils/logger";
import { prisma } from "./config/prisma";
import { SocketService } from "./common/socket/socket.service";

const app = createApp();
const httpServer = http.createServer(app);

// Khởi tạo Socket.IO Server thời gian thực
SocketService.getInstance().initialize(httpServer);

const server = httpServer.listen(env.PORT, () => {
  logger.info(`=======================================================`);
  logger.info(`🚗 GRAB RIDE-HAILING PLATFORM BACKEND API STARTED`);
  logger.info(`📡 Port: http://localhost:${env.PORT}`);
  logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  logger.info(`🔒 Security: Helmet, CORS, Rate-Limiting, JWT, Bcrypt`);
  logger.info(`⚡ Realtime: Socket.io + Redis GEO Spatial Dispatch (QT-02)`);
  logger.info(`🏥 Health Check: http://localhost:${env.PORT}/api/health`);
  logger.info(`🔑 Auth Endpoints: http://localhost:${env.PORT}/api/v1/auth`);
  logger.info(`🚕 Trip Endpoints: http://localhost:${env.PORT}/api/v1/trips`);
  logger.info(`📡 Dispatch Endpoints: http://localhost:${env.PORT}/api/v1/dispatch`);
  logger.info(`=======================================================`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info(`Nhận tín hiệu ${signal}. Đang tắt dịch vụ an toàn...`);
  server.close(async () => {
    logger.info("Đã đóng kết nối HTTP & WebSocket server.");
    try {
      await prisma.$disconnect();
      logger.info("Đã ngắt kết nối cơ sở dữ liệu.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Lỗi khi ngắt kết nối cơ sở dữ liệu");
      process.exit(1);
    }
  });

  // Buộc tắt sau 10s nếu còn tác vụ kẹt
  setTimeout(() => {
    logger.error("Quá thời gian chờ đóng kết nối (10s), buộc dừng tiến trình.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught Exception");
  process.exit(1);
});
