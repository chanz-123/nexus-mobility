import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import { errorHandler } from "./common/middlewares/error-handler.middleware";
import { generalRateLimiter } from "./common/middlewares/rate-limiter.middleware";
import { authRoutes } from "./modules/auth/auth.routes";
import { tripRoutes } from "./modules/trip/trip.routes";
import { dispatchRoutes } from "./modules/dispatch/dispatch.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { NotFoundError } from "./common/exceptions/app-error";

export const createApp = (): Application => {
  const app = express();

  // 1. Bảo mật HTTP Headers (Cấu hình CSP cho phép tải bản đồ OpenStreetMap & định tuyến OSRM)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://*.tile.openstreetmap.org",
            "https://tile.openstreetmap.org",
            "https://*.basemaps.cartocdn.com",
            "https://basemaps.cartocdn.com",
            "https://unpkg.com",
          ],
          connectSrc: [
            "'self'",
            "ws:",
            "wss:",
            "https://*.tile.openstreetmap.org",
            "https://tile.openstreetmap.org",
            "https://router.project-osrm.org",
          ],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // 2. Cấu hình CORS
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // 3. Body Parsers
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // 4. Rate Limiting toàn hệ thống
  app.use(generalRateLimiter);

  // 5. Health check & Root endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "UP",
      service: "grab-platform-api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // 6. API v1 Modules
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/trips", tripRoutes);
  app.use("/api/v1/dispatch", dispatchRoutes);
  app.use("/api/v1/admin", adminRoutes);

  // 7. Phục vụ Frontend tĩnh (Khi build client/dist có sẵn)
  const clientDist = path.join(process.cwd(), "client", "dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // 8. Route Not Found (404)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Đường dẫn ${req.method} ${req.originalUrl} không tồn tại trên hệ thống`));
  });

  // 9. Global Error Handler (Bắt buộc đặt cuối cùng)
  app.use(errorHandler);

  return app;
};
