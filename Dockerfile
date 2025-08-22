FROM node:22-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies (this layer will be cached unless package.json changes)
RUN npm ci

# Copy Prisma schema for client generation
COPY prisma ./prisma

# Generate Prisma client (this layer will be cached unless schema changes)
RUN npx prisma generate

# Copy source code (this layer changes most frequently)
COPY . .

# Expose port
EXPOSE 5002

# Development command
CMD ["npm", "run", "dev"]