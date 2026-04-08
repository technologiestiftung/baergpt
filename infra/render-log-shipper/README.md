# Render Log Shipper

Polls Render's REST API for logs from specified services and pushes them to STACKIT Observability's Loki endpoint.

## Deploy on Render

1. Create a new **Background Worker** on Render (not a web service — this has no inbound traffic).
2. Point it at this repo, set the root directory to `infra/render-log-shipper`.
3. Set the following environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `RENDER_API_KEY` | Render API key | Create at Account Settings → API Keys |
| `RENDER_OWNER_ID` | Your workspace/owner ID | Found in workspace settings URL |
| `RENDER_RESOURCE_IDS` | Comma-separated service IDs | e.g. `srv-abc123,srv-def456` |
| `LOKI_PUSH_URL` | STACKIT Loki Ingest URL | The "Ingest" endpoint from your Observability instance |
| `LOKI_USERNAME` | STACKIT Observability username | From Observability credentials |
| `LOKI_PASSWORD` | STACKIT Observability password | From Observability credentials |
| `POLL_INTERVAL_SECONDS` | `60` | How often to poll (default: 60) |

4. Deploy.

## Finding service IDs

Service IDs look like `srv-xxxxxxxxxxxxxxxx`. You can find them in the Render dashboard URL when viewing a service, or via the Render API:

```bash
curl -H "Authorization: Bearer $RENDER_API_KEY" https://api.render.com/v1/services?ownerId=$RENDER_OWNER_ID
```

## Verify

Check the worker's logs in the Render dashboard — you should see "Pushed N log entries to Loki" messages.

In STACKIT Grafana → Explore → Loki data source → search for `{source="render"}`.

## Security

- **No inbound attack surface** — background workers accept no incoming traffic
- **Credentials** — stored as Render env vars, never in code
- **Scope** — only fetches logs for the explicitly listed service IDs
- **Render API key** — has workspace-wide read access; store securely
