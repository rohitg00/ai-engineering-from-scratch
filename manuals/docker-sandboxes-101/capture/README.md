# Docker Sandboxes and Docker Agent 101 capture kit

Every listing in the manual is cut from a file in `out/`. This kit drives the real `sbx`, `docker-agent`, and `docker` binaries on the host that runs it, records what they print, and masks the values that change from one run to the next. It uses the Python standard library only.

```bash
python3 run.py                  # writes out/; replays the model cassettes in cassettes/
python3 run.py --re-record      # the same, but records every cassette anew with Docker Model Runner
python3 run.py --check          # captures again into a temporary directory and compares with out/
python3 run.py --tier a         # only the steps that need no daemon, no network, and no model
python3 run.py --tier ab        # without the model tier
python3 run.py --only K09,K10   # a subset of steps, for development; earlier steps must have left their sandboxes in place
```

This subject cannot be captured offline, which the manuals standard asks for. `sbx` starts real microVMs from images on Docker Hub and needs a Docker sign-in, and the agent runs need a model. The kit therefore has tiers, and `run.py --check` skips with exit 0 when the host cannot run them, so the repository CI (which has none of the binaries) stays green. A host with `docker-agent`, `sbx`, and `docker` but without Docker Model Runner or without `ai/qwen3` runs tiers A and B and prints `tier m skipped`.

## Tiers

| Tier | Needs | In this kit version |
|---|---|---|
| A | `docker-agent`, `sbx`, and the `docker` client installed; no daemon, no network, no model, no keys | K00 versions, K01 root help, K16 `docker-agent version`, `doctor`, `toolsets`, `models list`, `sandbox list`, `run --dry-run`, K29 the legacy commands of Desktop 4.94 (`docker sandbox`, `docker agent version`, the plugin list) |
| B | `sbx` v0.47.0 signed in, the sandboxd daemon, image pulls from Docker Hub, outbound HTTPS to `example.com` and `mcp.deepwiki.com` | the sandbox lifecycle, ports, cp, policy, secrets with a host receiver, MCP, kits v2 and v3, `env plan`, skills, templates, `--clone`, prune, and `docker-agent share pull` |
| M | Docker Desktop 4.94.0 with Docker Model Runner on TCP 12434 and `ai/qwen3:4b` pulled, the `docker` daemon for containers, Compose, buildx, and a local registry | K17 to K28: `docker-agent new`, one agent run, a team, permissions and hooks, sessions, eval, the five servers, share push and pull, DMR, Compose, `run --sandbox`, the v3 kit build; K98 removes what the tier created |
| C | money (Cloud Sandboxes), a GitHub token, a change to `~/.ssh/config` | not implemented; `--tier abcm` prints a note and runs A, B, and M. Steps slot into `STEPS` in `run.py` with the tier letter `c` |

Tier A runs `docker-agent doctor`, `models list`, and `run --dry-run` with `DOCKER_CONTEXT=m101-no-daemon`, a Docker context that does not exist, so those files show the no-Model-Runner path on every host, with or without Docker Desktop (`16-doctor.txt`, `16-dry-run.txt`). K25 records the same `doctor` with Model Runner reachable (`25-doctor.txt`).

## The model tier and the cassettes

Every agent run of tier M uses `dmr/ai/qwen3:4b` through Docker Model Runner on the host. `docker-agent doctor` picks `dmr/ai/qwen3:latest` (the 8B build) for `auto`; on the recording host two pulls of that tag ended in a digest mismatch after the last 5.03 GB blob (`25-model-pull-latest.txt`), so the kit names the documented 4B tag of the same repository in every agent file and in `--judge-model`. No hosted provider and no API key is involved.

`docker-agent run --record=cassettes/NAME` writes the HTTP exchanges with the model into a YAML file (a go-vcr v2 cassette: the requests `docker-agent` sent and the streamed replies it received), and `--fake cassettes/NAME` replays them through a local fake proxy, with no model at all. `serve api` takes the same two flags. Three things the help does not say, found by running: `--record` takes its value only in the `--record=PATH` form (a separate word is read as the agent reference); the path is relative to `--working-dir`, so the kit passes it absolute; and with the `dmr` provider the recording proxy answers 400 unless the run also carries `--models-gateway http://localhost:12434/engines`, while an explicit `providers.*.base_url` bypasses the recorder and leaves the cassette empty. The kit records a cassette when the file is missing or when `--re-record` is given (one recording run whose output is discarded), and every file in `out/` comes from a `--fake` replay, so a `--check` on any host compares like with like. The cassettes are committed as `cassettes/NAME.yaml.gz`, with the capture directory written as `$CAPTURE` and the home directory as `$HOME`. `run.py` unpacks them into `work/cassettes/` with the paths of the host that runs it, because the replay matches each request by its body and some bodies carry the working directory, and it packs a cassette again after `--re-record`. They hold prompts, tool definitions, and model text, no credentials: the model runs on localhost without a key, and the requests carry none. `ai/qwen3:4b` is a thinking model, so a run streams a few thousand reasoning tokens before each answer; `--exec` prints them and the kit cuts them (`[... N lines of model reasoning cut ...]`), the `--json` files drop the `agent_choice_reasoning` events and join the `agent_choice` tokens, and the `*-transcript.txt` files list the user message, tool calls, tool results, and answers in order.

Steps that have no `--fake` are compared as they come from the model, with `temperature: 0`: `eval` (`22-*`), `serve chat`, `serve mcp --http`, `serve a2a` (`23-chat.http`, `23-mcp.http`, `23-a2a.http`), the run with an explicit `base_url` (`25-run-dmr.txt`), and `run --sandbox` (`27-*`, the model is called from inside the VM). Their agent files ask for a fixed answer, and the numbers that vary (tokens, costs, durations, ids) are scrubbed. `docker-agent new` opens `/dev/tty` even when a description is given, so the kit runs it without a controlling terminal and `17-new.txt` records that refusal.

The replay proxy matches each request by its body. When one turn issues two tool calls, the runtime executes them in parallel and appends their results in completion order, so the next request body differs from run to run and the replay answers 500 ("requested interaction not found"). The 4B thinking model batches calls whenever a message asks for two things, and neither `parallel_tool_calls: false` nor an instruction to call one tool at a time changes that (llama.cpp ignores the flag). The kit therefore gives every agent run several messages, one tool call each (`docker-agent run … "first" "second"`, turns in the help's sense), which keeps the recorded exchanges and the replay identical.

A recording turn with a tool call takes one to three minutes on the 4B thinking model (M-series laptop), a replay a few seconds. `--re-record` of every cassette is about half an hour.

## Prerequisites for a full run

- macOS on Apple silicon with Hypervisor.framework (`sysctl kern.hv_support` is 1).
- `sbx` v0.47.0 from the Homebrew cask, signed in (`sbx login` done by you, never by the kit), daemon healthy. The kit starts the daemon once if `sbx daemon status` fails.
- `docker-agent` v1.149.0 from Homebrew, on `PATH` ahead of the Desktop plugin (`docker agent` is the bundled v1.144.0 and is used only by K29).
- Docker Desktop 4.94.0 running (Engine 29.8.2, buildx v0.37.2, Compose v5.5.1, `docker model` v1.2.6), Docker Model Runner enabled with host TCP on port 12434 (`docker model status` says running, `curl http://localhost:12434/engines/v1/models` answers), and `docker model pull ai/qwen3:4b` done by you (about 2.5 GB). The kit never pulls the model itself; any `docker-agent` command that loads a DMR agent file pulls a missing model on its own, so the kit refuses to start tier M until `docker model ls` lists `ai/qwen3:4b`.
- Python 3.12 or later, git, curl.
- Disk: about 1.3 GiB for `docker/sandbox-templates:shell-docker` and one saved template (tier B); the tier M images `registry:2`, `alpine:3.22`, `docker/mcp-gateway`, `docker/docker-agent:1.149.0`, `docker/sandbox-templates:shell` (521 MB compressed), `docker/sandbox-kit:3`, `moby/buildkit:buildx-stable-1`, and the sandbox template `docker/docker-agent-sbx-templates:latest`.
- Ports free on the host: 18080 (secret receiver), 18081 (published sandbox port), 8080, 8081, 8082, 8083 (`serve api`, `mcp`, `a2a`, `chat`), 15000 (the local registry; port 5000 is taken by the AirPlay Receiver on macOS, so the kit binds `127.0.0.1:15000`).
- The global network policy either uninitialized or already `balanced`. The run that finds it uninitialized runs `sbx policy init balanced` once and records `03-policy-init.txt`. The kit never runs `sbx reset`, `sbx policy reset`, `sbx setup ssh`, `sbx login`, `sbx logout`, or anything with `--cloud`, and never changes a global policy rule or an `sbx settings` key.

A full run of the three tiers takes about 17 minutes on an M-series laptop with the cassettes replayed and the images already present (about eight of them for tier B, the rest for the live model steps: eval, the five servers, the sandbox run, the kit build); the first pulls and `--re-record` come on top.

## What the kit creates and removes

Everything is named `m101-*`: sandboxes `m101-demo`, `m101-demo-2`, `m101-secret`, `m101-mcp`, `m101-mcp-dyn`, `m101-kit`, `m101-from-tpl`, `m101-clone`, `m101-v3`; the template `m101-tpl:v1`; the MCP registration `m101-deepwiki`; custom secrets whose variables start with `M101_`; the container `m101-registry` on the network `m101-net`; the buildx builder `m101-builder`; the Compose project `m101`; the images `localhost:15000/m101/hello-kit:*` and `localhost:15000/docker/sandbox-templates:shell`; the sandbox that `docker-agent run --sandbox` creates for `fixtures/repo`. The run starts with a sweep that removes leftovers of an earlier attempt and ends with `sbx rm`, `sbx template rm`, `sbx mcp rm`, `sbx secret rm`, `docker rm`, `docker network rm`, `docker buildx rm`, `docker image rm`, and `docker model unload --all` for all of them (`98-model-final-state.txt`, `99-final-state.txt`). Sandbox-scoped policy rules go away with their sandbox. The initialized global policy and the pulled images stay.

`docker-agent` keeps its state under `work/`: `--config-dir work/cfg`, `--data-dir work/data` (with `session.db`), `--cache-dir work/cache` (the models.dev catalogue and the staged sandbox kit) are passed to every command of the model tier, so nothing under `~/.cagent` or `~/.config/cagent` is read or written. The command lines in `out/` leave those three flags out.

The only secret values the kit stores are the dummies `m101-dummy-receiver-0000` (a custom secret, removed at the end) and `m101-chat-key` (the `--api-key` of `serve chat`, alive while that server runs). No real token, key, or password is read or written.

## Fixtures

| Path | Used by |
|---|---|
| `fixtures/repo/` | generated on every run: a git repository with two commits at fixed dates, so the hashes are the same on every host; also the working directory of the agent runs |
| `fixtures/repo-clone/`, `fixtures/repo-kit/`, `fixtures/repo-sandbox/` | fresh copies of `repo/` for the `--clone`, `--kit`, and v3 kit sandboxes, and for `docker-agent run --sandbox`, which requires `--data-dir` inside the mounted workspace (`repo-sandbox/.m101-data`) |
| `fixtures/kits/hello-mixin/` | a v2 mixin (`spec.yaml`, `files/workspace/HELLO.md`) that installs `tree` and allows `example.com` |
| `fixtures/kits/env-mixin/` | a v2 mixin with one variable and one allowed host, the shape `sbx kit add` accepts |
| `fixtures/kits/hello-kit/kit.yaml`, `HELLO.md` | a v3 workload descriptor with `# syntax=docker/sandbox-kit:3`, an inline `build:` block on `docker/sandbox-templates:shell`, and one `com.docker.sandbox/network-policy@2` capability; the v2 tooling refuses it (`13-*`), buildx builds and pushes it (`28-*`) |
| `fixtures/env/sbxenv.yaml` | the environment file for `sbx env plan` |
| `fixtures/agents/greeter.yaml` | the agent file for `docker-agent run --dry-run` |
| `fixtures/agents/files.yaml` | one agent with `filesystem` and `shell` on `dmr/ai/qwen3:4b`, `temperature: 0` (K18, K21, K22, K24) |
| `fixtures/agents/files-sandbox.yaml` | the same agent with a `providers:` block whose `base_url` is `http://host.docker.internal:12434/engines/llama.cpp/v1`, for the run inside the sandbox (K27) |
| `fixtures/agents/team.yaml` | `root` with `sub_agents: [writer]`, `handoffs: [reviewer]`, and the `background_agents` toolset (K19) |
| `fixtures/agents/guarded.yaml` | `shell` with `permissions.allow`/`deny` patterns and a `pre_tool_use` command hook with `preempt_yolo: true` (K20) |
| `fixtures/agents/dmr.yaml` | an explicit `providers:` block for Docker Model Runner with `base_url: http://localhost:12434/engines/llama.cpp/v1` (K25); its run is live on every capture, because an explicit `base_url` bypasses the `--record` proxy |
| `fixtures/agents/pong.yaml` | an agent that answers `pong`, served five ways (K23) |
| `fixtures/hooks/log-hook.sh` | the hook: appends its stdin JSON to `$M101_HOOK_LOG` and prints an `allow` decision |
| `fixtures/evals/*.json`, `fixtures/evals/working_dirs/repo/` | two eval sessions in the documented format (one `shell` call, one `list_directory` call, a relevance statement, a size) and the working directory they mount |
| `fixtures/compose/compose.yaml` | a top-level `models:` element, a `docker/mcp-gateway` service with `use_api_socket: true`, and a `printer` service that prints its injected `LLM_URL` and `LLM_MODEL` |
| `fixtures/mcp-probe.sh` | runs inside a sandbox: `initialize`, `notifications/initialized`, `tools/list` against `$MCP_GATEWAY_URL` with the `Mcp-Session-Id` header |
| `cassettes/*.yaml` | the recorded model exchanges, replayed by `--fake`: `18-files`, `19-team`, `19-background`, `20-strict`, `20-restricted`, `23-api`, about 16 MB together because every streamed reasoning token of the thinking model is in them |

The generated directories are listed in `.gitignore`. `work/` holds the template tar, the kit zip, the pulled agent files, the `docker-agent` state directories, the server logs, the eval results, and `buildkitd.toml`, and is recreated on every run.

## Masks

Files are masked when they are written, so `out/` holds no username, no ids, and no timestamps, and `--check` compares byte for byte. The rules are the `MASKS` table, the per-line rules in `mask_text`, and the JSON key set `SCRUB_KEYS` in `run.py`:

| Pattern | Token |
|---|---|
| the absolute path of this directory | `$CAPTURE` |
| the home directory, then the user name | `$HOME`, `$USER` |
| the Docker Hub user shown by `sbx mcp ls` | `<docker-user>` |
| the per-run suffix of `m101-policy-<6hex>` and `m101-secret-<6hex>` (fresh names, because the daemon keeps `sbx policy log` per sandbox name across `sbx rm`) | `m101-policy`, `m101-secret` |
| UUIDs (sandbox ids, policy and rule ids, `SANDBOX_ID`, session ids) | `<uuid>` |
| 12-hex image and layer ids, `kit-<hash>`, swap container names | `<id>`, `-swap-<id>` |
| 64-hex digests and container ids | `sha256:<digest>`, `<sha256>` |
| RFC 3339 timestamps, `YYYY/MM/DD hh:mm:ss` log stamps, the policy log `LAST SEEN` column, HTTP `Date` headers | `<ts>`, `<http-date>` |
| ephemeral host ports 49152 to 65535 after `127.0.0.1:`, `[::1]:`, `::1:`, or `"host_port":` | `<port>` |
| `Mcp-Session-Id` values and SSE event ids | `<session>`, `<event-id>` |
| custom secret placeholders `sbx-cs-…` and `sk-…` | `sbx-cs-<rand>`, `sk-<rand>` |
| `PROXY_CA_CERT_B64` | `<base64>` |
| kit install durations, diagnostics byte counts, free disk space, request counts, image sizes, `ls -la` dates, `df` columns, "N days ago" | `<dur>`, `<n>`, `<date>`, `<age>`, `<size>` and friends |
| the pull progress block of `sbx create` (downloaded on the first run, already present after) | `<layers>` |
| tool call ids (`call_…` in text, 20-plus character ids under `tool_call_id` and `id` in JSON), chat completion ids, the kit hash under `sandbox-kits/`, the eval run name | `call_<id>`, `<call-id>`, `chatcmpl-<id>`, `sandbox-kits/<hash>`, `<run>` |
| the bearer token `docker/mcp-gateway` prints, gateway timings, ANSI escapes and repeated progress rows in Compose output | `Bearer <token>`, `<dur>`, dropped |
| buildx step durations and the `View build details` link | `DONE <dur>`, `<url>` |
| Compose progress durations after `Container`, `Network`, `Volume`, `Image` rows | `<dur>` |
| JSON numbers under token, cost, timestamp, duration, and sequence keys (`SCRUB_KEYS`) | `"<n>"` |

The `sbx policy log` captures are filtered and sorted before they are written. The daemon keeps that log per sandbox name and keeps it across `sbx rm`, so a second run on the same machine sees rows left by the first one, and it orders rows by time. The kit keeps only the rows for the hosts it contacted itself (`example.com:443`, the receiver on `localhost:18080` and `gateway.docker.internal:18080`, and the two hosts the template reaches at every start, `ports.ubuntu.com:80` and `download.docker.com:443`), sorted by host. The sets are `DEMO_HOSTS` and `SECRET_HOSTS` in `run.py`.

The buildx logs (`28-buildx*.txt`) drop the layer transfer lines and keep every step once. `28-manifest.json` decodes the `vnd.docker.sandbox.kit.descriptor` annotation and cuts its derived `provides` list to five entries.

`03-policy-init.txt` is written only by the run that initializes the global policy and is not compared by `--check`. On the recording host the policy was initialized by hand with the same command, `sbx policy init balanced`, a few hours before the kit's first run, so the file in `out/` holds that command's output as it was printed then, in the kit's own format. `25-model-pull-latest.txt` is the Model Runner log of the failed 8B pulls, written once and not compared.

## Recorded with

- sbx v0.47.0 (revision 0411f50ee4700fe7bd37e6e7e3aced563e850ca9, API 0.38.0), template `docker/sandbox-templates:shell-docker` image id 1560168ac5fb (Ubuntu 26.04.1, kernel 7.0.14, Docker Engine 29.8.1)
- docker-agent v1.149.0 (Homebrew); the Desktop plugin `docker agent` v1.144.0 beside it
- Docker Desktop 4.94.0: client 29.2.1, Engine 29.8.2, buildx v0.37.2, Compose v5.5.1, mcp v0.44.1, model v1.2.6 with llama.cpp b9879-metal; the kit frontend `docker/sandbox-kit:3` resolved to sandbox-kit 3.0.0-m.8
- the model `ai/qwen3:4b` on Docker Model Runner at `localhost:12434`; `ai/qwen3:latest` (8B, 5.03 GB) could not be pulled on the recording host
- macOS 26.2 (25C56) on arm64, Python 3.14

The exact lines are the top of `out/README.md`, which `run.py` writes from `sbx version`, `docker-agent version`, `docker --version`, and `docker model ls` on every run.

## What the recorded run showed that the docs or the plan did not say

- A sandbox with no attached session stops on its own 30 seconds after the last session ends (`04-auto-stop.txt`, daemon log: "auto-stop grace period expired"). `sbx exec`, `sbx cp`, and `sbx ports --publish` start it again. The kit runs `sbx exec NAME true` before each recorded command so the "started successfully" line does not appear at random.
- `sbx policy deny` on a host that already has an `allow` rule in the same scope is refused as a conflict (`09-deny-conflict.txt`). The help text says deny takes precedence; the daemon does not store the pair.
- `sbx template save` refuses a running sandbox outside a terminal and asks for `sbx stop` first (`07-template-save.txt`). `sbx template inspect` is cloud-only in this version (`07-template-inspect.txt`).
- `sbx kit validate` and `sbx kit pack` refuse a v3 source kit; `sbx kit inspect` builds it through the Docker daemon with its own builder kit, and on Desktop 4.94.0 with the default overlay2 image store that build fails with "OCI exporter is not supported for the docker driver" (`13-kit-v3-inspect.txt`, `28-kit-inspect-source.txt`). The `sbx kit` artifact commands are v1 and v2 tooling.
- `docker buildx build -f kit.yaml --push` with the default `docker` driver pushes a Docker schema 2 manifest and drops every annotation, so the registry holds no `vnd.docker.sandbox.kit.*` keys (`28-buildx-docker-driver.txt`, `28-manifest-docker-driver.json`). A `docker-container` builder pushes an OCI index whose platform manifest carries the four kit annotations and the derived `org.opencontainers.image.*` keys (`28-buildx.txt`, `28-manifest.json`); the index itself carries none, although the spec says they are promoted onto it when an attestation manifest is present (`28-index.json`). The builder container cannot see the daemon's images, so the kit publishes the base image to the local registry and declares it as a `docker.io` mirror in `work/buildkitd.toml` (`28-builder.txt`).
- `sbx` refuses the pushed kit with its `kit.allowedSources` default `docker.io/`, for `kit inspect` and for `create` alike (`28-kit-inspect.txt`, `28-run-kit.txt`). The kit does not change that setting.
- `sbx kit add` refuses a mixin that declares static files and accepts one limited to variables, install commands, and network allows (`12-kit-add-files.txt`, `12-kit-add.txt`).
- The help's own registry example `https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest` answers 404 (`11-mcp-add-registry.txt`).
- A custom secret reaches sandboxes created after it; an existing sandbox does not get the variable, as the command's own note says (`10-env-existing.txt`, `10-env-sentinel.txt`). The proxy swaps the placeholder in any header, with or without `Bearer`, for a request to a bound host (`10-receiver.log`).
- Inside the sandbox the proxy is `gateway.docker.internal:3128`, the MCP gateway is `MCP_GATEWAY_URL=http://mcp-gateway.docker.internal/mcp`, and `host.docker.internal` reaches the host through a rule such as `localhost:18080` (`04-env.txt`, `04-guest.txt`, `10-*`).
- With `--exec` and `--safety strict`, a call that no pattern decides raises `tool_call_confirmation` and, with no terminal to answer it, the tool result reads "The user rejected the tool call"; with `--safety restricted` the same call is "denied by permissions configuration", the `allow` pattern still runs `echo`, and the `deny` pattern still blocks `rm` in both modes (`20-strict.txt`, `20-restricted.txt`). Asked for the three commands in one message, the model issued the three shell calls in parallel, a `pre_tool_use` hook ran three times at once, and two of them appended to the log file at the same moment (`fixtures/hooks/log-hook.sh` writes each record with one `printf`; `20-hook-stdin.jsonl` is sorted); the kit asks for one command per message.
- Asked in one message, the 4B thinking model answers a `transfer_task` and a `handoff` in the same turn; the kit asks in two messages (`19-transcript.txt`). A background-agent run (`run_background_agent`) under the default safety of `--exec` raises a confirmation, is rejected without a terminal, and the model repeats the identical call until the runtime stops it after five ("detected 5 consecutive identical calls", `19-background.txt`).
- Compose 5.5.1 on Desktop injects `LLM_URL=http://model-runner.docker.internal/v1/` and `LLM_MODEL=ai/qwen3:4b` into the service, the `/v1/` root rather than the `/engines/v1/` path the Compose docs show, and `GET ${LLM_URL}models` answers from inside the container (`26-compose-up.txt`). The `docker/mcp-gateway` service starts with no servers, prints a random bearer token, and answers 401 to a bare request.
- `docker-agent run --sandbox` refuses `--data-dir`, `--cache-dir`, and `--config-dir` outside the mounted workspace ("must be inside the sandbox's writable workspace", `27-data-dir-outside.txt`), so a kit that keeps `~/.cagent` untouched has to put them under the workspace. The launch then prints the models gateway, the `models.dev` allowlist, the `docker agent sandbox allow` hosts, the mounts (workspace rw, the agent file's directory ro, the staged kit ro, the config dir ro), the image, and the VM size, and creates `docker-agent-<hash>` (`27-sandbox-run.txt`, `27-sbx-ls.txt`, `27-kit-cache.txt`). Inside the VM the run then dies before any model call: SQLite cannot create the session store on the virtiofs workspace mount ("attempt to write a readonly database (1032)"), which a plain `python3 -c 'sqlite3.connect(...)'` that inserts a row on the same mount reproduces (`27-sqlite-probe.txt`). The VM is left running, as the docs say, and the kit uses it for the end-to-end evidence: `sbx exec <sandbox> docker-agent --data-dir /tmp/m101 … run --exec --last` with the agent file whose `base_url` is `http://host.docker.internal:12434/engines/llama.cpp/v1` answers the task from inside the VM, so the model on the host is reached through the sandbox proxy under the `localhost:12434` rule that `docker agent sandbox allow` added (`27-inside-run.txt`). The kit then removes the sandbox.
- The template `docker/docker-agent-sbx-templates:latest` ships `docker-agent version main` (commit 154b78f2), not the v1.149.0 release, and every start tries a self-update that fails on the non-release version string (`27-inside.txt`). The in-VM `docker agent sandbox list` is empty: the persistent allowlist lives on the host side and arrives as proxy rules, not as a file.
- Desktop 4.94.0 still lists a `sandbox v0.13.0` CLI plugin, and `docker sandbox` prints the removal notice and exits 1 (`29-docker-plugins.txt`, `29-docker-sandbox.txt`).
- `--record NAME` and `--fake NAME` append `.yaml` to the path they are given; `--fake` fails with "requested cassette not found: NAME.yaml" otherwise.
- Any `docker-agent` command that loads an agent file on a DMR model that is not pulled yet starts `docker model pull` on its own, `debug toolsets` and `run --dry-run` included. On the recording host two `docker model pull ai/qwen3` runs (the 8B `latest` tag `doctor` picks for `auto`) ended after the last 5.03 GB blob with a digest mismatch and a different observed hash each time; the Model Runner log of those pulls is `25-model-pull-latest.txt`, and the kit records with `ai/qwen3:4b`.
- `docker-agent share push` to a plain HTTP `localhost:PORT` registry works without any insecure-registry setting; the manifest carries `io.docker.agent.version`, `io.docker.cagent.version`, and an `artifactType` of `application/vnd.docker.agent.config.v1+json` (`24-manifest.json`).
- `serve a2a` publishes the card at `/.well-known/agent-card.json` only (`/.well-known/agent.json` answers 404); the card names its JSON-RPC endpoint `http://127.0.0.1:8082/invoke` with `protocolVersion` 1.0, and a POST to `/` answers 404. `SendMessage` with the A2A 1.0 names returns a `task` in `TASK_STATE_COMPLETED` whose artifacts carry the answer, with `adk_*` metadata (the server is built on the ADK A2A library), and `GetTask` returns it again with the history (`23-a2a.http`). `serve mcp --http` answers on `/mcp` and on `/` with SSE-framed JSON-RPC, reports `protocolVersion` 2025-11-25, exposes one tool whose only argument is `message`, and `tools/call` returns `structuredContent: {"response": …}` (`23-mcp.http`). `serve chat` lists the agent name `root` as the model id, not the file name, and answers 401 without the bearer token (`23-chat.http`). `serve api` needs the body `{"messages": [{"role": "user", "content": …}]}` as the docs say; the SSE stream carries the same event types as `run --json`, reasoning tokens included (`23-api-run.sse`). `serve acp` answers `initialize` with `agentCapabilities` and `session/new` with a `session/update` notification (the slash commands) before the result (`23-acp.jsonl`).
- `docker-agent eval` with an agent on `dmr/…` fails inside its containers, because the container image has no `docker` CLI to ask Model Runner for its endpoint ("exec: docker: executable file not found in $PATH", `22-eval.txt`); `--models-gateway http://model-runner.docker.internal/engines` moves the judge to that address too, which the host cannot reach (403, `22-eval-gateway.txt`). `-e DOCKER_AGENT_MODELS_GATEWAY=http://model-runner.docker.internal/engines` sets the gateway inside the containers only, the judge stays on the host's `localhost:12434`, and both evals run: sizes and relevance pass, the tool-call F1 of the listing case is 0.67 because the model adds a second call (`22-eval-container-env.txt`, `22-eval-run-container-env.json`). The two evals plus the judge take about five and a half minutes on the 4B model.
