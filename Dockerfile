# ── Stage 1: Build React client ──────────────────────────────────────────────
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
# Use relative API paths so one URL serves everything
RUN VITE_API_URL=/api VITE_ANALYSIS_URL=/ml npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app/server

# Build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm install --production

COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

# Default dirs (overridden by volume mounts in production)
RUN mkdir -p /data /uploads/images /uploads/videos /uploads/audio \
             /uploads/documents /uploads/datasets /uploads/logos

EXPOSE 8080

ENV PORT=8080 \
    NODE_ENV=production \
    DATABASE_PATH=/data/source-water.db \
    UPLOAD_DIR=/uploads

CMD ["node", "index.js"]
