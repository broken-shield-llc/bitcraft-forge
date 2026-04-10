# Production image for ECS Fargate. Build from repository root:
#   docker build -t forge -f Dockerfile .
FROM node:22-bookworm-slim
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile

RUN pnpm build

ENV NODE_ENV=production
WORKDIR /app
CMD ["pnpm", "--filter", "forge", "start"]
