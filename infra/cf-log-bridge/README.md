# CF log bridge

Cloud Foundry can forward an app's logs to a URL you nominate, as syslog over HTTPS.
STACKIT Observability does not accept syslog, so this Vector app sits in between:
it receives the drain, and pushes logs to Loki and container metrics to Prometheus
remote-write.

One instance runs per CF space, named `baergpt-log-bridge-<space>`. `default-route: true`
turns that name into the route, and a route belongs to one space only, so the suffix is
what keeps staging and prod apart. The deploy workflow and
`infra/terraform/cloud-foundry/log-drain.tf` build the name separately and must agree.

The drain itself is a `stackit-drain` service defined in
`infra/terraform/cloud-foundry/log-drain.tf`, and apps opt in by naming it in their own
manifest.

**Never bind this app to `stackit-drain`.** Its own output would be drained back into
itself, and the resulting amplification trips the platform's limit of 1000 log-lines per
second per instance, after which lines are dropped for every app on that cell.

Design notes: `docs/superpowers/specs/2026-07-30-cloud-foundry-observability-design.md`.

## Environment

Set by `.github/workflows/cf-log-bridge-deploy.yml` from a 1Password item, which is the
single source of truth: the workflow unsets every existing variable before re-setting.

| Variable                                         | Notes                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `BAERGPT_ENV`                                    | `staging` or `production`. Becomes the `source` label as `cf-<env>`             |
| `DRAIN_USERNAME`, `DRAIN_PASSWORD`               | Basic auth on the inbound endpoint. Must match the credentials in the drain URL |
| `STACKIT_OBSERVABILITY_USERNAME`, `..._PASSWORD` | From the Observability instance's Credentials tab                               |
| `STACKIT_OBSERVABILITY_LOGS_ENDPOINT`            | Base URL only. Vector appends `/loki/api/v1/push`                               |
| `STACKIT_OBSERVABILITY_METRICS_ENDPOINT`         | Used verbatim, including `/api/v1/receive`                                      |
| `VECTOR_LOG`                                     | `warn` in deployed environments                                                 |

The two endpoints are handled in opposite ways. Copying the portal's logs URL verbatim
gives a doubled path and a 404.

## Output

Loki labels: `source`, `app_name`, `space_name`, `source_type`, `instance_id`, `level`.

`process_instance_id` and the cell `index` stay on the event and are deliberately not
promoted. They are per-container and per-cell, and unbounded label values break Loki.
Same reasoning as `container.id` in `infra/supabase/MONITORING.md`.

`source` is load-bearing. Alert rules select on it, and a rule matching no series applies
cleanly and never fires.

Metrics are named `cf_<name>`: `cf_cpu`, `cf_cpu_entitlement`, `cf_memory`,
`cf_memory_quota`, `cf_disk`, `cf_disk_quota`, `cf_rx_bytes`, `cf_tx_bytes`,
`cf_log_rate`, `cf_log_rate_limit`, `cf_container_age`. All are gauges. `rx_bytes` and
`tx_bytes` are cumulative, so `rate()` works, but a container restart appears as a drop
rather than a counter reset.

STACKIT's ingest adds its own `receive` and `tenant_id` labels. Do not select on them.

## Frame shape

Useful when changing the remap in `vector.yaml`. Everything CF sends is an RFC5424
syslog frame:

```
<14>1 2026-07-30T12:08:43Z baergpt.staging.log-emitter 6c5662d9-... [APP/PROC/WEB/0] - [tags@47450 ...] drain-probe
│   │ │                    │                           │            │                │ │                │
│   │ │                    │                           │            │                │ │                └─ message
│   │ │                    │                           │            │                │ └─ structured data
│   │ │                    │                           │            │                └─ msgid: unused by CF
│   │ │                    │                           │            └─ procid: source type and instance
│   │ │                    │                           └─ app-name: the app GUID
│   │ │                    └─ hostname: org.space.app
│   │ └─ timestamp
│   └─ version
└─ PRI: facility x 8 + severity
```

PRI packs two numbers into one: `14` is facility 1 (user) times 8 plus severity 6 (info).
Vector decodes it to a `severity` string, which becomes the `level` label — a line written
to stderr arrives as `<11>`, severity 3, and is labelled `error` with no work from the app.

Structured data is exposed under its full element id: `."tags@47450"`, `."gauge@47450"`,
`."counter@47450"`. Vector also sets its own top-level `source_type` (`http_server`), so
CF's is carried as `cf_source_type` and renamed in the Loki sink's label map.

Logs and metrics share one connection and differ in four fields:

|                                       | Log frame                                   | Metric frame           |
| ------------------------------------- | ------------------------------------------- | ---------------------- |
| `message`                             | the line as written                         | empty                  |
| `procid`                              | source type (`[APP/PROC/WEB/0]`, `[RTR/5]`) | instance index (`[0]`) |
| `."tags@47450".source_type`           | the clean source type                       | absent                 |
| `."gauge@47450"` / `."counter@47450"` | absent                                      | the value, as a string |

## Access control

CF authenticates using credentials in the drain URL's userinfo
(`https://user:pass@<bridge-route>/`). That is its only mechanism, so the same pair must
be set on this app and in the drain URL. Rotating means changing both together.

This is load-bearing rather than defence in depth: Loki labels are built from fields in
the received frame, so an open endpoint would let anyone forge structured data and mint
arbitrary label values in an instance shared by every environment.
