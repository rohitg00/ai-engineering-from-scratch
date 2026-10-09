# sbx exec, sbx cp, and sbx ports

> Three verbs reach into a sandbox: `exec` runs a command and starts a stopped sandbox, `cp` moves files across the boundary, and `ports` binds `tcp4` unless told otherwise.

A server inside `m101-demo` listens on port 8080. From the host you want to open it, copy a file in, and read a result out. `docker exec`, `docker cp`, and `docker run -p` do those jobs for a container, and `sbx` has the same three verbs with a changed rule in each. When you finish this section, you can run a command as any user, copy a file either way, and publish a port that `localhost` reaches.

## sbx exec

**exec:** `sbx exec [flags] SANDBOX COMMAND [ARG...]` runs one command inside the sandbox, and "If the sandbox is stopped, it is started first" {{help-sbx sbx exec}}. The flags follow `docker exec`, "except detached exec (-d/--detach) is not supported" {{help-sbx sbx exec}}, so `-d` appears in the help only to say so. The 2025 plugin ran `docker sandbox exec -d` detached, which [conflict C31](#s-ref-sources-and-the-conflicts-register) records. With `--cloud`, the flags `-d`, `--user`, and `--privileged` "are rejected rather than silently ignored" {{help-sbx sbx exec}}.

The command runs as the `agent` user, uid 1000, with the `sudo` and `docker` groups, in the workspace directory. `-u root` runs it as root, which the help shows for `apt-get update` and the capture uses to create `/opt/marker-from-demo`. `-w` sets another working directory, `-e KEY=VALUE` and `--env-file FILE` set variables for that one command, and `-it` opens a shell.

Inside, a sandbox knows its own name. Since v0.39.0 sandboxes "expose their own identity as SANDBOX_NAME and SANDBOX_ID environment variables" {{rel-sbx v0.39.0}}, and `SANDBOX_VM_ID` stays as a deprecated copy of the name. `WORKSPACE_DIR` names the mount, and `HOME` is `/home/agent`.

```listing
title: the identity of m101-demo from inside
source: capture/out/04-env.txt
lang: text
note: Cut to the identity and workspace variables. The proxy and credential variables belong to Part 3.
---
$ sbx exec m101-demo sh -c 'env | sort'
…
HOME=/home/agent
…
PWD=$CAPTURE/fixtures/repo
…
SANDBOX_ID=<uuid>
SANDBOX_NAME=m101-demo
SANDBOX_VM_ID=m101-demo
…
WORKSPACE_DIR=$CAPTURE/fixtures/repo
…
[exit 0]
```

## sbx cp

**cp:** `sbx cp SRC DST`, where "Either SRC or DST must be a sandbox path, written as SANDBOX:PATH" {{help-sbx sbx cp}} and the other side is a host path. "Copying between two sandboxes is not supported" {{help-sbx sbx cp}}. The capture's `sbx cp m101-demo:/tmp/out.txt m101-demo-2:/tmp/x` exits 1 with that message, so route such a copy through the host. A directory copy places the directory itself at the destination. When the destination is an existing directory, the source goes inside it, and `-L` follows symbolic links in the source. The sandbox path is a container path, so `/tmp/in.txt` in the capture sits outside the workspace mount and is deleted with the sandbox.

The one rule with a security history is copy-out. Release v0.38.0, published 2026-08-06, "Fixed a destination-escape flaw in sbx cp copy-out (CVE-2026-17106)" {{rel-sbx v0.38.0}}.

```listing
title: a copy in, a copy out, and a refused copy
source: capture/out/06-cp.txt
lang: text
note: Nothing is cut.
---
$ sbx cp $CAPTURE/work/in.txt m101-demo:/tmp/in.txt
[exit 0]

$ sbx exec m101-demo sh -c 'cat /tmp/in.txt; printf out > /tmp/out.txt'
in
[exit 0]

$ sbx cp m101-demo:/tmp/out.txt $CAPTURE/work/out.txt
[exit 0]

$ cat $CAPTURE/work/out.txt
out
[exit 0]

$ sbx cp m101-demo:/tmp/out.txt m101-demo-2:/tmp/x
error: copying between sandboxes is not supported
  try: sbx cp --help
[exit 1]
```

## sbx ports

**ports:** `sbx ports SANDBOX` lists the published ports, `--publish SPEC` adds one, and `--unpublish SPEC` removes one. The spec is `[[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]`, and "If HOST_PORT is omitted, an ephemeral port is allocated automatically" {{help-sbx sbx ports}}. Publishing "starts a stopped sandbox before creating the host binding" {{help-sbx sbx ports}}, as `exec` does.

The rule to learn is the address family. "When publishing without a PROTOCOL, tcp4 is used" {{help-sbx sbx ports}}, so the host binding is `127.0.0.1` alone, and you "Publish tcp explicitly to bind both families" {{help-sbx sbx ports}}. This changed in v0.42.0, when "a published port no longer listens on ::1 unless you name the protocol explicitly" {{rel-sbx v0.42.0}}. The 2025 plugin bound both loopbacks, as [conflict C39](#s-ref-sources-and-the-conflicts-register) records.

| `PROTOCOL` | Host binding when `HOST_IP` is omitted |
|---|---|
| none | `127.0.0.1` as `tcp4`, or `tcp6` on `::1` when `HOST_IP` is an IPv6 address |
| `tcp`, `udp` | `127.0.0.1` and `::1`, or `127.0.0.1` alone when the sandbox is IPv4-only |
| `tcp4`, `udp4` | `127.0.0.1` |
| `tcp6`, `udp6` | `::1` |

The capture publishes `18081:8080`, gets `127.0.0.1:18081 -> 8080/tcp4`, and `curl` answers `200` on `127.0.0.1` and fails with exit 7 on `::1`.

```listing
title: a tcp4 binding and its listing
source: capture/out/05-ports.txt
lang: text
note: Nothing is cut.
---
$ sbx ports m101-demo --publish 18081:8080
Published 127.0.0.1:18081 -> 8080/tcp4
[exit 0]

$ sbx ports m101-demo
HOST IP     HOST PORT   SANDBOX PORT   PROTOCOL
127.0.0.1   18081       8080           tcp4
[exit 0]
```

```listing
title: only the IPv4 loopback answers
source: capture/out/05-ports-curl.txt
lang: text
note: Nothing is cut. The connect time is masked as <n>.
---
$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18081/README.md
200
[exit 0]

$ curl -sS -o /dev/null -w '%{http_code}\n' 'http://[::1]:18081/README.md'
curl: (7) Failed to connect to ::1 port 18081 after <n> ms: Couldn't connect to server
000
[exit 7]
```

`--publish 8080/tcp` then binds both families, each on an ephemeral host port, and `sbx ports --json` lists every binding as `host_ip`, `host_port`, `sandbox_port`, and `protocol`.

```listing
title: a dual-stack binding beside the tcp4 one
source: capture/out/05-ports-tcp.txt
lang: text
note: Cut to the publish and the last record of the JSON listing. The ephemeral ports are masked as <port>.
---
$ sbx ports m101-demo --publish 8080/tcp
Published 127.0.0.1:<port> -> 8080/tcp
Published [::1]:<port> -> 8080/tcp
[exit 0]

$ sbx ports m101-demo --json
…
  {
    "host_ip": "::1",
    "host_port": "<port>",
    "sandbox_port": 8080,
    "protocol": "tcp"
  }
]
[exit 0]
```

Unpublish without a protocol removes the mapping "whether it was published with that same default or as dual-stack tcp" {{help-sbx sbx ports}}, and the capture ends with `sbx ports m101-demo --json` printing `[]`. `-p` on `sbx run` applies at creation only, so change ports later with `sbx ports`. `sbx ls` prints the bindings in its `PORTS` column, as `127.0.0.1:18081->8080/tcp4` in the capture. In the cloud a published port gets a public URL and UDP is refused, as [sbx --cloud](#s-sbx-cloud-run-move-and-ttl) shows.

```takeaways
- Run `sbx exec -u root` for package installs, and expect a stopped sandbox to start.
- Write the sandbox side of `sbx cp` as `SANDBOX:PATH`, and go through the host between two sandboxes.
- Publish `PORT/tcp` when a client connects to `::1`, and read `sbx ports --json` to see what is bound.
```

Sources: help-sbx sbx exec, sbx cp, sbx ports, sbx run (research/sources/help-sbx.md); rel-sbx v0.38.0, v0.39.0, v0.42.0 (research/sources/sbx-releases.md); docs-sbx usage (research/sources/docs-sandboxes.md); conflicts C31, C39 (research/conflicts-register.md); capture/out/04-env.txt, 04-guest.txt, 04-workspace.txt, 05-ports.txt, 05-ports.json, 05-ports-curl.txt, 05-ports-ls.txt, 05-ports-tcp.txt, 05-ports-unpublish.txt, 06-cp.txt, 07-template-save.txt
