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

The `.op.env` file contains references to secrets stored in 1Password:

```bash
# Example structure (see .op.env.example)
STACKIT_PROJECT_ID=op://vault/item/field
STACKIT_SERVICE_ACCOUNT_JSON=op://vault/item/field
ENV_FILE_REF=op://vault/item/field
DOMAIN=example.berlin
LETSENCRYPT_EMAIL=example@example.berlin
```

The `ENV_FILE_REF` reference should point to a complete Supabase `.env` file containing all required variables:

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

Server configuration is in `ansible/inventory/hosts.yml` - defines the target host(s). You will need to set this.

## Running the Deployment

### Full Deployment

To provision and deploy Supabase with all secrets injected from 1Password:

```bash
cd ansible
op run --env-file=.op.env -- ansible-playbook -i inventory/hosts.yml site.yml
```

This will:

1. Load 1Password secret references from `.op.env`
2. Resolve them to actual secret values
3. Run the ansible playbook with injected environment variables
4. Provision the server with:
   - Common utilities
   - Docker
   - Supabase stack
   - SSL certificates (certbot)
   - Nginx reverse proxy

### Dry Run

To see what would change without making actual changes:

```bash
op run --env-file=.op.env -- ansible-playbook -i inventory/hosts.yml site.yml --check
```

### Verbose Output

For debugging, add verbosity flags:

```bash
op run --env-file=.op.env -- ansible-playbook -i inventory/hosts.yml site.yml -vv
```

## Custom Docker Compose

The project uses a customized `docker-compose.yml` located at `../docker-compose.yml` which overrides the default Supabase configuration. This is deployed to `/opt/supabase-baergpt/` on the server.
