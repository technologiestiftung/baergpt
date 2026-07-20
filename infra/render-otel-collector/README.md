# Render OTel Collector

Bridges Render's metrics stream to STACKIT Observability. **Metrics only** — logs are handled by the separate [render-log-shipper](../render-log-shipper/).

## Deploy on Render

1. Create a new **Web Service** on Render.
2. Point it at this repo, set the root directory to `infra/render-otel-collector`.
3. Set the following environment variables:

| Variable                                 | Value                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `STACKIT_OBSERVABILITY_METRICS_PUSH_URL` | STACKIT Observability → Remote Write URL                                                                                 |
| `STACKIT_OBSERVABILITY_USERNAME`         | From STACKIT Observability credentials                                                                                   |
| `STACKIT_OBSERVABILITY_PASSWORD`         | From STACKIT Observability credentials                                                                                   |
| `RENDER_OTEL_BEARER_TOKEN`               | A random secret you generate (e.g. `openssl rand -hex 32`). Use the same value in Render's metrics stream API Key field. |

4. Deploy. Note the public URL (e.g. `https://otel-collector-xxx.onrender.com`).

## Wire up Render Observability

Dashboard > Integrations > Observability > Metrics Stream > + Add destination:

- Provider: **Custom**
- Endpoint: `https://otel-collector-xxx.onrender.com/v1/metrics`
- API Key: the same value as `RENDER_OTEL_BEARER_TOKEN`

## Verify

Open STACKIT Observability Grafana:

1. Go to **Explore** > select **Thanos** data source > look for `render_service_*` metrics
