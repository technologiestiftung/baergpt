# Multi-stage image for the BärGPT Hono backend (Turborepo monorepo).
# Build with the repo ROOT as context so the monorepo is visible:
#   docker buildx build --platform linux/amd64 -f apps/backend/Dockerfile -t <tag> .

# ---- base -------------------------------------------------------------------
FROM node:24.18.0-slim AS base

# ---- reduce the monorepo to just baergpt-backend + its deps ----------
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.9.14
COPY . .
# produces /app/out/json (manifests + pruned lockfile) and /app/out/full (source).
RUN turbo prune baergpt-backend --docker

# ---- install deps and compile TypeScript ---------------------------
FROM base AS builder
WORKDIR /app
# manifests first, then source, so the npm ci layer stays cached across code changes
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx turbo build --filter=baergpt-backend
# drop dev dependencies so the runtime node_modules is lean.
RUN npm prune --omit=dev

# ---- minimal non-root runtime; env is injected at runtime so one image runs everywhere ----
FROM base AS runner
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
	&& useradd --system --uid 1001 --gid nodejs hono
COPY --from=builder --chown=hono:nodejs /app ./
USER hono
WORKDIR /app/apps/backend
# for documentation only, does not publish the port. Locally use `-p 3000:3000`.
# CF ignores this and injects its own PORT.
EXPOSE 3000
#CMD ["node", "--max-old-space-size=1536", "dist/src/index.js"]
CMD ["node", "dist/src/index.js"]
