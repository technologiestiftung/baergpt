# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json turbo.json ./
COPY libs/db-schema/package.json ./libs/db-schema/
COPY libs/typescript-config/package.json ./libs/typescript-config/
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (including workspaces)
RUN npm ci --ignore-scripts

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy source files needed for the build
COPY libs/db-schema/ ./libs/db-schema/
COPY libs/typescript-config/ ./libs/typescript-config/
COPY apps/backend/src/ ./apps/backend/src/
COPY apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY package.json ./package.json
COPY turbo.json ./turbo.json

# Build the backend
WORKDIR /app/apps/backend
RUN npx tsc

# ─── Stage 3: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS runner

# word-extractor uses native bindings — keep build tools for it
RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Only copy what's needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/libs/db-schema ./libs/db-schema
COPY apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend

EXPOSE 3000

# Use node directly — no tsc at runtime, no .env loading in prod
CMD ["node", "dist/src/index.js"]