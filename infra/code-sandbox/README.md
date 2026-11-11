# Code sandbox (prototype)

Lets the chat model run Python and bash in a per-chat pod with no network
access. The backend creates the pod and talks to it through `kubectl`, so
`kubectl` must be on the backend's PATH.

## Local setup

```sh
kind create cluster --name baergpt-sandbox
docker build -t baergpt-code-sandbox:dev infra/code-sandbox
kind load docker-image baergpt-code-sandbox:dev --name baergpt-sandbox
kubectl --context kind-baergpt-sandbox apply -f infra/code-sandbox/k8s/namespace.yaml -f infra/code-sandbox/k8s/network-policy.yaml
```

Backend env:

```
FEATURE_FLAG_CODE_SANDBOX_ALLOWED=true
CODE_SANDBOX_KUBE_CONTEXT=kind-baergpt-sandbox
```

Frontend env:

```
VITE_FEATURE_FLAG_CODE_SANDBOX_ALLOWED=true
```

Always set `CODE_SANDBOX_KUBE_CONTEXT` locally. Without it the backend uses
whatever context your kubeconfig currently points at.

Optional backend env: `CODE_SANDBOX_NAMESPACE` (default `baergpt-sandbox`),
`CODE_SANDBOX_IMAGE` (default `baergpt-code-sandbox:dev`),
`CODE_SANDBOX_KUBECTL_PATH` (default `kubectl`).

## Checks

```sh
# pods appear while a chat uses the tool, and are removed after 30 minutes
kubectl --context kind-baergpt-sandbox --namespace baergpt-sandbox get pods

# must fail: the sandbox has no network
kubectl --context kind-baergpt-sandbox --namespace baergpt-sandbox exec <pod> -- python3 -c "import urllib.request; urllib.request.urlopen('https://example.org', timeout=5)"
```

## Against a remote cluster

Apply all three files in `k8s/`, push the sandbox image (built for
`linux/amd64`) to a registry the cluster can pull from and set
`CODE_SANDBOX_IMAGE`. Give the backend a kubeconfig for the `sandbox-manager`
service account through `KUBECONFIG`, and set `CODE_SANDBOX_KUBECTL_PATH` if
`kubectl` is not on its PATH. Leave `CODE_SANDBOX_KUBE_CONTEXT` unset.

## Limits of the prototype

- Plain container isolation (no gVisor/Kata).
- Result files live only in the pod; download links stop working once the
  pod is removed.
- Only documents selected in the chat are copied in, not selected folders.
