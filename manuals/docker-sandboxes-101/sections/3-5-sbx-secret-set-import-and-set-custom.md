# sbx secret set, sbx secret import, and sbx secret set-custom

> A secret never enters the VM: the agent sees a sentinel, the host keychain holds the value, and the proxy swaps it into requests to the bound host.

You exported `ANTHROPIC_API_KEY` in `~/.zshrc`, as a 2026 tutorial said, and the agent inside the sandbox still has no key. Since v0.35.0 the host environment is not read {{rel-sbx v0.35.0}} ([conflict C7](#s-ref-sources-and-the-conflicts-register)). `-e KEY` passes a plain variable, not a secret, and the three `sbx secret` commands are the only way in.

When you finish this section, you can store a service secret, bind a custom one to a host, and read what the proxy sent.

## Service secrets

**Service secret:** a value stored under one of 13 service names, `anthropic, copilot, cursor, devin, droid, github, google, groq, mistral, nebius, openai, openrouter, xai` {{help-sbx sbx secret set}}, two more than the docs table ([conflict C21](#s-ref-sources-and-the-conflicts-register)). The value comes from `-t`, from stdin, from `--command`, or from `--ref` with a 1Password `op://` reference or an AWS Secrets Manager ARN. `--oauth` is the fifth source, and locally it is "openai/global only" {{help-sbx sbx secret set}} ([conflict C22](#s-ref-sources-and-the-conflicts-register)). Anthropic OAuth comes from the agent's own login instead. A command helper runs "from a fresh temporary directory on the host" {{help-sbx sbx secret set}} since v0.46.0, so a relative helper path no longer resolves ([conflict C38](#s-ref-sources-and-the-conflicts-register)). `--refresh` sets the cache time, default 55 minutes.

The scope is global unless `--sandbox` narrows it. `secret ls` filters with `-g`, `--sandbox`, `--service`, and `--json`, and `secret rm` takes `--all`, `--placeholder`, and `--registry` {{help-sbx sbx secret rm}}. The store is the macOS Keychain, the Windows Credential Manager, or the Linux Secret Service {{docs-sbx Where secrets are stored}}. Without a keyring, Linux uses a file under `~/.config/com.docker.sandboxes` at mode `0700`. Kit approvals live apart from the values, in `~/.config/sbx/credentials.yaml` {{docs-sbx Credential bindings}}.

**secret import:** reads the host environment once, offers each variable with a last-4 preview, and takes `--all`, `--force`, and `--dry-run` {{help-sbx sbx secret import}}. A service that already holds an OAuth token is skipped. On the capture host nothing was exported:

```listing
title: an import with nothing to import
source: capture/out/10-import-dry-run.txt
lang: text
---
$ sbx secret import --dry-run
No credential env vars detected on the host. Set e.g. OPENAI_API_KEY in your shell and re-run, or use `sbx secret set` to enter a value directly.
```

Registry credentials are a third kind, "host-only by default", and reach a sandbox only with `--all-sandboxes` or `--sandbox` {{help-sbx sbx secret set}}.

## What the agent sees

Every service variable inside a sandbox is a sentinel, and the GitHub one is shaped like a token:

```listing
title: sentinels in the environment of m101-demo
source: capture/out/04-env.txt
lang: text
note: Every line that is not a sentinel or a credential mode is cut.
---
ANTHROPIC_API_KEY=proxy-managed
…
GH_TOKEN=gho_sbxproxymanaged000000000000000000000
…
OPENAI_API_KEY=proxy-managed
…
SBX_CRED_ANTHROPIC_MODE=none
SBX_CRED_GITHUB_MODE=none
```

Three formats exist in v0.47.0 ([conflict C35](#s-ref-sources-and-the-conflicts-register)): `proxy-managed` for the eight provider keys, `gho_sbxproxymanaged000000000000000000000` for `GH_TOKEN`, and `sbx-cs-<rand>` for custom secrets. The GitHub one is lower case, where a 2026-09-04 demo showed `GHO_SBX_PROXY_MANAGED` {{talk 2026-09-04 T02}}. No GitHub request was captured: that needs a real token.

## Custom secrets and the receiver

**set-custom:** an experimental secret keyed to `--host` targets and an `--env` name instead of a service {{help-sbx sbx secret set-custom}}. The value comes from `--value`, `--command`, or `--ref`, and `--placeholder sk-{rand}` sets a chosen prefix. The `--header` and `--format` flags apply with `--cloud` only, as the help states for each ([conflict C34](#s-ref-sources-and-the-conflicts-register)). The capture bound `M101_RECV_KEY` to `host.docker.internal` and `localhost`, and started a receiver on the host at `127.0.0.1:18080`. It allowed `localhost:18080` for `m101-secret` and found `M101_RECV_KEY=sbx-cs-<rand>` inside (capture/out/10-env-sentinel.txt). Then it sent three plain HTTP requests:

```listing
title: what the receiver on the host logged
source: capture/out/10-receiver.log
lang: text
note: The second request, sent with the placeholder typed as a literal, is cut. It matched the first.
---
GET /from-variable HTTP/1.1
Host: localhost:18080
User-Agent: curl/8.18.0
Accept: */*
Authorization: Bearer m101-dummy-receiver-0000
X-Demo: m101-dummy-receiver-0000
Accept-Encoding: gzip
…
GET /no-scheme HTTP/1.1
Host: localhost:18080
…
Authorization: m101-dummy-receiver-0000
```

The receiver saw the real value in every place the placeholder appeared: inside `Bearer`, in `X-Demo`, and as the whole `Authorization` value. Its `Host` was `localhost:18080`: the proxy maps `host.docker.internal` to `localhost` {{docs-sbx Accessing host services from a sandbox}}. So the swap happens on plain HTTP, and it is a substring replacement. That settles [conflict C34](#s-ref-sources-and-the-conflicts-register) for custom secrets. The Hacker News claim that the secret must be the whole header describes service secrets, where the kit declares the header and its format {{docs-sbx Services declared by kits}}.

The fourth request went to `gateway.docker.internal:18080`, a name in `NO_PROXY`, so it bypassed the forward proxy. The transparent proxy blocked it with `Empty reply from server` and swapped nothing (capture/out/10-swap-curl.txt). [Figure](#fig-3-6) animates the four steps. The existing sandbox `m101-demo` did not receive `M101_RECV_KEY` (capture/out/10-env-existing.txt), so a custom variable reaches new sandboxes only. Removal is immediate: `sbx secret rm --placeholder sbx-cs-<rand> -f` printed `Applied secret updates for <n> running sandbox(es)` (capture/out/10-secret-rm.txt).

## The SSH agent

One credential path does cross the boundary. "SSH agent forwarding is enabled by default" {{docs-sbx Credential isolation}}, and the guest shows `SSH_AUTH_SOCK=/run/ssh-agent.sock` with `SSH_AUTH_SOCK_GATEWAY=gateway.docker.internal:3129` (capture/out/04-env.txt). Keys stay on the host, and any process inside can ask that agent to sign. `ssh.agentForwardingEnabled` in `sbx settings list` turns it off, followed by `sbx daemon restart` {{docs-sbx SSH agent}}. MCP secrets stay on the host too, under `mcp:<server>:client_secret`, as [sbx mcp add](#s-sbx-mcp-add-load-and-static-mcp) explains.

```figure
id: fig-3-6
kind: sequence
title: one custom secret from the keychain to the receiver
claim: The sandbox only ever holds sbx-cs-<rand>, the forward proxy swaps it for the stored value on the bound host, and a direct connection gets no swap.
caption: Read top down. Lifelines are the sbx CLI, the secret store, m101-secret, the forward proxy, and the receiver on 127.0.0.1:18080. Solid teal arrows are writes to the store. The dashed rose arrow is the direct connection that the transparent proxy blocks. From capture/out/10-set-custom.txt, 10-env-sentinel.txt, 10-swap-curl.txt, and 10-receiver.log.
```

```takeaways
- Store keys with `sbx secret set` or `sbx secret import`, never with `-e KEY`.
- Expect `proxy-managed` or `sbx-cs-<rand>` inside, and test a binding against a host receiver.
- Bind a custom secret to exact hosts, because the proxy replaces the placeholder anywhere in a request.
- Turn off `ssh.agentForwardingEnabled` for an agent you would not let sign with your key.
```

Sources: help-sbx sbx secret, sbx secret set, sbx secret import, sbx secret ls, sbx secret rm, sbx secret set-custom (research/sources/help-sbx.md); docs-sbx Manage credentials, Isolation layers, Usage (research/sources/docs-sandboxes.md); rel-sbx v0.35.0, v0.46.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C7, C21, C22, C34, C35, C38; talk T02 (2026-09-04), HN01 (2026-08-10) from research/plan.md; capture/out/04-env.txt, 10-set-custom.txt, 10-secret-ls.json, 10-env-existing.txt, 10-secret-create.txt, 10-env-sentinel.txt, 10-swap-curl.txt, 10-receiver.log, 10-policy-log.json, 10-placeholder.txt, 10-import-dry-run.txt, 10-secret-rm.txt
