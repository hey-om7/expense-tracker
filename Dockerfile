# ── Stage 1: Build the React app ──
FROM node:18 AS build

WORKDIR /app

# Copy workspace manifests first (for Docker layer caching)
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/

# Install frontend workspace dependencies (including devDependencies needed for build)
RUN npm ci -w frontend

# Copy the frontend source code
COPY frontend/ frontend/

# Accept the API URL as a build argument
# In production with nginx proxy, this should be empty string ""
# so the browser hits the same origin and nginx proxies /api/ to backend
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build the Vite app
RUN npm run build -w frontend

# ── Stage 2: Serve with Nginx ──
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app from the build stage
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
