# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app

# prisma.config.ts ต้องมี DATABASE_URL ตอน build (prisma generate / next build)
# แต่ยังไม่ต้องต่อ DB จริง ค่าจริงจะถูกส่งเข้ามาตอน runtime ผ่าน .env แทน
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:24-alpine AS runner
WORKDIR /app

# ติดตั้งเฉพาะ production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# เอา node_modules, prisma schema, และ build output จาก builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma      ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/generated    ./generated
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/public       ./public
COPY --from=builder /app/next.config.ts    ./
COPY --from=builder /app/postcss.config.mjs ./

EXPOSE 3000

# รัน migration ตอนเริ่ม container และเริ่มแอป
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
