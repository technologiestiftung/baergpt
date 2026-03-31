# Render OTel Collector

Bridges Render's observability streams to STACKIT Observability.

- **Metrics**: Receives OTLP HTTP from Render metrics stream, forwards to STACKIT via Prometheus Remote Write with Basic Auth.
- **Logs**: Receives syslog from Render log stream, forwards to STACKIT via Loki Push API with Basic Auth.

## Deploy on Render

1. Create a new **Web Service** on Render.
2. Point it at this repo, set the root directory to `infra/render-otel-collector`.
3. Set the following environment variables:

| Variable | Value |
|----------|-------|
| `STACKIT_OBSERVABILITY_METRICS_PUSH_URL` | From STACKIT Observability instance (Prometheus remote write URL) |
| `STACKIT_OBSERVABILITY_LOGS_PUSH_URL` | From STACKIT Observability instance (Loki push URL) |
| `STACKIT_OBSERVABILITY_USERNAME` | From STACKIT Observability credentials |
| `STACKIT_OBSERVABILITY_PASSWORD` | From STACKIT Observability credentials |
| `RENDER_OTEL_BEARER_TOKEN` | A random secret you generate (e.g. `openssl rand -hex 32`). Use the same value in Render's metrics stream API Key field. |

4. Deploy. Note the public URL (e.g. `https://otel-collector-xxx.onrender.com`) and internal address (e.g. `otel-collector-xxx:5514`).

## Wire up Render Observability

### Metrics Stream

Dashboard > Integrations > Observability > Metrics Stream > + Add destination:
- Provider: **Custom**
- Endpoint: `https://otel-collector-xxx.onrender.com/v1/metrics`
- API Key: the same value as `RENDER_OTEL_BEARER_TOKEN` (collector validates this token on every request)

### Log Stream

Dashboard > Integrations > Observability > Log Stream > + Set default:
- Log Endpoint: `otel-collector-xxx:5514` (internal address — may or may not work; see notes)
- Token: leave empty

**Note on logs**: Render log streams require a TLS-enabled syslog endpoint. The internal address may not work if Render's platform streams from outside the private network. If logs don't appear in Grafana but metrics do, this is why. In that case, we'll need to expose the syslog port externally.

## Verify

Open STACKIT Observability Grafana:
1. Go to **Explore** > select **Thanos** data source > look for metrics with `source="render"` label
2. Go to **Explore** > select **Loki** data source > look for logs with `source="render"` label
