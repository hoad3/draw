# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install serve package globally
RUN npm install -g serve

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 80

# Start serve
CMD ["serve", "-s", "dist", "-l", "80"]