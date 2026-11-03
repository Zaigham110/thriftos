# ThriftOS API image. Two stages: build with every dependency, then run with production
# dependencies only, so the image pulled onto the 1 GB server stays small.
# Build context is the repository root (see .dockerignore).

# ---- build ----
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

COPY prisma ./prisma
COPY scripts ./scripts
COPY server/package*.json ./server/
RUN cd server && npm ci

COPY server ./server
WORKDIR /app/server
# Only the server's client: the default generator would make Prisma run `npm i @prisma/client` in /app.
RUN npx prisma generate --schema /app/prisma/schema.prisma --generator serverClient \
 && node ../scripts/ensure-prisma-client-link.js \
 && npx nest build

# ---- run ----
FROM node:20-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

# Generated Prisma client (engines for this Alpine/OpenSSL), the build, schema + migrations
# for `prisma migrate deploy` on start, and the dev-DB guard the entrypoint uses.
COPY --from=build /app/server/node_modules/.prisma ./server/node_modules/.prisma
COPY --from=build /app/server/dist ./server/dist
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY scripts/db-guard.js scripts/ensure-prisma-client-link.js ./scripts/
COPY server/docker-entrypoint.sh ./server/docker-entrypoint.sh
# Payment screenshots live on a volume mounted at /data/uploads; it starts owned by the app user.
RUN node scripts/ensure-prisma-client-link.js --cwd server \
 && chmod +x server/docker-entrypoint.sh \
 && mkdir -p /data/uploads && chown node:node /data/uploads

WORKDIR /app/server
USER node
EXPOSE 3000
ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
