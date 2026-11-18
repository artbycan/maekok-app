// lib/prisma.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ขยาย type ของ global ให้มี property prisma
type CustomGlobal = typeof global & {
  prisma?: PrismaClient;
};

const globalWithPrisma = global as CustomGlobal;

const rawConnectionString = process.env.DATABASE_URL ?? "";
const connectionString = rawConnectionString
  .trim()
  .replace(/^(['"])(.*)\1$/, "$2");

const adapter = new PrismaPg({
  connectionString,
});

// สร้างหรือ reuse instance
export const prisma =
  globalWithPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

// ใน dev mode ให้เก็บ instance ไว้ใน global ไม่สร้างซ้ำเวลารันใหม่
if (process.env.NODE_ENV !== "production") {
  globalWithPrisma.prisma = prisma;
}
