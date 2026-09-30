# Supabase VM monitoring

An OpenTelemetry Collector runs on each Supabase VM (Compose overlay) and ships to
STACKIT Observability: **metrics** via Prometheus remote-write, **logs** via OTLP/HTTP.

- Collector config: [`otel-config.yml`](./otel-config.yml)
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
  contain client IP addresses**, the only log stream here that does (Kong sees nginx's address,
  not the client's). Retention is whatever the STACKIT Observability instance is set to; it is
  configured in the STACKIT portal, not in this repo.
