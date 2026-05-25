# ── Stage 1 : build Angular ───────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install --silent

COPY . .
RUN npm run build -- --configuration production

# ── Stage 2 : nginx ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist/redistribution/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
