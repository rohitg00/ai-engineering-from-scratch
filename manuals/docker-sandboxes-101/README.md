# Docker Sandboxes and Docker Agent 101

Docker Sandboxes at `sbx` v0.47.0 and Docker Agent at `docker-agent` v1.149.0, from the first sandbox to an agent that you serve and share. The web edition is at [aiengineeringfromscratch.com/manual-docker-sandboxes-101.html](https://aiengineeringfromscratch.com/manual-docker-sandboxes-101.html), and each release of the course attaches the PDF as `aiefs-manual-docker-sandboxes-101.pdf`.

## What is in it

- 33 sections in 7 parts, then eight reference sections. Parts 1 to 4 cover both products on one page, the sandbox and its daemon, the isolation layers, and kits with environment files. Parts 5 to 7 cover the agent file and its run, the served and shared agent, and operation.
- 34 figures and a cover plate, drawn with the figure kit from the capture files. They animate on the web and show the final frame in print.
- A capture kit in `capture/`, in Python with the standard library only. It runs the real `sbx`, `docker-agent`, and `docker` binaries and writes what they print to `capture/out/`.
- 111 listings. 94 come from `capture/out/`, 11 from `capture/fixtures/`, one from `capture/run.py`, and five from the vendored sources.
- A register of 122 conflicts between the help text, the docs, the repositories, the release notes, the blog posts, the talks, and community threads. Each conflict has the ruling that the manual prints. The register also lists 30 pieces of stale advice, and the migration section prints each one with its current form.
- A ledger of 22 claims from Docker pages and the community, each with a verdict and the capture file behind it.
- 21 behaviors that the recorded run showed and the docs did not say, listed in `capture/README.md`.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/` | the kit, its fixtures and model cassettes, and its recorded output in `capture/out/` |
| `research/sources/` | the vendored help text, agent file schema, kit spec, docs pages, and release notes, with their licenses |
| `research/*.md` | the plan, the capture plan, and the conflicts register that the sections cite |

## The recording host

The kit was recorded on one Mac with macOS 26.2 on Apple silicon, with these versions:

| Item | Version |
|---|---|
| `sbx` | v0.47.0, revision `0411f50e`, from the Homebrew cask |
| `docker-agent` | v1.149.0, from Homebrew, tag commit `bf4169c` |
| Docker Desktop | 4.94.0, with Engine 29.8.2, buildx v0.37.2, and Compose v5.5.1 |
| Docker Model Runner | `docker model` v1.2.6 on TCP port 12434, with the model `ai/qwen3:4b` |
| sandbox template | `docker/sandbox-templates:shell-docker`, Ubuntu 26.04.1 |
| Python | 3.14 |

The documented default model, `ai/qwen3:latest`, failed twice to pull on that Mac with a digest mismatch. Every agent file therefore names `ai/qwen3:4b`. The kit uses no hosted provider and no API key.

## The capture tiers

`sbx` starts real microVMs from images on Docker Hub, and the agent runs need a model. Thus the kit cannot run offline in CI. It records three tiers:

| Tier | What it needs | What it records |
|---|---|---|
| A | `sbx`, `docker-agent`, and the `docker` client, with no daemon, network, model, or key | versions, root help, `docker-agent doctor`, `toolsets`, `models list`, a dry run, and the legacy Desktop commands (files 00, 01, 16, 29) |
| B | `sbx` signed in, the sandboxd daemon, image pulls from Docker Hub, and HTTPS to `example.com` and `mcp.deepwiki.com` | the sandbox lifecycle, ports, `cp`, templates, `--clone`, policy, secrets, MCP, kits, `env plan`, and skills (files 02 to 15) |
| M | Docker Desktop 4.94.0 with Docker Model Runner on TCP port 12434 and `ai/qwen3:4b` pulled, plus containers, Compose, buildx, and a local registry | agent runs, teams, permissions, sessions, eval, five servers, `share`, Model Runner, Compose, `run --sandbox`, and the v3 kit build (files 17 to 28, 98) |

Tier C needs Cloud Sandboxes, a GitHub token, or a change to `~/.ssh/config`. The kit does not record it, and the sections that need it cite the docs.

Most runs of tier M replay a recorded cassette from `capture/cassettes/` with `--fake`. The eval, three of the servers, one run with an explicit `base_url`, and `run --sandbox` call the model live with `temperature: 0`.

## Run the kit

```bash
cd manuals/docker-sandboxes-101
python3 capture/run.py --check
```

The check captures again into a temporary directory. Then it compares each file with `capture/out/` after it masks the values that change on every run. If `sbx`, `docker-agent`, or `docker` is not installed, the check prints `skipped` with the reason and exits 0. If Docker Model Runner or `ai/qwen3:4b` is absent, the check runs tiers A and B and prints `tier m skipped`.

Run `python3 capture/run.py` to record the files again. Before a full run, sign in with `sbx login`, start Docker Desktop, and pull the model with `docker model pull ai/qwen3:4b`. The kit never signs in and never pulls the model. A full run of the three tiers takes about 17 minutes on an M-series laptop when the images are present.

The kit removes the sandboxes, templates, containers, and secrets that it creates. The global network policy and the pulled images stay. `capture/README.md` lists the prerequisites, the ports, the masks, and each fixture.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/docker-sandboxes-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual docker-sandboxes-101
```

On a host with the binaries, the audit runs the full capture check, which needs the sign-in and the model. Set `AIEFS_CAPTURE_SKIP=1` to skip that check. The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
