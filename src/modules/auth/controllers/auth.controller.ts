import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import {
  SendOtpSchema,
  VerifyOtpSchema,
  RegisterSchema,
  LoginSchema,
  LoginOtpSchema,
  RefreshTokenSchema,
} from "../dtos/auth.dto";

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  public sendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = SendOtpSchema.parse(req.body);
      const result = await this.authService.sendOtp(validated.identifier);
      res.status(200).json({
        success: true,
        message: result.message || "Mã OTP đã được gửi thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = VerifyOtpSchema.parse(req.body);
      const result = this.authService.verifyOtp(validated.identifier, validated.otpCode);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = RegisterSchema.parse(req.body);
      const result = await this.authService.register(validated);
      res.status(201).json({
        success: true,
        message: "Đăng ký tài khoản thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = LoginSchema.parse(req.body);
      const result = await this.authService.login(validated);
      res.status(200).json({
        success: true,
        message: "Đăng nhập thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public loginWithOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = LoginOtpSchema.parse(req.body);
      const result = await this.authService.loginWithOtp(validated);
      res.status(200).json({
        success: true,
        message: "Đăng nhập bằng mã OTP thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = RefreshTokenSchema.parse(req.body);
      const tokens = await this.authService.refreshTokens(validated);
      res.status(200).json({
        success: true,
        message: "Làm mới phiên đăng nhập thành công",
        data: { tokens },
      });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await this.authService.logout(userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const profile = await this.authService.getProfile(userId);
      res.status(200).json({
        success: true,
        data: { user: profile },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPendingAdmins = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const admins = await this.authService.getPendingAdmins();
      res.status(200).json({
        success: true,
        data: admins,
      });
    } catch (error) {
      next(error);
    }
  };

  public approveAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = String(req.params.id);
      const adminUserId = req.user!.id;
      const result = await this.authService.approveAdmin(adminUserId, targetUserId);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  public rejectAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = String(req.params.id);
      const adminUserId = req.user!.id;
      const result = await this.authService.rejectAdmin(adminUserId, targetUserId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };
}
