# ── Stage 1 : build Angular ───────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build -- --configuration production

# ── Stage 2 : nginx ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist/redistribution/browser /usr/share/nginx/html
COPY nginx/site.conf /etc/nginx/site.conf
COPY nginx/http.conf nginx/https.conf /etc/nginx/modes/
COPY --chmod=755 nginx/choisir-mode.sh /docker-entrypoint.d/40-choisir-mode.sh

EXPOSE 80 443
