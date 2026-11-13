# ThriftOS Shop POS: one image with the API and the screens.
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine AS server
RUN apk add --no-cache openssl
WORKDIR /srv
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production WEB_DIR=/app/web PORT=3100
WORKDIR /app
COPY --from=server /srv/node_modules ./node_modules
COPY --from=server /srv/dist ./dist
COPY --from=server /srv/prisma ./prisma
COPY --from=server /srv/package.json ./
COPY --from=web /web/dist/pos-web/browser ./web
USER node
EXPOSE 3100
# The shop's own database is brought up to date each time the app starts.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
