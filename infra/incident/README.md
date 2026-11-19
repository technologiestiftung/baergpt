# Incident log tooling

`incident.py` gets the access logs you need during a security incident out of STACKIT Loki:
what an alert matched, a copy of every stream for a time window, and the timeline of one
client or account. Python 3.9+, no dependencies. Read-only: it only queries Loki.

## Setup

```sh
cp .op.env.incident.example .op.env.incident   # then fill in the vault and item
```

`.op.env.incident` holds `op://` references and the Render service id; it is gitignored.

## Commands

Times are ISO 8601 (UTC unless they carry an offset) or an age such as `90m`, `3h`, `2d`.
`--incident` names the output folder and defaults to today's date. `--env staging` switches
from production.

**1. What did the alert match?** Takes the alert name from the email, default window 3 hours.

```sh
op run --env-file .op.env.incident -- ./incident.py alert SecurityScriptObtainedSession --incident 2026-11-18-session
```

Prints, per log the rule runs on: number of matching lines, first and last time, how many
were answered with a 2xx, and counts by method, status, path and client type.

**2. Keep a copy of the logs.** Run it as soon as an incident is declared: Loki only keeps
logs for a limited time.

```sh
op run --env-file .op.env.incident -- ./incident.py pull --from 2026-11-17T08:00 --incident 2026-11-18-session
```

Prints the number of lines per stream. 0 lines means no requests reached that service in the
window, or the window is older than Loki keeps.

**3. What did one client or account do?** Searches the files from step 2, no Loki access.

```sh
./incident.py actor --incident 2026-11-18-session --user <account id or email>
./incident.py actor --incident 2026-11-18-session --ip <address> --from 2026-11-18T09:00
```

Prints one line per request across all logs, oldest first, then the addresses, account ids
and emails that appear on those lines. Use them for the next search.

`--user` only finds lines that contain the id or email: auth events and requests with the id in
the URL. For everything a session did, search by its address for the time it was logged in.
`OPTIONS` requests, which browsers send before a call, are left out unless `--options` is given.
With the nginx log copied, a gateway request from the pulled window appears twice, once per log.

Kong's log records the proxy's address, not the client's. To follow a client through
Supabase, copy `/var/log/nginx/access.log*` from the Supabase VM into the incident's `raw/`
folder; `actor` reads plain and gzipped files there. `actor` and `export` add files copied this
way to `SHA256SUMS` when they start.

**4. Make a scrubbed copy to work on outside the incident folder.**

```sh
./incident.py export --incident 2026-11-18-session --dest ~/baergpt-export/2026-11-18-session
```

Prints, per file, the lines and how many of them stay readable. The copy covers everything in `raw/`, including the
nginx logs copied there. Line N of a file in it is line N of the file with the same name in
`raw/`. `--dest` must be a new folder outside the incident folder; inside the repository only
if git ignores it.

## Output

`~/baergpt-incidents/<incident>/` (override the parent with `INCIDENT_DIR`; a path inside the
repository is refused). Give every incident its own name, e.g. `--incident 2026-11-18-session`;
without one, everything from the same day lands in one folder.

| Path          | Content                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| `raw/`        | lines as logged, one JSON object per line (`ts`, `labels`, `line`)                      |
| `scrubbed/`   | the same files with identifiers replaced                                                |
| `manifest.md` | one section per run: window, queries, line counts, first and last time                  |
| `SHA256SUMS`  | checksums of everything in `raw/`; verify with `(cd raw && sha256sum -c ../SHA256SUMS)` |

Every `alert` and `pull` run writes to a new subfolder named after the time it ran, such as
`raw/20261118T143002Z-pull/`, so a later run never overwrites an earlier one. A stream or rule
with no lines gets no file; the manifest records the 0.

The terminal shows tokens instead of public addresses, account ids, emails and JWTs unless
`--raw` is given. Scrubbed lines also hide the values of query parameters (`val_…`, except
structural ones such as `select` and `limit`) and the object names in storage paths
(`file_….pdf`). A line that is neither a request nor an auth audit or login event (a program
message, an error) is replaced by a placeholder with its length. User agents stay as logged. Tokens are keyed hashes (key in `~/.config/baergpt/scrub.key`), so the same
value always gets the same token. Scrubbed files are pseudonymised, not anonymous: they are
still personal data and do not belong in the repository or a ticket.

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
