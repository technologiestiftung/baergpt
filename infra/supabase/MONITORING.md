# Supabase VM monitoring

An OpenTelemetry Collector runs on each Supabase VM (Compose overlay) and ships to
STACKIT Observability: **metrics** via Prometheus remote-write, **logs** via OTLP/HTTP.

- Collector config: [`otel-config.yml`](./otel-config.yml)
- Overlay: [`docker-compose.monitoring.yml`](./docker-compose.monitoring.yml)
- Provisioned by the Ansible `supabase` role; STACKIT creds come from the Supabase `.env`
  (1Password), per-env metadata from `monitoring.env` (rendered from the inventory).
- Grafana dashboard: [`grafana/supabase-vm-dashboard.json`](./grafana/supabase-vm-dashboard.json)
  (import it; pick the Thanos + Loki datasources, switch `$source` for staging/prod).

All telemetry is tagged `source=supabase-<env>` and `host=<hostname>`.

## Metrics

- **Host** (`hostmetrics`): cpu, memory, load, disk, filesystem, network, paging.
- **Per-container** (`docker_stats`): cpu/memory/network/io per service (`container_name` label).

## Logs

Only the **Kong gateway** access logs + error/crit/alert/emerg lines, shipped under the Loki
stream label `service_name=supabase-<env>` (filter by `container.id` in structured metadata).
Everything else on container stdout is dropped (see `filter/gateway-only`).
