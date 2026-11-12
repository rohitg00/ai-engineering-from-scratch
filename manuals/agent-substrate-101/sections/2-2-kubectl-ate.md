# kubectl ate

> `kubectl ate` talks to `ate-api-server` and reads Postgres, and without `--token-file` every caller acts as one shared identity.

You type `kubectl get actors` on a cluster that runs Agent Substrate, and Kubernetes answers that it has no such resource. The actor exists. You asked the wrong server. Actors, templates, and workers are rows in the Substrate database, and one plugin reads them.

When you finish this section, you can install `kubectl ate` and say how each command reaches the control plane. You can also explain the warning that it prints on every call.

## Install the plugin

**Plugin:** `kubectl-ate` is one binary. When it is on your `PATH`, `kubectl` runs it for every command that starts with `kubectl ate`.

The release publishes the binary for Linux and macOS, on amd64 and arm64. There is no Windows build {{docs}}. Download the file and its checksum, check it, and install it:

```bash
BASE=https://github.com/agent-substrate/substrate/releases/download/v1.0.0
curl -LO $BASE/kubectl-ate-linux-amd64
curl -LO $BASE/kubectl-ate-linux-amd64.sha256
shasum -a 256 -c kubectl-ate-linux-amd64.sha256
mkdir -p ~/.local/bin
install -m 0755 kubectl-ate-linux-amd64 ~/.local/bin/kubectl-ate
```

On a Mac with Apple silicon, the file is `kubectl-ate-darwin-arm64`. If you have the checkout and Go, you can build the plugin from the tag:

```bash
go install ./cmd/kubectl-ate
```

`kubectl` finds the plugin only on your `PATH`. Check that `~/.local/bin` is on it, or the directory `$(go env GOPATH)/bin` when you use `go install`.

**We measured** the build once on an x86 server guest with 16 vCPU and 23 GB. `go install` took 5 s after the install of the control plane, because the Go modules were already on disk. In our runs we always built the plugin from the tag. We checked that both release files exist, and we did not time the download.

Check the version before you go on:

```bash
kubectl ate --version
```

## How a command reaches the control plane

`kubectl ate` does not ask the Kubernetes API for actors. It uses your kubeconfig to open a port-forward to the Service `api` in the namespace `ate-system`. Without `--token-file`, it also uses the kubeconfig to request a token for the shared `ate-client` ServiceAccount. Then it sends a gRPC request through that port-forward to `ate-api-server`, and `ate-api-server` answers from Postgres {{code}}. [Figure 2.2](#fig-2-2) shows that path beside the path of a plain `kubectl` command.

```figure
id: fig-2-2
kind: flow
title: where kubectl ate and kubectl read from
claim: kubectl ate reads atespaces, templates, actors, and workers from Postgres through ate-api-server, and kubectl reads only three custom resources from etcd.
caption: The top row is every kubectl ate command except proxy. The bottom row is plain kubectl. The dashed box is the identity that the top row uses by default. From capture/lab/A-quickstart/50-create-actor.log and capture/lab/A-quickstart/60-state.log.
```

Two facts follow from the figure.

First, each command opens its own port-forward. So `kubectl ate` needs a working Kubernetes API server, and your account needs the right to port-forward into `ate-system`. With kube-apiserver down, a command fails like this:

```listing
title: a kubectl ate command while kube-apiserver is down
source: capture/lab/E-dependency-loss/16-T3-cli-during.txt
lang: text
---
Error: failed to connect to ate-api-server: getting api service: Get "https://127.0.0.1:44015/api/v1/namespaces/ate-system/services/api": EOF
```

Actors kept serving requests during that outage. Only the CLI and the proxy failed. [Section 2.3](#s-your-first-actor-and-the-proxy) has the numbers.

Second, the flag `--endpoint` skips the port-forward. A program inside the cluster passes the address of `ate-api-server` and dials it directly. Its pod must be in a namespace with the label `ate.dev/api-access=true` {{docs}}. We did not set that label ourselves, and we did see the network rule behind it in the kagent run. A pod in `default` could not reach the API, and a pod in `kagent` could. [Section 5.1](#s-client-authentication) has that probe.

## The shared identity warning

Every command in our recordings starts with the same line:

```listing
title: the first actor, created without a token file
source: capture/lab/A-quickstart/50-create-actor.log
lang: text
---
Warning: no --token-file given; acting as the shared identity system:serviceaccount:ate-system:ate-client rather than as yourself. Pass --token-file to act as yourself.
ATESPACE           NAME           TEMPLATE                   STATE                   WORKER POD   WORKER IPS   VERSION   AGE
ate-demo-counter   my-counter-1   ate-demo-counter/counter   ACTOR_STATE_SUSPENDED   <none>                    1         0s
```

**Shared identity:** the ServiceAccount `ate-client` in `ate-system`. When you pass no token, the plugin asks Kubernetes for a token of that ServiceAccount and sends it to `ate-api-server` {{code}}.

The warning is correct, and you must not ignore it on a shared cluster. Every person and every script that can port-forward into `ate-system` is the same caller to Substrate. An access policy cannot tell them apart, because it sees one name.

On a kind cluster on your own machine, the shared identity is fine. On a cluster with more than one team, give each caller a token and pass it with `--token-file`. [Section 5.1](#s-client-authentication) shows which token to use, and [section 5.2](#s-access-policies) limits what a caller can do in an atespace.

Our scripts removed the line from their output with `grep -v '^Warning: no --token-file'`. Do that in a script that parses a table. Do not do it for people.

## The commands of the first day

An actor is addressed by its atespace and its name, so most commands need `-a` with an atespace. No default atespace exists {{docs}}.

| Command | What it does |
|---|---|
| `kubectl ate get actors -a ate-demo-counter` | lists the actors of one atespace |
| `kubectl ate get actors -A` | lists the actors of all atespaces |
| `kubectl ate get actor my-counter-1 -a ate-demo-counter -o yaml` | prints one actor with its snapshots |
| `kubectl ate create actor my-counter-1 -a ate-demo-counter --template counter` | creates an actor from a template |
| `kubectl ate suspend actor my-counter-1 -a ate-demo-counter` | writes a snapshot and frees the worker |
| `kubectl ate resume actor my-counter-1 -a ate-demo-counter` | restores the actor onto a worker |
| `kubectl ate revert actor my-counter-1 -a ate-demo-counter` | returns a crashed actor to its last durable snapshot |
| `kubectl ate logs actor my-counter-1 -a ate-demo-counter` | prints the logs of the actor on its worker |
| `kubectl ate get workers` | lists the workers with their used CPU and memory |
| `kubectl ate proxy actor my-counter-1 -a ate-demo-counter` | forwards a local port to the actor |

`-o json` and `-o yaml` print the full object. Use them when you debug, because the table hides the snapshots. This is the new actor as JSON:

```listing
title: the status of a new actor
source: capture/lab/B-lifecycle/00-actor-before.json
lang: json
note: Cut from the actor object. The metadata and the sandbox version attributes are cut.
---
  "status": {
    "lastAssignedGeneration": 1,
    "snapshots": [
      {
…
        "durableSnapshot": {
…
          "state": "SNAPSHOT_STORAGE_STATE_COMPLETED"
        },
        "fidelity": "SNAPSHOT_FIDELITY_MEMORY",
        "generation": 1,
        "owner": "SNAPSHOT_OWNER_TAG",
…
    "state": "ACTOR_STATE_SUSPENDED"
```

The actor has never run, and it already has one snapshot. The owner is a tag, and the tag belongs to the template. [Section 3.1](#s-actortemplate-and-the-golden-snapshot) explains that snapshot. [The command reference](#s-ref-kubectl-ate) lists every command and flag.

## Three mistakes we made

**`-A` on workers.** A worker belongs to a Kubernetes namespace and not to an atespace. The flag that works for actors fails for workers:

```listing
title: -A is not a flag of get worker
source: capture/lab/A-quickstart/60-state.log
lang: text
note: The rest of the usage text is cut.
---
Error: unknown flag "-A"
…
  -a, --atespace string        filter worker pods hosting actors in a specific atespace
…
  -n, --namespace string       scope output to a specific Kubernetes namespace
```

Run `kubectl ate get workers` with no flag to see all workers.

**`kubectl get` for an actor.** `kubectl get actor` and `kubectl get actortemplate` return nothing, because those objects are not custom resources. `kubectl get workerpool` does work, because a WorkerPool is one {{docs}}.

**A flag from an old guide.** Guides for v0.x create an actor with `--template-ref`. At v1.0.0 the flag is `--template` {{code}}. [Section 8.4](#s-upgrade-and-stale-advice) lists the other changes.

```takeaways
- Install the kubectl-ate release binary and check its checksum, or build it from the tag.
- Use kubectl ate for actors, templates, and workers, and plain kubectl for WorkerPools.
- Pass -a with an atespace on every actor command.
- Pass --token-file on any cluster that more than one person uses.
- Use -o yaml when you debug an actor, because the table hides its snapshots.
```

Sources: capture/lab/A-quickstart/50-create-actor.log, capture/lab/A-quickstart/60-state.log, capture/lab/A-quickstart/02-steps.tsv, capture/lab/summary/install-steps.json, capture/lab/B-lifecycle/00-actor-before.json, capture/lab/E-dependency-loss/16-T3-cli-during.txt, capture/lab/_scripts/g6-switch-agw.sh, capture/lab/_scripts/m1-crossbuild.sh; docs/reference/kubectl-ate.md, docs/dev/releasing.md, docs/guides/authentication.md, cmd/kubectl-ate/internal/cmd, and internal/ateclient/builder.go at v1.0.0.
