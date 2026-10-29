# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=fight-club-npm,target=/root/.npm,sharing=locked npm ci --prefer-offline

FROM dependencies AS builder
WORKDIR /app
COPY . .
ARG APP_URL=https://fight-club.wbglabs.io
ENV APP_URL=${APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=fight-club-next,target=/app/.next/cache,sharing=locked npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache python3 py3-pillow
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
