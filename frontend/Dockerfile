# ==============================================================================
# EarlyBird Frontend — Multi-Stage Build & Production Nginx Setup
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React App
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Nginx Production Server
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/nginx_health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
