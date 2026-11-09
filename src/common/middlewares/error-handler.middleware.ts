import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../exceptions/app-error";
import { logger } from "../utils/logger";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      errorCode: "VALIDATION_ERROR",
      message: "Dữ liệu đầu vào không hợp lệ",
      errors: formattedErrors,
    });
    return;
  }

  // 2. Custom App Operational Errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, "Operational 5xx Error");
    }

    res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ code: err.code, meta: err.meta, path: req.path }, "Prisma Known Error");

    if (err.code === "P2002") {
      const target = (err.meta?.target as string[]) || ["Dữ liệu"];
      res.status(409).json({
        success: false,
        errorCode: "UNIQUE_CONSTRAINT_VIOLATION",
        message: `Giá trị của trường ${target} đã tồn tại trong hệ thống`,
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        errorCode: "RECORD_NOT_FOUND",
        message: "Không tìm thấy bản ghi tương ứng trong cơ sở dữ liệu",
      });
      return;
    }

    res.status(400).json({
      success: false,
      errorCode: "DATABASE_OPERATION_ERROR",
      message: "Lỗi thao tác cơ sở dữ liệu",
    });
    return;
  }

  // 4. Unhandled / Fatal Errors
  logger.fatal({ err, path: req.path, method: req.method }, "Unhandled Internal Error");

  res.status(500).json({
    success: false,
    errorCode: "INTERNAL_SERVER_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau."
        : err.message,
  });
};
