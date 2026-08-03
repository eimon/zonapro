FROM node:24-alpine AS base
WORKDIR /app
COPY package.json ./

# ── Dev ───────────────────────────────────────────────────────────────────────
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
# Estas variables NEXT_PUBLIC_* deben estar presentes en build: Next.js las
# inyecta en el bundle del cliente y las páginas públicas hacen fetch a la API
# durante el prerender. docker-compose.prod.yml las pasa como build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLIENT_ID
ARG NEXT_PUBLIC_CLIENT_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CLIENT_ID=$NEXT_PUBLIC_CLIENT_ID
ENV NEXT_PUBLIC_CLIENT_SECRET=$NEXT_PUBLIC_CLIENT_SECRET
RUN npm install
COPY . .
RUN npm run build

# ── Runner (producción) ───────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
