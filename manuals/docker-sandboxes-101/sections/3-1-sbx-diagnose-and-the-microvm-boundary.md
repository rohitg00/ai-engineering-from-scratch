# sbx diagnose and the microVM boundary

> The agent runs as a container inside a guest kernel on the host hypervisor, with a private Docker Engine, and nothing it does reaches the host daemon.

You started `sbx run claude` on a repository, and the agent is running `docker build` inside. On the host, `docker ps` shows nothing new, and you want to know where those images went and what else the agent can reach. `sbx diagnose` is the first command to run, because it names every layer between the agent and your machine.

When you finish this section, you can read `sbx diagnose`, name the five layers between the agent and the host, and name the doors through them.

## What sbx diagnose checks

**sbx diagnose:** a read-only check of the installation, the platform, the storage, and the connection to the daemon, with `--output json|github-issue` and `--upload` {{help-sbx sbx diagnose}}. On the capture Mac it ran 13 checks, and all passed:

```listing
title: the platform and connection groups of sbx diagnose
source: capture/out/02-diagnose.txt
lang: text
note: The Installation and Storage groups are cut. The capture kit masks byte and block sizes as <n>.
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
…
  13 passed
```

`kern.hv_support is 1` is the macOS flag for hardware virtualization. The guest runs on the host hypervisor: Hypervisor.framework on macOS, Windows Hypervisor Platform on Windows, and KVM on Linux ([conflict C3](#s-ref-sources-and-the-conflicts-register)). The `mkfs.erofs` line names the guest root filesystem format and its page size, which `getconf PAGESIZE` inside reports as `16384` ([conflict C45](#s-ref-sources-and-the-conflicts-register)). The last line is the sign-in check. `sbx` runs without Docker Desktop, and it still refuses to create a sandbox without a Docker account ([conflict C15](#s-ref-sources-and-the-conflicts-register)).

The FAQ gives Docker's reasons: "Tie sandboxes to a real person" and "Authenticate against Docker infrastructure" {{docs-sbx FAQ}}. It also lists the product's own egress hosts, starting with `login.docker.com`.

## Five layers, from the kernel up

Inside `m101-demo`, the capture ran `uname`, `id`, `docker version`, and `mount`:

```listing
title: the guest seen from inside m101-demo
source: capture/out/04-guest.txt
lang: text
note: The os-release block, the Docker client block, the df output, and /etc/hosts are cut.
---
Linux m101-demo 7.0.14 #1 SMP PREEMPT Mon Sep 21 06:45:23 UTC 2026 aarch64 GNU/Linux
…
PRETTY_NAME="Ubuntu 26.04.1 LTS"
…
uid=1000(agent) gid=1000(agent) groups=1000(agent),27(sudo),1001(docker)
16384
…
Server: Docker Engine - Community
 Engine:
  Version:          29.8.1
…
 containerd:
  Version:          v2.3.5
…
bind-<id> on /etc/resolv.conf type virtiofs (ro,relatime)
host on $CAPTURE/fixtures/repo type virtiofs (rw,nosuid,nodev,relatime)
```

The docs name five isolation layers: hypervisor, network, Docker Engine, workspace, and credential {{docs-sbx Isolation layers}}. The listing shows four of them from inside. The guest kernel is `7.0.14` on `aarch64` with 16 KiB pages, on Ubuntu 26.04.1. A build that assumes 4 KiB pages fails here, as one Docker Captain reported on 2026-05-26 {{blog 2026-05-26 B16}}. The agent is user `agent`, uid 1000, in the `sudo` and `docker` groups, and the docs place the control elsewhere:

```rule
label: where the boundary is
source: docs-sbx Isolation layers
---
"The agent runs as a non-root user with sudo privileges inside the VM. The hypervisor boundary is the isolation control, not in-VM privilege separation."
```

Docker Engine 29.8.1 and containerd v2.3.5 in the listing belong to the VM, and so does every image the agent builds. The docs state the consequence in one sentence: "The agent has no path to your host Docker daemon." {{docs-sbx Docker Engine isolation}}

The host side has no Docker API for the sandbox either. Kevin Wittek said on 2026-04-23 that the Moby API is not offered from the host {{talk 2026-04-23 T06}}. REST clients that expect it do not work against a sandbox, and `sbx exec` is the way in, as [sbx exec, cp, and ports](#s-sbx-exec-cp-and-ports) shows.

**VMM:** the virtual machine monitor that starts the guest. Docker wrote its own and said on Hacker News on 2026-08-10 that it is not Firecracker ([conflict C4](#s-ref-sources-and-the-conflicts-register)). The claim that it builds on libkrun stays unverified. The names the product exposes are few. `sandboxd` is the daemon, whose socket `sbx daemon status` prints. `containerd` runs inside the guest, EROFS appears in the diagnose line, virtiofs in the mount table, and `nerdbox` in the release assets.

## The doors through the boundary

Kevin Wittek named four entry points into a sandbox on 2026-09-04: bind mounts, network, secret injection, and MCP {{talk 2026-09-04 T02}}. The capture shows each as one line in the guest. The workspace is `host on $CAPTURE/fixtures/repo type virtiofs (rw,...)`, a mount at the same path as on the host. `/etc/resolv.conf` is a second, read-only virtiofs bind from the host, so the resolver is the host's. The network door is `HTTPS_PROXY=http://gateway.docker.internal:3128` in the environment (capture/out/04-env.txt). The secret door is `ANTHROPIC_API_KEY=proxy-managed`, a sentinel.

The MCP door is `MCP_GATEWAY_URL=http://mcp-gateway.docker.internal/mcp`. A fifth line, `SSH_AUTH_SOCK=/run/ssh-agent.sock` with `SSH_AUTH_SOCK_GATEWAY=gateway.docker.internal:3129`, is the forwarded SSH agent, a door that the talk did not name. The docs turn that forwarding on by default {{docs-sbx Credential isolation}}, and [secrets](#s-sbx-secret-set-import-and-set-custom) returns to it. [Figure](#fig-3-1) stacks the layers and draws the doors.

The VM has limits of its own. `--memory` defaults to 50% of host memory, clamped to 512 MiB to 32 GiB {{help-sbx sbx create}}. `--cpus 0` means all host CPUs, at most 16 on Linux arm64 {{help-sbx sbx create}}. `m101-policy` got `cpu 10` and `memory 32 GiB` on the capture Mac (capture/out/09-create.txt).

```figure
id: fig-3-1
kind: layers
title: the layers of m101-demo and its doors
claim: The agent sits on a private Docker Engine inside a guest kernel, and five doors cross the hypervisor line: mount, network, secret, MCP, and SSH agent.
caption: Read from the host row down. The dashed line is the hypervisor, and every box below it lives in the VM. Each door on the right names the guest line that opens it. From capture/out/04-guest.txt and 04-env.txt.
```

```takeaways
- Run `sbx diagnose` first and read the Virtualization, mkfs.erofs, and Authentication lines.
- Treat the VM boundary as the control: the agent has sudo and a private Docker Engine inside.
- Expect 16 KiB pages and a separate image store, so builds inside never appear on the host.
- Name the doors before you open a sandbox: mount, network, secret, MCP, and SSH agent.
```

Sources: help-sbx sbx diagnose, sbx create, sbx daemon start (research/sources/help-sbx.md); docs-sbx Security model, Isolation layers, Default security posture, Architecture, FAQ (research/sources/docs-sandboxes.md); research/conflicts-register.md rows C3, C4, C15, C45; talk T02 (2026-09-04), T06 (2026-04-23), blog B16 (2026-05-26), HN01 (2026-08-10) from research/plan.md; capture/out/02-diagnose.txt, 02-diagnose.json, 02-daemon-status.txt, 04-guest.txt, 04-env.txt, 09-create.txt
