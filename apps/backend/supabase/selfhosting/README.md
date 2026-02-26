# Supabase Self-Hosting

This directory contains the infrastructure setup for self-hosting Supabase on STACKIT using Ansible.

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
cp ansible/.op.env.staging.example ansible/.op.env.staging
cp ansible/.op.env.production.example ansible/.op.env.production
```

The file contains references to secrets stored in 1Password:

```bash
# Example structure (see .op.env.staging.example)
STACKIT_PROJECT_ID=op://vault/item/field
STACKIT_SERVICE_ACCOUNT_JSON=op://vault/item/field
ENV_FILE_REF=vault/item/field   # no op:// prefix — resolved by op read internally
ANSIBLE_SSH_KEY=op://vault/item/field
DOMAIN=example.berlin
LETSENCRYPT_EMAIL=example@example.berlin
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

- `staging.yml` — staging server
- `production.yml` — production server

## Running the Deployment

### Full Deployment

```bash
cd ansible

# Staging
op run --env-file .op.env.staging -- ansible-playbook -i inventory/staging.yml site.yml

# Production
op run --env-file .op.env.production -- ansible-playbook -i inventory/production.yml site.yml
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
op run --env-file .op.env.staging -- ansible-playbook -i inventory/staging.yml site.yml --check --diff
```

### Verbose Output

For debugging, add verbosity flags:

```bash
op run --env-file .op.env.staging -- ansible-playbook -i inventory/staging.yml site.yml -vv
```

## Custom Docker Compose

The project uses a customized `docker-compose.yml` located at `../docker-compose.yml` which overrides the default Supabase configuration. This is deployed to `/opt/supabase-baergpt/` on the server.
