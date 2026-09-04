# Kayseri Ulaşım - Saha Arıza ve İstasyon Rota Yönetim Portalı
# Multi-Stage Node.js Dockerfile

# Stage 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native sqlite3 build if needed
RUN apk add --no-cache python3 make g++ sqlite

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY app ./app

RUN npm run build

# Stage 2: Production Lightweight Image
FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=5001 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

WORKDIR /app

RUN apk add --no-cache curl sqlite

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY app ./app
COPY data ./data

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/auth/durum || exit 1

CMD ["node", "dist/server.js"]
