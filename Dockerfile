# Multi-stage build for production
FROM node:18-alpine AS base

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix

# Copy built application
COPY --from=deps --chown=remix:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=remix:nodejs /app/build ./build
COPY --from=build --chown=remix:nodejs /app/public ./public
COPY --chown=remix:nodejs package*.json ./

USER remix

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]