FROM node:18

WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package.json package-lock.json ./

# Install ALL dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose the backend port
EXPOSE 5001

# Start the application
CMD ["node", "server.js"]
