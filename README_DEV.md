![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

# <img src="./apps/frontend/public/logos/baergpt-logo.svg" width="170px" >

# BärGPT Dev Documentation

This is the monorepo for the BärGPT project.
You'll find here the [frontend](./apps/frontend), [backend](./apps/backend), [admin-panel](./apps/admin-panel) and [maintenance-mode](./apps/maintenance-mode/) code.

## Table of Contents

- [🧰 Tech Stack](#️-tech-stack)
- [📋 Prerequisites](#-prerequisites)
- [💿 Installation](#-installation)
- [✅ Setup](#-setup)
- [💻 Development](#-development)
- [🧪 Tests](#-tests)
- [🔍 Linting & Formatting](#-linting--formatting)
- [🏗️ Building for Production](#️-building-for-production)
- [🗄️ Database Management](#️-database-management)
- [🐳 Docker Deployment](#-docker-deployment)
- [🏠 Self-Hosting Supabase](#-self-hosting-supabase)
- [🚨 Troubleshooting](#-troubleshooting)
- [📁 Project Structure](#-project-structure)
- [Contributing](#contributing)
- [Credits](#credits)

## 🧰 Tech Stack

### 🎨 Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication**: Supabase Auth
- **AI Integration**: Vercel AI SDK (@ai-sdk/react)
- **Document Generation**: @mohtasham/md-to-docx, @react-pdf/renderer
- **File Uploads** and **Drag & Drop**: react-dropzone, react-dnd
- **Markdown**: react-markdown with remark-gfm
- **Monitoring**: Sentry
- **Testing**: Playwright (E2E), Vitest (Unit), @axe-core/playwright (Accessibility)

### ⚙️ Backend

- **Framework**: Hono (lightweight Node.js web framework)
- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL via Supabase
- **LLM Provider**: Mistral AI (mistral-small-latest as default)
- **AI SDK**: Vercel AI SDK with multiple providers (@ai-sdk/azure, @ai-sdk/mistral, @ai-sdk/openai)
- **Embeddings**: Jina AI (jina-embeddings-v4)
- **Document Processing**:
  - LlamaParse (PDF parsing)
  - Gotenberg (PDF conversion)
  - mammoth (DOCX parsing)
  - word-extractor (DOC parsing)
  - xlsx (Excel parsing)
  - @opendocsg/pdf2md (PDF to Markdown)
- **Observability**:
  - Langfuse (LLM tracing and monitoring)
  - Sentry (error tracking)
  - OpenTelemetry (instrumentation)
- **Testing**: Vitest, Supertest

### 👥 Admin Panel

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Data Tables**: TanStack Table (@tanstack/react-table)
- **Styling**: Tailwind CSS with tailwindcss-animate
- **State Management**: Zustand
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Testing**: Playwright (E2E), @axe-core/playwright (Accessibility)

### 🚧 Maintenance Mode

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: Playwright (E2E)

### 📦 Shared Libraries

- **Database Schema** (`libs/db-schema`): Shared TypeScript types generated from Supabase
- **ESLint Config** (`libs/eslint`): Shared linting rules
- **Prettier Config** (`libs/prettier`): Shared formatting rules
- **TypeScript Config** (`libs/typescript-config`): Shared TypeScript configurations

### 🏗️ Infrastructure

- **Monorepo Tool**: Turborepo
- **Package Manager**: npm 11.4.2
- **Node Version**: 22.14.0
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deployment**: Vercel (frontend apps), self-hosted options available (backend)
- **Containerization**: Docker (backend)

## 📋 Prerequisites

### Required

- **Node.js**: Version 22.14.0 (specified in [`.nvmrc`](./.nvmrc))
  - Install via: `nvm install && nvm use`
- **Supabase CLI**: Version specified in [`.tool-versions`](./.tool-versions)
  - Install: https://supabase.com/docs/guides/cli
- **Docker** (optional): For running backend in container or local Supabase

### 🔑 API Keys & Services

You'll need accounts and API keys for:

#### Required for Backend

- **Mistral AI**: API key from https://console.mistral.ai/
- **Jina AI**: API key from https://jina.ai/ (for embeddings)
- **LlamaParse**: Token from https://cloud.llamaindex.ai/ (for document parsing)
- **Gotenberg**: URL and credentials for Gotenberg service (PDF conversion)
- **Sentry**: DSN from https://sentry.io/ (for error monitoring)

#### Optional for Backend

- **Ollama**: Self-hosted endpoint for running local models
- **Langfuse**: Keys from https://langfuse.com/ (for LLM observability)

#### Optional for Frontend/Admin Panel

- **Matomo**: Analytics URL and site ID (for usage tracking)

## 💿 Installation

```bash
# Clone repository
git clone https://github.com/technologiestiftung/baergpt.git
cd baergpt

# Install Node.js version
nvm install && nvm use

# Install dependencies
npm ci

# Install Turborepo globally (optional)
npm install turbo --global

# Install Playwright browsers (for E2E tests)
npx playwright install --with-deps
```

## ✅ Setup

### 1. ⚙️ Backend Setup

#### Start Local Supabase

```bash
cd apps/backend
supabase start
```

This starts local Supabase services:

- **API URL**: http://localhost:54321
- **Studio (Database UI)**: http://localhost:54323
- **Inbucket (Email Testing)**: http://localhost:54324

⚠️ **Save the output** - you'll need the `anon key`, `service_role key`, and `JWT secret`.

#### 📡 Enable Database Publications

1. Open Supabase Studio: http://localhost:54323/project/default/database/publications
2. Enable the following tables on the **Source**: `document_folders`, `documents`

This enables real-time subscriptions for these tables.

#### 🔧 Configure Backend Environment

```bash
cd apps/backend
cp .env.sample .env
```

Edit `.env` and fill in the required values. See `.env.sample` for all available configuration options.

#### 🗄️ Initialize Database

```bash
cd apps/backend
npm run db:reset
```

This resets the database, generates TypeScript types into `libs/db-schema/index.ts`, and seeds with initial data.

### 2. 🎨 Frontend Setup

```bash
cd apps/frontend
cp .env.sample .env
```

Edit `.env` and fill in the required values. See `.env.sample` for all available configuration options.

### 3. 👥 Admin Panel Setup

```bash
cd apps/admin-panel
cp .env.sample .env
```

Edit `.env` and fill in the required values. See `.env.sample` for all available configuration options.

### 4. 🚧 Maintenance Mode Setup

No environment configuration needed. This is a static page displayed during maintenance.

## 💻 Development

**Using Turborepo (recommended):**

```bash
# Run all dev servers
turbo dev

# Run specific apps
turbo dev --filter=frontend --filter=backend
turbo dev --filter=baergpt-frontend
```

**Individual apps:**

```bash
# Backend (http://localhost:3100)
cd apps/backend && npm run dev

# Frontend (http://localhost:5173)
cd apps/frontend && npm run dev

# Admin Panel (http://localhost:5176)
cd apps/admin-panel && npm run dev

# Maintenance Mode (http://localhost:5173)
cd apps/maintenance-mode && npm run dev
```

## 🧪 Tests

**Run all tests from root:**

```bash
turbo test        # All unit tests
turbo test:e2e    # All E2E tests
```

**Run tests per application:**

```bash
# Backend (Unit/Integration)
cd apps/backend
npm run test
npm run test:watch  # Watch mode

# Frontend (E2E requires Supabase + backend running)
cd apps/frontend
npm run test        # Unit tests
npm run test:e2e    # E2E tests
npm run test:a11y   # Accessibility tests

# Admin Panel
cd apps/admin-panel
npm run test:e2e

# Maintenance Mode
cd apps/maintenance-mode
npm run test:e2e
```

## 🔍 Linting & Formatting

```bash
# From root
turbo lint:check      # Check linting
turbo lint:write      # Fix linting issues
turbo prettier:check  # Check formatting
turbo prettier:write  # Fix formatting issues
turbo check-types     # Type check all packages
```

## 🏗️ Building for Production

```bash
# Build all apps
turbo build

# Build specific app
cd apps/[app-name]
npm run build

# Backend with Sentry source maps
cd apps/backend
npm run build:prod
```

**Build output locations:**

- Frontend: `apps/frontend/dist`
- Backend: `apps/backend/dist`
- Admin Panel: `apps/admin-panel/dist`
- Maintenance Mode: `apps/maintenance-mode/dist`

## 🗄️ Database Management

All database commands should be run from `apps/backend`:

```bash
cd apps/backend

# Reset database to initial migration state
npm run db:reset

# Regenerate TypeScript types after schema changes
npm run db:typegen

# Seed database only
npm run db:localseed

# Lint database for common issues
npm run lint:db

# Create new migration
supabase migration new your_migration_name

# Apply all migrations
supabase db reset
```

## 🐳 Docker Deployment

**Backend Docker commands** (from `apps/backend`):

```bash
cd apps/backend

# Build image
docker build -t baergpt-backend .

# Run container (first time)
docker run -d --network host --name baergpt-backend --env-file .env baergpt-backend

# Manage container
docker start baergpt-backend    # Start existing container
docker stop baergpt-backend     # Stop container
docker logs -f baergpt-backend  # View logs
```

## 🏠 Self-Hosting Supabase

For production deployments with self-hosted Supabase, see:

- **Guide**: `apps/backend/supabase/selfhosting/README.md`
- **Uses**: Ansible, 1Password CLI, Docker Compose
- **Cloud Provider**: STACKIT (configurable)

## 🚨 Troubleshooting

**Port Conflicts**
Change ports in respective `.env` files:

- Backend: `PORT` in `apps/backend/.env`
- Frontend/Admin Panel: `VITE_PORT` in `.env`

**Database Issues**

```bash
cd apps/backend
supabase db reset
npm run db:typegen
```

**Module Not Found**

```bash
npm ci  # from root
```

**Supabase Connection Failed**

```bash
cd apps/backend
supabase status  # Check if running
```

**Email Confirmation in Development**
View test emails at: http://localhost:54324 (Inbucket)

**TypeScript Errors After Schema Changes**

```bash
cd apps/backend
npm run db:typegen
```

**Build Errors**

```bash
# Clear caches and rebuild from root
rm -rf node_modules apps/*/node_modules libs/*/node_modules
npm ci
turbo build
```

## 📁 Project Structure

```
baergpt/
├── apps/
│   ├── frontend/          # Main user-facing React app
│   ├── backend/           # Hono API + Supabase migrations
│   ├── admin-panel/       # Admin management interface
│   └── maintenance-mode/  # Maintenance page
├── libs/
│   ├── db-schema/         # Generated Supabase types
│   ├── eslint/            # Shared ESLint config
│   ├── prettier/          # Shared Prettier config
│   └── typescript-config/ # Shared TS configs
├── docs/
│   └── adr/               # Architecture Decision Records
├── .nvmrc                 # Node version
├── turbo.json            # Turborepo configuration
└── package.json          # Root workspace config
```

## Contributing

Before you create a pull request, write an issue so we can discuss your changes.

## Credits

<table>
  <tr>
    <td>
      Made by <a href="https://citylab-berlin.org/de/start/">
        <br />
        <br />
        <img width="200" src="https://logos.citylab-berlin.org/logo-citylab-color.svg" alt="Link to the CityLAB Berlin website" />
      </a>
    </td>
    <td>
      A project by <a href="https://www.technologiestiftung-berlin.de/">
        <br />
        <br />
        <img width="150" src="https://logos.citylab-berlin.org/logo-technologiestiftung-berlin-de.svg" alt="Link to the Technologiestiftung Berlin website" />
      </a>
    </td>
    <td>
      Supported by <a href="https://www.berlin.de/rbmskzl/">
        <br />
        <br />
        <img width="80" src="https://logos.citylab-berlin.org/logo-berlin-senatskanzelei-de.svg" alt="Link to the Senate Chancellery of Berlin"/>
      </a>
    </td>
  </tr>
</table>
