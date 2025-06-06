# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies and clean up
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    rm -rf /root/.npm

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"] 