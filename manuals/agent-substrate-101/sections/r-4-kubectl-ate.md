# kubectl ate commands

> The `kubectl ate` plugin at v1.0.0 has 11 verbs over seven resources, and most commands are one call to the Substrate API.

The plugin is the binary `kubectl-ate`. It finds `ate-api-server` through your kubeconfig and opens a port-forward for each command, unless you pass `--endpoint`. [Section 2.2](#s-kubectl-ate) shows how to install and use it. In our runs we built it from the checkout with `go install ./cmd/kubectl-ate`.

Three kinds of command do more or less than one call. `logs actor` also reads the logs of the worker pod through the Kubernetes API. `proxy actor` sends its traffic through `atenet-router` and not through `ate-api-server`. The `admin` commands write Kubernetes Secrets and call no Substrate API.

## Global flags

```listing
title: the help text of one command, with the global flags
source: capture/lab/A-quickstart/60-state.log
lang: text
note: The output of a wrong command in our first run, kubectl ate get worker -A. The CLI printed the error and then this help.
---
Error: unknown flag "-A"

Usage:
  kubectl-ate get worker [worker-name ...] [flags]

Aliases:
  worker, workers

Flags:
  -a, --atespace string        filter worker pods hosting actors in a specific atespace
  -h, --help                   help for worker
  -n, --namespace string       scope output to a specific Kubernetes namespace
      --sandbox-class string   filter by sandbox class (e.g. gvisor, microvm)
  -l, --selector string        filter by worker pool labels

Global Flags:
      --context string      kubeconfig context to use
      --endpoint string     manual override for the gRPC target (e.g., localhost:8080); if omitted, automatically port-forwards
      --kubeconfig string   path to the kubeconfig file
  -o, --output string       output format: table, json, or yaml (default "table")
      --preview             allow the use of preview features enabled on the server
      --token-file string   path to a bearer token for ate-api authentication, or - for stdin (defaults to a Kubernetes ServiceAccount token)
      --trace               enable tracing for the request
  -v, --verbose count       output verbosity; may be repeated (e.g. -v, -vv, -vvvvv)
```

| Flag | Use it when |
|---|---|
| `--context` | the machine has more than one cluster. A wrong context sends the command to a cluster with no Substrate. |
| `--endpoint` | you keep one port-forward open and run many commands |
| `--token-file` | you act as your own identity. Without it the CLI uses a shared ServiceAccount and prints a warning, as [section 5.1](#s-client-authentication) explains. |
| `-o yaml` | you need the `uid`, the `version`, or the snapshots of an object |
| `--preview` | the server has a preview feature on and you want to use it |
| `--version` | you want the version of the plugin. It is a flag of the root command only, so the help text of a subcommand above does not list it. It has no `-v` short form, because `-v` means `--verbose`. |

## Actors

| Command | Flags | What it does |
|---|---|---|
| `get actor [name ...]` | `-a`, `-A` | Lists actors in one atespace or in all, or prints the named ones. |
| `create actor <name>` | `--template`, `-a`, `--tag` | Creates a suspended actor from a template or from a tag. `--template` takes `atespace/name` or a name. |
| `update actor <name>` | `-a`, `--template`, `--worker-selector` | Points the actor at another template, or changes its worker selector. |
| `suspend actor <name>` | `-a`, `--mode` | Suspends. `--mode` is `async` by default, or `sync`. |
| `resume actor <name>` | `-a` | Resumes without a request. |
| `revert actor <name>` | `-a` | Returns the actor to its durable snapshot. |
| `delete actor <name>` | `-a` | Deletes the actor in any state. |
| `logs actor <name>` | `-a`, `-f`, `-c`, `--source` | Prints logs. `--source` is `all`, `containers`, or `lifecycle`. `-c _sandbox` prints the sandbox runtime log. |
| `proxy actor <name> [[local:]remote ...]` | `-a`, `--address` | Opens a local port that forwards to the actor through the router. Listens on `127.0.0.1` by default. |

## Templates, tags, and atespaces

| Command | Flags | What it does |
|---|---|---|
| `get actor-template [name ...]` | `-a`, `-A` | Lists or prints templates. |
| `create actor-template -f <manifest>` | `-f` | Creates one template from a JSON or YAML file, or from standard input with `-`. |
| `delete actor-template <name>` | `-a` | Deletes the template and its golden snapshot. |
| `get tag [name ...]` | `-a`, `-A` | Lists or prints tags. |
| `create tag <name>` | `-a`, `--actor`, `--scope` | Tags the snapshot of a suspended actor. `--scope` is `atespace` or `published`. |
| `update tag <name>` | `-a`, `--scope` | Changes the scope. |
| `delete tag <name>` | `-a` | Deletes the tag and its snapshot. |
| `get atespace [name ...]` | none | Lists or prints atespaces. |
| `create atespace <name>` | none | Creates an atespace. |
| `delete atespace <name>` | none | Deletes an empty atespace. |

The CLI has no command that updates a template. To change one, create a template with a new name and point actors at it with `update actor --template`.

## Egress policies and access policies

| Command | Flags | What it does |
|---|---|---|
| `get egress-policy <actor>` | `-a` | Prints the policy of one actor. |
| `create egress-policy <actor> -f <manifest>` | `-a`, `-f` | Creates the policy. |
| `update egress-policy <actor> -f <manifest>` | `-a`, `-f` | Replaces the policy. The manifest must carry `metadata.uid` and `metadata.version`. |
| `delete egress-policy <actor>` | `-a`, `--uid`, `--version` | Deletes the policy, with optional preconditions. |
| `get access-policy` | `-a` or `--global` | Prints the access policy of an atespace, or the global one. |
| `create access-policy -f <manifest>` | `-a` or `--global`, `-f` | Creates it. |
| `update access-policy -f <manifest>` | `-a` or `--global`, `-f` | Replaces it. |
| `delete access-policy` | `-a`, `--uid`, `--version` | Deletes the policy of an atespace. The global policy has no delete. |

## Workers

| Command | Flags | What it does |
|---|---|---|
| `get worker [name ...]` | `-n`, `-a`, `-l`, `--sandbox-class` | Lists workers with state, actors, CPU, and memory against capacity. |
| `top worker` | `-n`, `-a`, `-l`, `--sandbox-class` | Prints the CPU and memory use of workers. |

Workers have no atespace. `get workers` lists the workers of all Kubernetes namespaces by default, and `get workers -A` fails with `unknown flag "-A"`. The `-n` and `-l` flags narrow the list, and `-a` keeps only the workers that host an actor of that atespace.

## Admin commands

These commands read and write Kubernetes Secrets directly. They take `--name` and `--secret-namespace`.

| Command | Flags | What it does |
|---|---|---|
| `admin make-ca-pool` | `--ca-id`, `--key-type`, `--validity` | Creates a pool with one CA. The key type is `ECDSAP256` by default, and the validity is 365 days. |
| `admin make-jwt-pool` | `--alg`, `--key-id` | Creates the pool that signs actor JWTs. The algorithm is `ES256` by default, or `RS256`. |
| `admin list-jwt-keys` | none | Lists the keys of a pool. |
| `admin add-jwt-key` | `--alg`, `--key-id` | Adds a key that verifies and does not yet sign. |
| `admin activate-jwt-key` | `--key-id` | Makes a key the signing key. |
| `admin remove-jwt-key` | `--key-id` | Removes a key. |

[Section 5.3](#s-actor-jwts) explains the tokens, and [section 8.5](#s-limits-at-v1-0-0) notes that the rotation is manual.

## Commands that older text names and v1.0.0 does not have

`kubectl ate pause actor` and the flag `--template-ref` do not exist at v1.0.0. [Section 8.4](#s-upgrade-and-stale-advice) lists the replacements.

Sources: cmd/kubectl-ate/internal/cmd/root.go, verbs.go, actor.go, revert_actor.go, proxy.go, actortemplate.go, tag.go, atespace.go, egress_policy.go, access_policy.go, worker.go and admin.go, and docs/reference/kubectl-ate.md at v1.0.0; capture/lab/A-quickstart/60-state.log (the captured help text), capture/lab/B-lifecycle/20-trace-ops.tsv (suspend, resume, revert as run).
