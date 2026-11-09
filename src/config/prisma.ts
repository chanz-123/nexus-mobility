import { PrismaClient } from "@prisma/client";
import { logger } from "../common/utils/logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
  });

if (process.env.NODE_ENV === "development") {
  // @ts-expect-error Prisma event typing
  prisma.$on("query", (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, durationMs: e.duration }, "Database Query");
  });
}

// @ts-expect-error Prisma event typing
prisma.$on("error", (e: { message: string }) => {
  logger.error({ error: e.message }, "Database Error");
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
