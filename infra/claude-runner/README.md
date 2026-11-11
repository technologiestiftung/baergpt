# Claude self-hosted runner (Tart)

`@claude` mentions in issues and PRs run `.github/workflows/claude.yml` on a Mac host.
Each job gets a fresh Ubuntu arm64 VM, cloned (APFS copy-on-write) from a golden image, and deleted afterwards.

```
runner-loop.sh (LaunchAgent)
  └─ per slot: tart clone baergpt-golden → boot → JIT-register runner → 1 job → tart delete
```

## Golden image contents

Node (`.nvmrc`, in the Actions tool cache), npm (`packageManager`), Supabase CLI (`.tool-versions`) and its Docker images, Playwright browsers and deps, Docker, `gh`, 1Password CLI, Actions runner, npm cache, and an installed `staging` checkout (`~/warm/baergpt`) whose `node_modules` jobs reuse.
Bun and Claude Code at the versions pinned inside the `claude-code-action` SHA from `claude.yml`.

## Setup

1. Install tools:
   ```sh
   brew install openai/tools/tart openai/tools/softnet gh
   gh auth login
   sudo chown root:wheel "$(readlink -f "$(which softnet)")" && sudo chmod u+s "$(readlink -f "$(which softnet)")"
   ```
   `jq` ships with macOS. The Asana listener also needs Node ≥ 24 on the host. Runner VMs use `softnet` (internet only, no host/LAN access), which needs the SUID bit. Re-run the `chmod` after `brew upgrade softnet`.
2. Org admin: create a runner group `baergpt-claude` (Org settings → Actions → Runner groups) with repository access limited to `baergpt`. Turn on **Allow public repositories**. Leave workflow access unrestricted: GitHub requires a pinned ref there, and PR review comments run from the PR ref. Put its ID in `RUNNER_GROUP_ID` in `config.sh`:
   ```sh
   gh api orgs/technologiestiftung/actions/runner-groups -q '.runner_groups[] | "\(.id) \(.name)"'
   ```
   Then create an org-owned GitHub App (no webhook). Give it exactly one permission: organization **Self-hosted runners: Read and write**. No repository permissions. Install it on the org with access to no repositories. Set its App ID as `GITHUB_APP_ID` in `config.sh`. Generate a private key and store it in the keychain, then delete the file:
   ```sh
   security add-generic-password -a "$USER" -s baergpt-runner-app-key -w "$(base64 -i app.pem)"
   rm app.pem
   ```
   This App only registers runners. Comments, commits and PRs come from the Claude GitHub App (step 6) as `claude[bot]`.
3. Build the golden image (~20 min):
   ```sh
   ./build-golden.sh
   ```
4. Start the runner loop:
   ```sh
   ./install.sh
   tail -f ~/Library/Logs/baergpt-runner/runner.log
   ```
5. Add the repo secret `ANTHROPIC_API_KEY` (an org API key from console.anthropic.com).
6. Install the Claude GitHub App on the repo: https://github.com/apps/claude

## Operations

- Nightly at 03:00, `rebuild-if-needed.sh` rebuilds the golden image when its inputs on `staging` changed (lockfile, `package.json`, `.nvmrc`, `.tool-versions`, `claude.yml`, these scripts) or it is older than 7 days. Log: `~/Library/Logs/baergpt-runner/rebuild.log`.
- Manual rebuild: `./build-golden.sh`. Running VMs are unaffected; new clones use the new image.
- Jobs reuse the image's `node_modules` when `package-lock.json` matches the baked `staging` checkout, else they run `npm ci` from the baked cache.
- Stop: `launchctl bootout gui/$(id -u)/berlin.technologiestiftung.baergpt-runner` (and `...-rebuild`, `berlin.technologiestiftung.baergpt-asana-listener`).
- Tune `RUNNER_SLOTS`, `VM_CPU`, `VM_MEMORY_MB`, `WARM_BRANCH`, `GOLDEN_MAX_AGE_DAYS` in `config.sh`.
- The host must stay logged in (LaunchAgent). Disable sleep: `sudo pmset -a sleep 0`.

## Asana

Write `@claude` in a task comment or description on one of the configured Asana boards.
`asana-listener.mts` (LaunchAgent) polls the boards every 10 s (`ASANA_POLL_SECONDS`) and starts `.github/workflows/claude-asana.yml` with the task as input.
Claude answers, or opens a PR against `staging`, or pushes to an existing PR. The listener posts the reply as an Asana comment starting with 🤖; those never re-trigger.
The Asana token stays in the keychain on this Mac. It never reaches GitHub or Claude.

Setup:

1. Runner App: add repository permission **Actions: Read and write**, and give its installation access to `baergpt`.
2. Store an Asana personal access token:
   ```sh
   security add-generic-password -a "$USER" -s baergpt-asana-token -w
   ```
3. Create the key that encrypts tasks and replies (run logs and artifacts are public). It goes to the keychain and the secret `ASANA_CONTEXT_KEY` of the environment `asana` (deployment branches: `main` only), and never appears on screen:
   ```sh
   KEY="$(openssl rand -base64 32)"
   security add-generic-password -a "$USER" -s baergpt-asana-context-key -w "$KEY"
   gh secret set ASANA_CONTEXT_KEY -R technologiestiftung/baergpt --env asana --body "$KEY"
   unset KEY
   ```
4. Set `ASANA_PROJECT_GIDS` (the number in each board URL, comma-separated) and `ASANA_ALLOWED_USERS` (Asana user GIDs, comma-separated; command in `config.sh`) in `~/.config/baergpt-runner/env` (per host, not in git), or store them in 1Password and set `ASANA_PROJECT_GIDS_OP` / `ASANA_ALLOWED_USERS_OP` there instead (e.g. `op://Vault/Item/field`; `install.sh` reads them with `op read`). Then run `./install.sh`. Log: `~/Library/Logs/baergpt-runner/asana.log`.
5. `claude-asana.yml` must be on `main`: GitHub only starts manually dispatched workflows from the default branch.

Only users in `ASANA_ALLOWED_USERS` can trigger Claude; other board members get a reply asking them to get their user ID added. To add someone, edit the env file and re-run `./install.sh`. The context still contains everyone's comments on that task.
Tasks on that board are sent to the Claude API. Keep personal and confidential data out of them.

## Security

- Public repo: only `OWNER`/`MEMBER`/`COLLABORATOR` can trigger the workflow.
- Only `claude.yml` and `claude-asana.yml` target the `baergpt-claude` label. Keep other workflows on GitHub-hosted runners.
- Keep "Require approval for all outside collaborators" enabled under Settings → Actions. Fork PR runs need a maintainer's approval and get no secrets.
- Runner VMs run with `--net-softnet` (see `VM_NET_FLAGS`), so a job cannot reach the LAN.
- The runner App can only manage org runners. It cannot read code, settings or secrets.
  With Asana enabled, it can also start and read workflow runs in `baergpt` (Actions: Read and write).
- `claude.yml` refuses fork PRs: their code would run with write credentials.
- The App key stays on the host. Installation tokens live 1 h. VMs receive only a single-use JIT runner config.
