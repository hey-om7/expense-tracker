# Single image: Express serves the API (/api) and the built React app (everything else).
# Works for `docker compose up` locally and Render's Docker runtime.

# ── Stage 1: build the frontend ──
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci -w frontend --include-workspace-root=false

COPY frontend/ frontend/

# VITE_* values are baked into the JS bundle at build time (public values only, never secrets).
# Render passes service env vars as build args automatically when declared here.
ARG VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build -w frontend

# ── Stage 2: backend production dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci -w backend --omit=dev --include-workspace-root=false && npm cache clean --force

# ── Stage 3: runtime ──
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5001

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node backend/ backend/
COPY --from=build --chown=node:node /app/frontend/dist frontend/dist

USER node
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

WORKDIR /app/backend
CMD ["node", "server.js", "--production"]
