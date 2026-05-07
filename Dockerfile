FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY public ./public
COPY src ./src
COPY prompt-models ./prompt-models
COPY tsconfig.json ./

ENV NODE_ENV=production
ENV IDLE_TIMEOUT_SECONDS=120

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
