import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../exceptions/app-error";
import { TokenPayload, JwtTokens } from "../types/auth.types";
import { env } from "../../config/env";

export class JwtUtil {
  public static generateTokens(payload: Omit<TokenPayload, "tokenType">): JwtTokens {
    const accessPayload: TokenPayload = {
      ...payload,
      tokenType: "ACCESS",
    };

    const refreshPayload: TokenPayload = {
      ...payload,
      tokenType: "REFRESH",
    };

    const accessToken = jwt.sign(accessPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
    });

    const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL,
    };
  }

  public static verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      if (decoded.tokenType !== "ACCESS") {
        throw new UnauthorizedError("Loại token không hợp lệ");
      }
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Phiên đăng nhập đã hết hạn, vui lòng làm mới token");
      }
      throw new UnauthorizedError("Token không hợp lệ");
    }
  }

  public static verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
      if (decoded.tokenType !== "REFRESH") {
        throw new UnauthorizedError("Loại token không hợp lệ");
      }
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Refresh token đã hết hạn, vui lòng đăng nhập lại");
      }
      throw new UnauthorizedError("Refresh token không hợp lệ");
    }
  }
}
