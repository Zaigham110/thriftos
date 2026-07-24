# Stage 1: Build Angular Frontend
FROM node:20-alpine AS build

WORKDIR /app/thriftos-frontend

COPY thriftos-frontend/package*.json ./
RUN npm install

COPY thriftos-frontend/ ./
RUN npm run build -- --configuration production

# Stage 2: Nginx Server
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built application to Nginx web root (checking both browser subdirectory and direct dist)
COPY --from=build /app/thriftos-frontend/dist/thriftos-frontend/browser /usr/share/nginx/html

# Copy custom Nginx configuration
COPY thriftos-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
