# kit-tck, sbx diagnose, and the claims this manual checked

> Every claim this manual repeats from Docker's pages or the community was checked against a capture or marked unverified, and this section is the ledger.

A vendor page says that credential values never enter the VM {{docs-sbx Security model}}. A Hacker News thread from 2026-08-10 says the proxy re-signs every certificate, and a podcast from 2026-09-26 says nobody audited the boundary. You want to know which of those three someone checked. When you finish this section, you can say which claims this manual verified, with which file, and which it only reports.

## The ledger

Each row names the claim and its source, the verdict, and the capture file behind the verdict. A verdict of confirmed means a recorded file shows the behaviour. Contradicted means a file shows the opposite. Disputed means two sources disagree and no capture settles it, and unverified means no capture was planned or recorded.

| Claim and where it is made | Verdict | Evidence |
|---|---|---|
| credential values never enter the VM (docs, Security model) | confirmed | `10-env-sentinel.txt` has `M101_RECV_KEY=sbx-cs-<rand>` and `ANTHROPIC_API_KEY=proxy-managed`, and `10-receiver.log` shows the host receiver got `Bearer m101-dummy-receiver-0000` |
| the secret is injected only for a bound host, and the whole header is replaced (HN 2026-08-10, C34) | confirmed, both sides | `10-swap-curl.txt`: 204 on `host.docker.internal:18080` and `000` on `gateway.docker.internal:18080`, while `10-receiver.log` shows the swap with and without `Bearer`, and in `X-Demo` |
| outbound TCP is blocked unless a rule allows it (docs, Default security posture) | confirmed | `09-blocked.txt`: 403, and `09-check-verbose.json`: `"deny_kind": "implicit"` |
| each sandbox has its own Docker Engine with no path to the host daemon (docs, Security model) | confirmed in part | `04-guest.txt`: Docker Engine 29.8.1 server inside, user `agent` in group `docker`, and no probe for a host path was run |
| `--clone` commits reach the host through `sandbox-<name>` (help, `sbx create`) | confirmed | `08-clone-host.txt`: `git fetch sandbox-m101-clone` brought `81e11df from sandbox`, and `08-clone-commit.txt`: a push to `/run/sandbox/source` is rejected |
| the guest uses 16 KiB pages on Apple silicon (blog 2026-05-26, C45) | confirmed | `04-guest.txt`: `getconf PAGESIZE` prints 16384 |
| the proxy is `gateway.docker.internal:3128` (issue #12, C26) | confirmed | `04-env.txt`: `HTTPS_PROXY=http://gateway.docker.internal:3128`, and `PROXY_CA_CERT_B64` set |
| HTTPS is intercepted and re-signed (issue #12, HN 2026-08-10) | not checked | `09-allowed.txt` shows the CONNECT tunnel and a `cloudflare` reply, and no certificate chain was read |
| one MCP gateway endpoint per sandbox (docs, Architecture) | confirmed | `11-static-inside.txt`: `MCP_GATEWAY_URL=http://mcp-gateway.docker.internal/mcp`, and `11-gateway-tools-static.json`: `ask_wiki_question` |
| 27 toolset types, and `transfer_task` is not one of them (schema, C56) | confirmed | `16-toolsets.txt`: 27 rows, neither implicit name |
| the `sbx kit` commands are v1 and v2 tooling (C13) | confirmed | `13-kit-v3-validate.txt`: "is a v3 source kit and this load path has no kit builder configured", and `12-validate.txt`: `VALID` |
| a kit signature verifies with `sbx kit sign` and `verify` (docs, Build and distribute kits) | not checked | no sign or verify step was recorded, only `13-kit-builder-status.txt` |
| a local model runs with no key (docs, Use local and hosted models) | confirmed | `25-doctor.txt`: every provider credential `not set`, Docker Model Runner reachable with `docker.io/ai/qwen3:4b`, and `25-run-dmr.txt` answers `Hello` live. `18-cassette-head.txt` shows the recorded requests going to `localhost:12434`, and `27-inside-run.txt` answers from inside the VM. The 8B `ai/qwen3:latest` failed to pull (`25-model-pull-latest.txt`) |
| local use needs a Docker sign-in (docs, FAQ, disputed in HN 2026-08-10 and issue #321, C15) | confirmed in part | `02-diagnose.txt` lists Authentication as a check, the kit's prerequisites include `sbx login`, and `help-sbx-cloud.md` notes a TLS attempt to login.docker.com on every `--help` |
| `sbx policy approval` is not a command (the v0.47.0 help tree, C16) | contradicted | `09-blocked.txt`: the 403 body says "Review and respond with: sbx policy approval ls" |
| the VMM is libkrun (talk 2026-01-14, HN 2026-08-10, C4) | unverified | `00-sbx-version.json` names no runtime, and `04-guest.txt` shows kernel `7.0.14` and nothing more |
| a sandbox starts in tens of milliseconds (talk 2026-02-10, C29) | not checked | the timing runs planned as K35 were not recorded |
| an allowed host can carry data out (HN 2026-08-10, talk 2026-04-07) | disputed | both sides are printed in [the proxy section](#s-sbx-policy-log-and-the-proxy), and no capture tested it |
| a microVM HTTP API, a Kubernetes runtime, Warp Oz (blog 2026-05-26, blog 2026-08-21, talk 2026-03-31) | unverified | no Docker page confirms any of them (C105, C106) |
| an independent audit of the boundary exists | none found | the podcast of 2026-09-26 says none exists, and the corpus has none (T24) |
| `sbx ls` hangs on macOS (#163), Windows start fails (#350) | not reproduced | `99-final-state.txt`: `sbx ls` answered at the end of the run |
| a sandbox stops itself after the last session ends (not in the docs) | observed | `04-auto-stop.txt`: "auto-stop grace period expired, stopping runtime" |

```figure
id: fig-7-4
kind: comparison
title: confirmed by a file, or only reported
claim: Eight claims were confirmed by a recorded file, four are reported without a test, and the captures contradict or the community disputes two more.
caption: Left, each confirmed claim with the capture file that shows it, coloured by the layer it belongs to. Right, dashed boxes are claims this manual reports without a test, and rose boxes are the two the captures contradict or the community disputes. From the files named in each box.
```

## sbx diagnose, the only self-check

**sbx diagnose:** the one command that checks an installation, in the four groups that `capture/out/02-diagnose.txt` shows: Installation, Platform, Storage, and Connection. It takes `--json`, `--output github-issue` for a report to paste into an issue, and `--upload` to send diagnostics to Docker support {{help-sbx sbx diagnose}}.

```listing
title: the platform and connection checks on the recording host
source: capture/out/02-diagnose.txt
lang: text
note: The Installation and Storage groups are cut. The byte counts and sizes are masked by the kit.
---
  Platform
  ✓ Virtualization — supported
      kern.hv_support is 1
  ✓ mkfs.erofs — found
      /opt/homebrew/Caskroom/sbx/0.47.0/Sbx.app/Contents/libexec/mkfs.erofs, default block size <n> bytes, guest kernel page size <n> bytes
…
  Connection
  ✓ Version match — v0.47.0
  ✓ Socket — responsive
  ✓ SSH client config — not configured
  ✓ Authentication — authenticated

─────────────────────────────────────────
  13 passed
```

All 13 checks passed, and the JSON form in `02-diagnose.json` carries the same rows with a `summary` of `pass`, `warn`, `fail`, and `skip` counts. The Platform group is where [the microVM boundary section](#s-sbx-diagnose-and-the-microvm-boundary) reads the hypervisor and the page size. `sbx --cloud diagnose` runs a different set, sign-in, the cloud API, and account access, and needs no daemon {{docs-sbx Use cloud sandboxes}}.

## kit-tck, not run in this edition

**kit-tck:** the conformance suite of the Sandbox Kit Specification v3, with two independent halves, one for a published kit artifact and one for a runtime. The conformance page of the specification repository describes both (research/sources/kit-spec-extras.md). `kit-tck validate <reference>` judges a published artifact against the publishing and OCI layout rules, and the BuildKit frontend runs the same checks before it exports. `kit-tck runtime --adapter <path>` drives an adapter, an executable with verbs such as `capabilities`, `create`, `exec`, `stop`, `start`, `recreate`, and `rm`.

The suite judges what the runtime does through those verbs. An adapter exits 2 when it refuses a request by policy, and any other non-zero code is a failure. A runtime that cannot provide a required capability must therefore refuse the kit.

```listing
title: the two suites and the artifact commands
source: research/sources/kit-spec-extras.md
lang: text
note: Four lines from the README of docker/sandbox-kit-spec. The task lines run from a checkout, and the kit-tck lines run a released binary.
---
task tck:kit REF=docker.io/me/sbx-kit-gh:1.0.0   # is this artifact a conforming Kit?
task tck:runtime ADAPTER=./my-adapter            # does this runtime behave as the pages require?
…
kit-tck validate docker.io/me/sbx-kit-gh:1.0.0 --verbose
kit-tck validate docker.io/me/sbx-kit-gh:1.0.0 --format json
```

Released `kit-tck` binaries are attached to each GitHub release of the specification for Linux, macOS, and Windows. `kit-tck inspect` reads a kit's descriptor and recipe without judging it. The suite places three known values in the adapter's environment, `KIT_TCK_HOST_SENTINEL`, `KIT_TCK_BOUND_SECRET`, and `KIT_TCK_SKILL_NAME`. A leak of host environment or of a bound secret is then visible.

This edition did not run it. The capture kit built a v3 artifact and pushed it to a local registry (`28-buildx.txt`, `28-manifest.json`), but no `kit-tck` step ran against it.

## The agent regression check

For agent runs, the planned check is `docker-agent sessions diff --fail-on-divergence`, which compares two recorded sessions "over the sequence of tool calls, not over the assistant's prose" and stops at the first divergence {{help-agent docker-agent sessions diff}}. The capture kit ran it on recorded sessions (`21-sessions-diff.txt`). Two replays of one run are identical across five turns, and a run that called `shell` first diverges at turn 0 and exits 1. A relative reference such as `-1` needs `--` before it, or the parser reads it as a flag. [The sessions section](#s-session-db-sessions-diff-and-eval) explains the session store.

```takeaways
- Treat a claim as confirmed only when a file under `capture/out/` shows the behaviour.
- Run `sbx diagnose` first and attach `--output github-issue` to any report.
- Run `kit-tck validate` on a kit you publish, and read its findings by the specification section they name.
- Keep two recorded sessions per agent and compare them with `sessions diff --fail-on-divergence`.
```

Sources: docs-sbx Security model, Default security posture, Architecture, FAQ, Use cloud sandboxes, Build and distribute kits, Use local and hosted models (research/sources/docs-sandboxes.md); help-sbx sbx diagnose, sbx create (research/sources/help-sbx.md); help-agent docker-agent sessions diff (research/sources/help-docker-agent.md); research/sources/kit-spec-extras.md (README Conformance, docs/spec/conformance.md); research/sources/help-sbx-cloud.md; research/conflicts-register.md rows C4, C13, C15, C16, C26, C29, C34, C45, C56, C105, C106 and the community rows of research/plan.md; capture/out/00-sbx-version.json, 02-diagnose.txt, 02-diagnose.json, 04-auto-stop.txt, 04-env.txt, 04-guest.txt, 08-clone-commit.txt, 08-clone-host.txt, 09-allowed.txt, 09-blocked.txt, 09-check-verbose.json, 10-env-sentinel.txt, 10-receiver.log, 10-swap-curl.txt, 11-gateway-tools-static.json, 11-static-inside.txt, 12-validate.txt, 13-kit-builder-status.txt, 13-kit-v3-validate.txt, 16-toolsets.txt, 18-cassette-head.txt, 21-sessions-diff.txt, 25-doctor.txt, 25-model-pull-latest.txt, 25-run-dmr.txt, 27-inside-run.txt, 28-buildx.txt, 28-manifest.json, 99-final-state.txt
