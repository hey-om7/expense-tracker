FROM node:18

WORKDIR /app

# Copy workspace manifests first (for Docker layer caching)
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install backend workspace dependencies into the root node_modules
RUN npm ci -w backend

# Copy the backend source code
COPY backend/ backend/

WORKDIR /app/backend

# Expose the backend port
EXPOSE 5001

ENV NODE_ENV=production

# Drop root privileges
USER node

# Start the application
CMD ["node", "server.js"]
