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
5. Nginx reverse proxy, with an hourly-refreshed block of Tor exits and Mullvad VPN ranges
6. `migrations` system user with SSH access and Docker wrapper scripts

### Anonymising-egress block

Nginx on the Supabase VMs returns `403` for any client whose address is a Tor exit
or a Mullvad VPN range. The list lives in `/etc/nginx/anon-egress-blocklist.conf`
and is rebuilt hourly by `anon-egress-blocklist.timer` from three public sources:
the Tor bulk exit list, Mullvad's relay list (entry addresses, widened to their
/24 or /64 since exit addresses differ) and the address blocks RIPE registers to
Mullvad VPN AB. A refresh keeps the previous file unless every source was fetched,
the counts look sane and `nginx -t` passes. Blocked requests are logged to
`/var/log/nginx/anon-egress.log`, and each refresh appends its status line to
`/var/log/anon-egress-blocklist.log`. The OTel collector ships both to STACKIT, where
`infra/terraform/observability/alerts_anon_egress.tf` alerts when the list hasn't refreshed
for 3h or the block rejects an unusually large share of requests.

```bash
# on the VM
systemctl list-timers anon-egress-blocklist.timer
sudo journalctl -u anon-egress-blocklist.service -n 5 # one JSON status line per run
sudo systemctl start anon-egress-blocklist.service    # refresh now
```

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

### Kernel hardening (tag: `kernel-hardening`)

Hardening tasks in the `common` role (e.g. blacklisting unused kernel modules like `algif_aead`) are tagged `kernel-hardening`. Use this to apply only those tasks without running the rest of the playbook — useful when a host's full state is not yet reconciled with Ansible.

```bash
# Staging — dry run, then apply
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase.yml --tags kernel-hardening --check --diff
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase.yml --tags kernel-hardening

# Production — dry run, then apply
op run --env-file .op.env.supabase-production -- ansible-playbook -i inventory/supabase-production.yml supabase.yml --tags kernel-hardening --check --diff
op run --env-file .op.env.supabase-production -- ansible-playbook -i inventory/supabase-production.yml supabase.yml --tags kernel-hardening
```

### Kernel patches and reboots

The standalone `kernel-patch.yml` playbook upgrades the cloud-VM kernel meta-packages (`linux-image-virtual`, `linux-headers-virtual`) to the latest available version and reboots the host if `/var/run/reboot-required` exists after the upgrade. Hosts are patched one at a time (`serial: 1`). If you ever migrate to bare-metal hosts, the package list will need `linux-image-generic` / `linux-headers-generic` added.

Caveats:

- The reboot fires whenever `/var/run/reboot-required` is present — including from earlier package activity that predates this run.
- Expect a few minutes of service downtime per host during the reboot. Take a backup before running on production.

```bash
# Staging — dry run, then apply
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml kernel-patch.yml --check --diff
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml kernel-patch.yml

# Production — dry run, then apply
op run --env-file .op.env.supabase-production -- ansible-playbook -i inventory/supabase-production.yml kernel-patch.yml --check --diff
op run --env-file .op.env.supabase-production -- ansible-playbook -i inventory/supabase-production.yml kernel-patch.yml
```

## Supabase Stack

The project uses a customized `docker-compose.yml` located at `supabase/docker-compose.yml`, which overrides the default Supabase configuration. It is deployed to `/opt/supabase-baergpt/` on the server.

During a playbook run, the `.env` is fetched from 1Password, written temporarily to `supabase/.env`, uploaded to the server, then deleted locally. The file is gitignored and never committed.

### Upstream files

`supabase/volumes/` holds files from upstream's `docker/volumes/` at tag `self-hosted/v0.8.2`, unchanged:
`api/envoy/*` (the API gateway), `logs/vector.yml`, `pooler/pooler.exs`, `db/jwt.sql`. The playbook uploads them on every
run. When bumping images to a newer upstream release, copy that release's versions too.

Email templates come from `apps/backend/supabase/templates/`; the `email-templates` container serves them to GoTrue.
They reach the hosts with every deploy. After a template change, deploy them on their own (this restarts auth):

```bash
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase.yml --tags email-templates
```

### Upgrading the Supabase stack

`supabase_release` in `ansible/group_vars/all.yml` names the stack generation this repo deploys (currently
Postgres 17, self-hosted v0.8.2 services, Envoy as the API gateway). The host records the generation it runs in
`/opt/supabase-baergpt/.baergpt-release`. `supabase.yml` refuses to deploy onto a host on an older generation;
`supabase-upgrade.yml` moves it:

```bash
cd ansible
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase-upgrade.yml \
  -e upgrade_backup=<snapshot>
```

The playbook:

1. Checks that the upstream files it replaces are unedited and that there is room for two more copies of the database.
2. Pulls the new images while the old stack still runs, and checks the helper scripts upstream's upgrade script
   downloads later against recorded checksums.
3. Asks you to confirm the backup you took right before on the backup machine (`<snapshot>` is its timestamp),
   stops nginx (public access stays closed until step 7), stops the stack and saves a rollback point to
   `/opt/supabase-baergpt/rollback/<release>/`: a copy of `volumes/db/data`, the `db-config` volume, and the compose,
   upstream and `.env` files.
4. Upgrades Postgres 15 → 17 with upstream's `utils/upgrade-pg17.sh`, fetched at a pinned commit and checksum,
   after handing the TLS cert to the Postgres 17 `postgres` user (the uid differs per image and is looked up).
   The script converts the data with `17.6.1.136`; the role then starts the newer 17.x image from the compose file.
5. Deploys the Supabase role (this replaces Kong with Envoy, removes Realtime, Edge Functions and imgproxy, and
   removes the JWT secret that older init scripts stored as a database setting). Then checks that all containers are
   healthy, that `postgres` is not left a superuser by the upgrade script, and that auth, REST and storage answer
   through the gateway.
6. With the stack back up, checks the order of every index on text columns (`amcheck`, read-only): the Postgres 17
   image's newer glibc may sort some strings differently. If it lists indexes, rebuild each:
   `REINDEX INDEX CONCURRENTLY <name>;`, then re-run `supabase-upgrade.yml`. Only after this check passes does the
   host record the new release.
7. Runs `supabase.yml` for everything else (nginx, certbot, migrations user); this reopens public access.

The downtime grows with the database: the rollback copy and `pg_upgrade` both copy it, and the site stays closed until
the index check passes. Check `sudo du -sh /opt/supabase-baergpt/volumes/db/data` beforehand. If `upgrade-pg17.sh`
fails, roll back (below) and start again. After any other failure, fix the cause and re-run the upgrade playbook. Afterwards check by hand: log in with an email code, upload a document over 16 MB,
chat with it, take a backup on the backup machine, and on staging run `backups/dr-drill.sh`. Delete the rollback point after a few days: `sudo rm -rf /opt/supabase-baergpt/rollback`.

Rollback, while the rollback point exists:

```bash
op run --env-file .op.env.supabase-staging -- ansible-playbook -i inventory/supabase-staging.yml supabase-rollback.yml
```

It restores the rollback point, starts the previous stack and reopens nginx. Database writes since the upgrade started
are lost; there are none if the upgrade did not get to step 7. Once the rollback succeeds, the point is renamed to
`<release>.rolled-back-<time>`, so a new upgrade run takes a fresh one. Until the host is upgraded again, deploy only
from the git revision before the upgrade.

## Backups & Restore

Each snapshot holds: roles, the `public` schema, all data, the **`auth`/`storage` RLS
policies + triggers** (`auth_storage_objects.sql`), migration history, and the
storage-bucket files — gpg-encrypted and pushed to object storage via rclone.

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

The restore prompts before overwriting, then asserts the `auth`/`storage` policies +
triggers and RLS landed — it exits non-zero if the restore is incomplete. Pass `--yes`
(or `RESTORE_ASSUME_YES=1`) to skip the prompt for automation.

### Disaster Recovery Drill

Full DR drill — wipe staging to bare, restore the latest snapshot, assert. Watch out, this is **DESTRUCTIVE** albeit staging-only; leaves staging on the restored snapshot.

```bash
./backups/dr-drill.sh backups/configs/staging.env
```
