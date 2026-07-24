FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl bash

WORKDIR /app

# Copy package files and Prisma schema from root
COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

# Copy server package files
COPY server/package*.json ./server/

# Install root dependencies and server dependencies
RUN npm install
RUN cd server && npm install

# Copy server source code
COPY server ./server

# Build the NestJS backend
WORKDIR /app/server
RUN npx prisma generate --schema /app/prisma/schema.prisma
RUN node ../scripts/ensure-prisma-client-link.js || true
RUN npm run build

# Make entrypoint script executable
RUN chmod +x /app/server/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
