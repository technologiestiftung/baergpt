# Multi-stage image for the BärGPT Hono backend (Turborepo monorepo).
#
# Build with the repo ROOT as context so the monorepo is visible:
#   docker buildx build --platform linux/amd64 -f apps/backend/Dockerfile -t <tag> .
# CF cells run linux/amd64. The platform is set on the build command (not in
# FROM) to stay hadolint-clean (DL3029).

# ---- base -------------------------------------------------------------------
# node:24.18.0-slim (Debian/glibc) — .nvmrc pins v24.18.0. glibc over Alpine/musl
# avoids native-module surprises in the backend's dependency set.
FROM node:24.18.0-slim AS base

# ---- pruner: reduce the monorepo to just baergpt-backend + its deps ----------
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.9.14
COPY . .
# Produces /app/out/json (manifests + pruned lockfile) and /app/out/full (source).
RUN turbo prune baergpt-backend --docker

# ---- builder: install deps and compile TypeScript ---------------------------
FROM base AS builder
WORKDIR /app
# Install from the pruned manifests first for good layer caching.
COPY --from=pruner /app/out/json/ .
RUN npm ci
# Bring in the pruned source and build.
COPY --from=pruner /app/out/full/ .
RUN npx turbo build --filter=baergpt-backend
# Drop dev dependencies so the runtime node_modules is lean.
RUN npm prune --omit=dev

# ---- runner: minimal image that runs the compiled server --------------------
# NODE_ENV is deliberately NOT set: this codebase uses it to select the deploy
# environment (production | staging | test), so it is injected at runtime on CF
# and the same image runs in every environment.
FROM base AS runner
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
	&& useradd --system --uid 1001 --gid nodejs hono
COPY --from=builder --chown=hono:nodejs /app ./
USER hono
WORKDIR /app/apps/backend
# Documentation only, does NOT publish the port. Locally use `-p 3000:3000`.
# CF ignores this and injects its own PORT. App defaults to 3000 (see config.ts).
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
