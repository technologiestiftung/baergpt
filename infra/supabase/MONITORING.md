# Supabase VM monitoring

An OpenTelemetry Collector runs on each Supabase VM (Compose overlay) and ships to
STACKIT Observability: **metrics** via Prometheus remote-write, **logs** via OTLP/HTTP.
Supabase's own Vector additionally pushes **auth (GoTrue) logs** to STACKIT Loki.

- Collector config: [`otel-config.yml`](./otel-config.yml)
- Vector sink config: [`vector-stackit.yml`](./vector-stackit.yml)
- Overlay: [`docker-compose.monitoring.yml`](./docker-compose.monitoring.yml)
- Provisioned by the Ansible `supabase` role; STACKIT creds come from the Supabase `.env`
  (1Password), per-env metadata from `monitoring.env` (rendered from the inventory).
- Grafana dashboard: [`grafana/supabase-vm-dashboard.json`](./grafana/supabase-vm-dashboard.json)
  (import it; pick the Thanos + Loki datasources, switch `$source` for staging/prod).
- Alert rules: [`infra/terraform/observability`](../terraform/observability/)

All telemetry is tagged `source=supabase-<env>` and `host=<hostname>`.

> **These label values are load-bearing.** The alert rules select on `source` (metrics)
> and `service_name` (logs). Changing `BAERGPT_ENV` or the processors that set them
> breaks every alert silently — rules with no matching series apply cleanly and simply
> never fire. After any collector change, re-run the verification queries in the
> alerting module's README.

## Metrics

- **Host** (`hostmetrics`): cpu, memory, load, disk, filesystem, network, paging.
- **Per-container** (`docker_stats`): cpu/memory/network/io per service (`container_name` label).

## Logs

Only the **Kong gateway** access logs + error/crit/alert/emerg lines, shipped under the Loki
stream label `service_name=supabase-<env>` (filter by `container.id` in structured metadata).
Everything else on container stdout is dropped (see `filter/gateway-only`).

The **Tor/Mullvad block** (host nginx, not a container) ships under its own stream
`service_name=supabase-<env>-anon-egress`, kept apart so its 403s don't skew the Kong 5xx ratio:

- `/var/log/anon-egress-blocklist.log` — one JSON status line per hourly refresh.
- `/var/log/nginx/anon-egress.log` — one access-log line per blocked request. **These lines
  contain client IP addresses** (Kong sees nginx's address, not the client's). Retention is
  whatever the STACKIT Observability instance is set to; it is configured in the STACKIT
  portal, not in this repo.

### Auth (GoTrue)

Shipped by Supabase's Vector, not the collector: `vector-stackit.yml` adds a Loki sink on
upstream's `router.auth` route, loaded as a second `--config` so upstream's `vector.yml` stays
untouched. Stream labels: `service_name=supabase-<env>-auth`, `source`, `host`, `level`.
One JSON object per line, so query fields with `| json`, e.g.
`{service_name="supabase-production-auth"} | json | status >= 400`.

- Only GoTrue's JSON lines are shipped. The SQL trace GoTrue prints at `GOTRUE_LOG_LEVEL=debug`
  contains refresh tokens and OTP hashes and is dropped, as is anything with `component`
  `pop`/`sql`.
- Emails and phone numbers are removed (`actor_username`, `actor_name`, `traits.user_*`,
  `mail_to`, then any remaining email address is redacted). `actor_id` identifies the user.
- **These lines contain client IP addresses** (`remote_addr`, audit `ip_address`).
- Needs `STACKIT_OBSERVABILITY_LOGS_LOKI_URL` in the Supabase `.env`: the Loki **base** URL,
  without `/loki/api/v1/push`.
- `db` waits for `vector` to be healthy, so a broken Vector config keeps Postgres down. The
  Ansible role validates the config before starting the stack.
- After changing `vector-stackit.yml`, check in Grafana that both of these return nothing:
  `{service_name="supabase-<env>-auth"} |= "@"` (emails) and `|= "POP"` (SQL trace).
