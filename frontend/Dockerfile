# Interface ArchiCloud : build Vite, puis fichiers statiques servis par nginx

# ── Build ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Connexions instables : plus de tentatives de téléchargement
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-maxtimeout=120000

COPY . .
# URL de l'API vue par le navigateur, intégrée au build (prioritaire sur le fichier .env)
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Service ────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
