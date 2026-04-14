# Infrastructure

This directory contains all infrastructure configuration for BärGPT — provisioning, deployment, backups, and future Terraform/Kubernetes work.

## Structure

```
infra/
  ansible/      Ansible playbooks and roles for server provisioning
  backups/      Backup and restore scripts
  supabase/     Supabase stack config (docker-compose.yml, .env.example)
```

## Overview

The setup uses:

- **Ansible** for automated provisioning
- **1Password CLI** for secrets management
- **Docker Compose** for running Supabase services
- **STACKIT** as the cloud provider

## Prerequisites

1. **1Password CLI** (`op`) installed and authenticated

   ```bash
   brew install 1password-cli
   op signin
   ```

2. **Ansible** installed

   ```bash
   brew install ansible
   ```

3. **Access to 1Password vault** with the required secrets

## Configuration

### 1. Environment Variables (1Password)

Each environment has its own secrets file. Copy the example and fill in your 1Password references:

```bash
cp ansible/.op.env.supabase-staging.example ansible/.op.env.supabase-staging
cp ansible/.op.env.supabase-production.example ansible/.op.env.supabase-production
```

The file contains references to secrets stored in 1Password:

```bash
# Example structure (see .op.env.supabase-staging.example)
ANSIBLE_HOST=op://vault/staging-server/hostname
ANSIBLE_USER=op://vault/staging-server/username
ANSIBLE_PORT=op://vault/staging-server/port
STACKIT_PROJECT_ID=op://vault/staging-stackit/project-id
STACKIT_SERVICE_ACCOUNT_JSON=op://vault/staging-stackit/service-account-json
ENV_FILE_REF=vault/staging-supabase/env-file   # no op:// prefix — resolved by op read internally
DOMAIN=staging.example.berlin
LETSENCRYPT_EMAIL=example@example.berlin
ANSIBLE_SSH_KEY=op://vault/staging-server/ssh-private-key-path
MIGRATIONS_SSH_PUBLIC_KEY=op://vault/staging-migrations/public-key
```

> **Note:** `ENV_FILE_REF` must **not** have the `op://` prefix. It is passed as a plain string and used internally by `op read` during the playbook run.

The `ENV_FILE_REF` reference should point to a complete Supabase `.env` document in 1Password containing all required variables:

- Database credentials (POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB)
- JWT configuration (JWT_SECRET, JWT_EXPIRY, ANON_KEY, SERVICE_ROLE_KEY)
- API URLs (SUPABASE_PUBLIC_URL, API_EXTERNAL_URL, SITE_URL)
- SMTP settings (if email is enabled)
- Storage configuration (S3/AWS settings)
- Docker socket location (DOCKER_SOCKET_LOCATION)
- And many more Supabase-specific variables

### 2. Ansible Variables

Key variables are defined in `ansible/group_vars/all.yml`:

- `domain`: Target domain for the deployment
- `letsencrypt_email`: Email for SSL certificate notifications
- `supabase_dir`: Installation directory on the server
- STACKIT credentials (resolved from 1Password at runtime)

### 3. Inventory

Per-environment inventory files live in `ansible/inventory/`:

- `supabase-staging.yml` — supabase staging server
- `supabase-production.yml` — supabase production server

## Running the Deployment

### Full Deployment

```bash
cd ansible

# Staging
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase.yml

# Production
op run --env-file .op.env.supabase-production -- ansible-playbook -i inventory/supabase-production.yml supabase.yml
```

This will provision the server with:

1. Common utilities
2. Docker
3. Supabase stack (docker-compose + .env from 1Password)
4. SSL certificates (certbot) with pre/post renewal hooks for nginx
5. Nginx reverse proxy
6. `migrations` system user with SSH access and Docker wrapper scripts

### Dry Run

To see what would change without making actual changes:

```bash
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase.yml --check --diff
```

### Verbose Output

For debugging, add verbosity flags:

```bash
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase.yml -vv
```

## Supabase Stack

The project uses a customized `docker-compose.yml` located at `supabase/docker-compose.yml`, which overrides the default Supabase configuration. It is deployed to `/opt/supabase-baergpt/` on the server.

During a playbook run, the `.env` is fetched from 1Password, written temporarily to `supabase/.env`, uploaded to the server, then deleted locally. The file is gitignored and never committed.

## Backups & Restore

### Configuration

Each environment needs a config file in `backups/configs/`:

```bash
cp backups/configs/staging.env.example backups/configs/staging.env
```

See the example file for all required variables (rclone remotes, SSH credentials, GPG recipient, retention policy).

### Running Backups

```bash
# All environments (prod + staging)
./backups/backup_all.sh

# Single environment
./backups/backup_env.sh backups/configs/staging.env
```

### Restoring

```bash
# Restore a specific snapshot
./backups/restore_env.sh backups/configs/staging.env 2026-01-26_1500

# Restore latest snapshot
./backups/restore_env.sh backups/configs/staging.env latest
```

The restore script will prompt for confirmation before overwriting data.
