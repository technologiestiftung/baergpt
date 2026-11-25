# Incident log tooling

`incident.py` downloads BärGPT's access logs from STACKIT Loki and helps you read them: what an
alert matched, a copy of every log for a time window, and everything one client or account did.
Python 3.9+, no dependencies. Read-only: it only queries Loki.

It covers the logs only. Containment and who to inform are in the "BärGPT Incident Runbook" page
in Notion.

| Command      | What it does                                                         | Talks to Loki |
| ------------ | -------------------------------------------------------------------- | ------------- |
| `alert NAME` | replays one alert rule, summarises the requests it matched           | yes           |
| `pull`       | downloads every log stream for a time window                         | yes           |
| `actor`      | searches the downloaded files for one address, account or user agent | no            |
| `export`     | writes a copy with identifiers replaced, for working outside         | no            |

Commands that talk to Loki need the `op run --env-file .op.env.incident --` prefix, which hands
them the Loki credentials from 1Password. The other two read local files and run without it.

## Setup (once)

You need the 1Password CLI (`op`), signed in, with access to the STACKIT Observability
credentials.

```sh
cd infra/incident
cp .op.env.incident.example .op.env.incident
```

In `.op.env.incident`:

- Replace `<vault>/<observability-item>` with the vault and item that hold the STACKIT
  Observability instance credentials. One instance holds the staging and the production logs.
- Set `RENDER_BACKEND_RESOURCE` to the value of `render_backend_resource` in `production.tfvars`.
  Without it the production backend log is skipped.

The file holds `op://` references, no secrets, and is gitignored.

Check that it works with the last 15 minutes of staging:

```sh
op run --env-file .op.env.incident -- ./incident.py pull --env staging --from 15m --incident setup-check
```

Expect one `<stream>: <n> lines` row per stream and a final `Wrote …` line. Then remove the
folder: `rm -r ~/baergpt-incidents/setup-check`.

## Options every command shares

- `--incident NAME` is the name you give the incident. It is only a folder name: everything for
  it goes to `~/baergpt-incidents/NAME/`. Choose it once, as date plus a keyword
  (`2026-11-18-session`: the incident of 18 November about a suspicious session), and pass the
  same name to every command. Without it the folder is today's date, so two incidents on one
  day would mix.
- `--from` and `--to` take ISO 8601 (`2026-11-18T09:00`) or an age (`90m`, `3h`, `2d`). A time
  without an offset is UTC; for Berlin time write the offset: `2026-11-18T09:00+01:00`. `--to`
  defaults to now.
- `--env staging` reads staging instead of production.
- `--raw` prints addresses, account ids and emails as logged. Without it the terminal shows
  tokens such as `uid_8eac5845cb13` (see [Scrubbed output](#scrubbed-output)).

## During an incident

Run everything from `infra/incident`. The examples use the incident name `2026-11-18-session`.

### 1. See what the alert matched

Take the alert name from the alert email. The window is the last 3 hours unless you pass
`--from`. An unknown name prints the list of known names.

```sh
op run --env-file .op.env.incident -- ./incident.py alert SecurityScriptObtainedSession --incident 2026-11-18-session
```

```
# SecurityScriptObtainedSession, production, 2026-11-18 06:30:00 to 2026-11-18 09:30:00 UTC

## kong
- matching lines: 14, first 2026-11-18 08:02:11, last 2026-11-18 08:41:57 UTC
- answered with 2xx: 14 of 14
- client addresses: not in this log (Kong records the proxy's address)
- count · method · status · path · client type:
  - 14 · POST · 200 · /auth/v1/token?grant_type · python-requests
```

One section per log the rule runs on. The matching lines are saved in the incident folder.

### 2. Save the logs

Do this as soon as an incident is declared: Loki deletes logs after its retention time. Start
the window well before the first suspicious request.

```sh
op run --env-file .op.env.incident -- ./incident.py pull --from 2026-11-17T08:00 --incident 2026-11-18-session
```

```
kong: 48210 lines
auth: 1932 lines
anon-egress: 12 lines
envoy: 0 lines  (no requests in this window, or older than Loki keeps)
render: 9120 lines

Wrote /Users/you/baergpt-incidents/2026-11-18-session/raw/20261118T093412Z-pull (and scrubbed/); manifest.md and SHA256SUMS updated.
```

Kong's log records the proxy's address, not the client's. To follow a client through Supabase,
also copy the nginx access log from the Supabase VM into the incident's `raw/` folder:

```sh
scp '<supabase-vm>:/var/log/nginx/access.log*' ~/baergpt-incidents/2026-11-18-session/raw/
```

### 3. Follow one client or account

Searches the files from step 2, plain and gzipped.

```sh
./incident.py actor --incident 2026-11-18-session --user <account id or email>
./incident.py actor --incident 2026-11-18-session --ip <address> --from 2026-11-18T09:00
```

```
# 2 lines in 5 files

2026-11-18 09:12:01  auth         200 POST   /token  [auth:login]  net_5f0c2a91.h3b7e
2026-11-18 09:12:03  kong         200 GET    /rest/v1/documents?owned_by_user_id&select  [python-requests]  172.18.0.5

## Summary
- by status: 2xx 2
- accounts on these lines: 1: uid_8eac5845cb13 (1)
- emails on these lines: 1: usr_7dc352ba@redacted (1)
```

One line per request across all logs, oldest first, then the addresses, accounts and emails
seen on those lines. To search for one of them next, run the same command with `--raw` to see
the real value and pass that to `--ip` or `--user`.

- `--user` only finds lines that contain the id or email: auth events and requests with the id
  in the URL. For everything a session did, search by its address for the time it was logged in.
- `--ua TEXT` searches the user agent, `--match TEXT` any text. All four can be repeated; a line
  matching any of them is shown.
- `OPTIONS` requests, which browsers send before a call, are left out unless `--options` is
  given.
- With the nginx log copied, a gateway request appears twice, once per log.

### 4. Make a copy you can work on elsewhere

```sh
./incident.py export --incident 2026-11-18-session --dest ~/baergpt-export/2026-11-18-session
```

```
lines · of them readable · file
1932 · 1810 · 20261118T093412Z-pull/auth.jsonl
48210 · 48210 · 20261118T093412Z-pull/kong.jsonl
```

Writes everything in `raw/`, nginx logs included, with identifiers replaced. Line N of a file
in the copy is line N of the file with the same name in `raw/`. `--dest` must be a new folder
outside the incident folder; inside the repository only if git ignores it.

## Only downloading logs

`pull` works the same without an incident, for example to debug staging:

```sh
op run --env-file .op.env.incident -- ./incident.py pull --env staging --from 2h --incident debug-login
op run --env-file .op.env.incident -- ./incident.py pull --from 2026-11-20T14:00+01:00 --to 2026-11-20T15:00+01:00 --incident debug-upload
```

It always downloads all streams of the environment. The files contain personal data: delete
the folder when you are done.

## What ends up on disk

```
~/baergpt-incidents/2026-11-18-session/
├── raw/
│   ├── 20261118T093000Z-alert-SecurityScriptObtainedSession/kong.jsonl
│   └── 20261118T093412Z-pull/{kong,auth,anon-egress,envoy,render}.jsonl
├── scrubbed/        same files, identifiers replaced
├── manifest.md      one section per run: window, queries, line counts, first and last time
└── SHA256SUMS       checksums of everything in raw/
```

Set `INCIDENT_DIR` to use another parent folder; a path inside the repository is refused. Every
`alert` and `pull` run writes a new subfolder named after the time it ran, so a later run never
overwrites an earlier one. A stream with no lines gets no file; the manifest records the 0.
Verify the checksums with `(cd raw && sha256sum -c ../SHA256SUMS)`. `actor` and `export` add
files you copied into `raw/` to `SHA256SUMS` when they start.

| File                | Log                                                                    |
| ------------------- | ---------------------------------------------------------------------- |
| `kong.jsonl`        | Supabase API gateway: every REST, auth and storage request             |
| `auth.jsonl`        | Supabase Auth (GoTrue): logins and audit events                        |
| `anon-egress.jsonl` | requests blocked by the Tor/Mullvad blocklist, with the client address |
| `envoy.jsonl`       | gateway of the SKE cluster, requests to this environment's namespace   |
| `render.jsonl`      | backend on Render, production only                                     |

Each line of a file is one JSON object: `ts` (nanoseconds since 1970, UTC), `labels` (the Loki
stream labels) and `line` (the log line as logged).

```sh
jq -r '.line' kong.jsonl                                      # the log lines only
jq -r '"\(.ts / 1e9 | floor | todate)  \(.line)"' kong.jsonl  # with a readable time
```

## Scrubbed output

The terminal, `scrubbed/` and `export` replace identifiers with tokens:

| Token                   | Stands for                                                             |
| ----------------------- | ---------------------------------------------------------------------- |
| `net_….h…`              | public IPv4 address; addresses in the same /24 share the `net_` part   |
| `ip6_…`                 | public IPv6 address                                                    |
| `uid_…`                 | UUID: account, document or chat id                                     |
| `usr_…@redacted`        | email address                                                          |
| `jwt_…`                 | JWT                                                                    |
| `val_…`                 | value of a query parameter, except structural ones (`select`, `limit`) |
| `file_….pdf`            | object name in a storage path                                          |
| `(not a request line…)` | a line that is neither a request nor an auth event, e.g. an error      |

Private addresses and user agents stay as logged. The same value always gets the same token, so
you can still follow one client. Tokens are keyed hashes; the key is created on first run in
`~/.config/baergpt/scrub.key`, so tokens from two machines do not match.

Scrubbed files are pseudonymised, not anonymous: they are still personal data and do not belong
in the repository or a ticket.

## Maintenance

- `alert` reads the rule lists in `infra/terraform/observability/alerts_security.tf` by their
  layout (`security_kong_rules`, `security_render_rules`, `security_envoy_rules`, heredoc
  expressions). It stops with an error if it cannot read them.
- `pull` exports the streams listed in `streams_for()`. Add new log streams there.
- Check after a change: trigger a rule on staging (e.g. `GET /rest/v1/` with the anon key),
  then run both commands below. The request must show up in each.

  ```sh
  op run --env-file .op.env.incident -- ./incident.py alert SecuritySchemaReadRefused --env staging --from 15m
  op run --env-file .op.env.incident -- ./incident.py pull --env staging --from 15m
  ```
