# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and TypeScript configs
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies and NestJS CLI
RUN npm ci && \
    npm install -g @nestjs/cli && \
    npm install ts-node --save

# Copy source code, scripts, and templates
COPY . .
COPY scripts ./scripts
COPY src/processor/templates ./src/processor/templates

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files and TypeScript configs
COPY package*.json ./
COPY tsconfig*.json ./

# Install only production dependencies, NestJS CLI, and clean npm cache
RUN npm ci --only=production && \
    npm install -g @nestjs/cli && \
    npm cache clean --force && \
    rm -rf /root/.npm && \
    # Remove any potential source maps
    find /usr/src/app -name "*.map" -type f -delete

# Copy built application, scripts, and templates from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/scripts ./scripts
COPY --from=builder /usr/src/app/src/processor/templates ./src/processor/templates

EXPOSE 9001

CMD ["node", "dist/main"]
