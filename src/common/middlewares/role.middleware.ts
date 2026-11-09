import { Request, Response, NextFunction } from "express";
import { VaiTro } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../exceptions/app-error";

export const requireRoles = (...allowedRoles: VaiTro[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Yêu cầu xác thực tài khoản trước"));
      return;
    }

    if (!allowedRoles.includes(req.user.vaiTro)) {
      next(
        new ForbiddenError(
          `Bạn không có quyền thực hiện hành động này. Yêu cầu một trong các vai trò: ${allowedRoles.join(
            ", "
          )}`
        )
      );
      return;
    }

    next();
  };
};
