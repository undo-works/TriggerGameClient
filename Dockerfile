# Multi-stage build for production
FROM node:18-alpine AS base

# Build引数を定義
ARG VITE_WS_SERVER_URL
ARG VITE_WEB_PUBSUB_AUTH_API_URL
ARG NODE_ENV=production

# 環境変数として設定
ENV VITE_WS_SERVER_URL=$VITE_WS_SERVER_URL
ENV VITE_WEB_PUBSUB_AUTH_API_URL=$VITE_WEB_PUBSUB_AUTH_API_URL
ENV NODE_ENV=$NODE_ENV

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