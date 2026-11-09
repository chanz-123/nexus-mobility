import "dotenv/config";
import { z } from "zod";

/** Validate biến môi trường ngay khi khởi động (fail-fast). */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  DISPATCH_TIMEOUT_SECONDS: z.coerce.number().default(15),
  CANCELLATION_FEE_AMOUNT: z.coerce.number().default(10000),
  CANCELLATION_TIME_THRESHOLD_MINUTES: z.coerce.number().default(5),
  MAX_SEARCH_RADIUS_KM: z.coerce.number().default(5.0),

  // Cấu hình SMTP gửi Email OTP thực
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("Grab Platform <no-reply@grab.com>"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Biến môi trường không hợp lệ:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
