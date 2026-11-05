# Claude self-hosted runner (Tart)

`@claude` mentions in issues and PRs run `.github/workflows/claude.yml` on a Mac host.
Each job gets a fresh Ubuntu arm64 VM, cloned (APFS copy-on-write) from a golden image, and deleted afterwards.

```
runner-loop.sh (LaunchAgent)
  └─ per slot: tart clone baergpt-golden → boot → JIT-register runner → 1 job → tart delete
```

## Golden image contents

Node (`.nvmrc`, in the Actions tool cache), npm (`packageManager`), Supabase CLI (`.tool-versions`) and its Docker images, Playwright browsers and deps, Docker, `gh`, 1Password CLI, Actions runner, warm npm cache.
Bun and Claude Code at the versions pinned inside the `claude-code-action` SHA from `claude.yml`. Rebuild after bumping that SHA.

## Setup

1. Install tools:
   ```sh
   brew install openai/tools/tart openai/tools/softnet
   sudo chown root:wheel "$(readlink -f "$(which softnet)")" && sudo chmod u+s "$(readlink -f "$(which softnet)")"
   ```
   `jq` ships with macOS. Runner VMs use `softnet` (internet only, no host/LAN access), which needs the SUID bit. Re-run the `chmod` after `brew upgrade softnet`.
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

- Rebuild the golden image after version bumps or monthly: `./build-golden.sh`. Running VMs are unaffected; new clones use the new image.
- Stop: `launchctl bootout gui/$(id -u)/berlin.technologiestiftung.baergpt-runner`
- Tune `RUNNER_SLOTS`, `VM_CPU`, `VM_MEMORY_MB` in `config.sh`.
- The host must stay logged in (LaunchAgent). Disable sleep: `sudo pmset -a sleep 0`.

## Security

- Public repo: only `OWNER`/`MEMBER`/`COLLABORATOR` can trigger the workflow.
- Only `claude.yml` targets the `baergpt-claude` label. Keep other workflows on GitHub-hosted runners.
- Keep "Require approval for all outside collaborators" enabled under Settings → Actions. Fork PR runs need a maintainer's approval and get no secrets.
- Runner VMs run with `--net-softnet` (see `VM_NET_FLAGS`), so a job cannot reach the LAN.
- The runner App can only manage org runners. It cannot read code, settings or secrets.
- The App key stays on the host. Installation tokens live 1 h. VMs receive only a single-use JIT runner config.
