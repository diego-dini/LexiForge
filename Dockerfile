FROM oven/bun:1.3.13-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN bun scripts/build.mjs --prod

FROM oven/bun:1.3.13-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV IDLE_TIMEOUT_SECONDS=120

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/backend ./src/backend
COPY prompt-models ./prompt-models
COPY tsconfig.json ./

COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["bun", "src/backend/index.ts"]
