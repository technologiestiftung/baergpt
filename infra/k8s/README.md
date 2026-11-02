# Kubernetes manifests (SKE)

The backend and Gotenberg as they run on the SKE cluster. The cluster itself, namespaces and the
deployer access are in [`infra/terraform/ske`](../terraform/ske/README.md).

| Path                   | Contents                                                   |
| ---------------------- | ---------------------------------------------------------- |
| `base/backend`         | backend Deployment, Service, HTTPRoute, PDB, NetworkPolicy |
| `base/gotenberg`       | Gotenberg Deployment, Service, PDB, NetworkPolicy          |
| `overlays/<namespace>` | per-environment replicas, resources and hostname           |

## Deploying

[`backend-deploy-stackit-ske.yml`](../../.github/workflows/backend-deploy-stackit-ske.yml) builds the
image and applies the overlay:

| Environment | Started by                                                      |
| ----------- | --------------------------------------------------------------- |
| `staging`   | every push to `staging`                                         |
| `prod`      | Actions → Run workflow on `main`                                |
| `sandbox`   | Actions → Run workflow on `staging` or `main`, target `sandbox` |

Every run builds the image fresh, also when only the env changed.

## Env variables

Each environment's env lives in a 1Password note. A deploy reads the note and writes it to one of two
Secrets per app, `<app>-env-a` or `<app>-env-b`:

- A changed env goes into the Secret the app isn't using, and the app switches to it. The other one
  still holds the previous env.
- An unchanged env keeps the current Secret, so the pods don't restart.

To change a value: edit the note, then deploy.

Never rename or remove a variable in the same change that starts using its replacement. Add the new
variable first, deploy the code that uses it, and remove the old one in a later change. Then reverting
code never needs the old env back.

## When a deploy fails

**New pods don't become ready within 5 minutes.** The workflow rolls back every Deployment this run
changed, to the image and env it had before. The old pods keep serving throughout. The job ends red.

The 1Password note still holds the new env. Fix the code or the note, then deploy again; until then,
any deploy brings the failed env back.

**The smoke check fails** (`/health` through the public URL). There is no rollback: the pods are
ready, so the cause is usually DNS or the certificate. The new version stays live.

## Rolling back on purpose

Revert the commit and deploy. Re-running an old workflow run is refused.

If the revert needs the old env (the bad change renamed or removed variables): restore the 1Password
note first, from the item's history, then revert. On `staging` the revert deploys as soon as it's
pushed.

`kubectl rollout undo` by hand restores the env only one deploy back. The Secret before that has been
overwritten.
