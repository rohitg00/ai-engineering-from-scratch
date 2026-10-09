# sbx mcp add, sbx mcp load, and --static-mcp

> MCP servers are registered on the host, served to the sandbox through one gateway endpoint, and either fixed at creation or loaded live with a `tools/list_changed` notice.

You want the agent to read documentation through an MCP server, and you do not want that server's token inside the VM. `sbx mcp` keeps the registration, the OAuth tokens, and any local server process on the host, and gives the sandbox one URL.

When you finish this section, you can register a server, pick static or dynamic mode, and load a server into a running sandbox.

## Register on the host

**sbx mcp add:** "Register an MCP server by name. The server is validated and its specification is stored for use with sbx create/run --static-mcp." {{help-sbx sbx mcp add}}

`--url` takes four forms: a remote endpoint, a community-registry URL, a `server.json` or `server.yaml` manifest URL, and a `dhi.io/` image reference. Other image references are rejected, and `--local` runs a registry OCI server on the host with `docker run` {{help-sbx sbx mcp add}}. The capture registered one remote server and listed it:

```listing
title: the registered server and its gateway
source: capture/out/11-mcp-ls.json
lang: json
---
{
  "gateway": {
    "name": "LOCAL",
    "local": true,
    "operator": "managed by you",
    "decision": "local",
    "signed_in_as": "<docker-user>"
  },
  "servers": [
    {
      "name": "m101-deepwiki",
      "transport": "remote http",
      "status": "ready",
      "type": "remote"
    }
  ]
}
```

The help's own registry example did not resolve on 2026-10-08: the add of `https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest` failed with `registry returned status 404` (capture/out/11-mcp-add-registry.txt). `--command` is the other input, and it runs on the host: "The process runs with your host user's full permissions" {{help-sbx sbx mcp add}}. A local server that starts a container uses host Docker, outside the engine boundary of [the microVM](#s-sbx-diagnose-and-the-microvm-boundary) {{docs-sbx Local stdio server}}.

OAuth metadata is discovered through RFC 9728 and RFC 8414, or supplied by hand with `--oauth-authorization-server`. `--client-id` names a pre-registered client, and dynamic registration follows RFC 7591. `--scope` records default scopes with a documented precedence, `--resource` sets the RFC 8707 indicator, and `--callback-port` pins the listener {{help-sbx sbx mcp add}}. Tokens stay on the host, and `sbx mcp auth [server|--all]`, `auth status`, and `auth rm` manage them {{help-sbx sbx mcp auth}}.

The deepwiki server needs none: `sbx mcp inspect` reports `requires_oauth: false`, and `auth status --all --json` printed `[]`, so no OAuth flow was captured. A confidential client's secret and any `--header 'Name: ${placeholder}'` value come from the secret store as `mcp:<server>:client_secret` and `mcp:<server>:<placeholder>`. A header-bearing registration is rejected on the hosted gateway {{help-sbx sbx mcp add}}.

## One gateway per sandbox

**MCP gateway:** a host-side endpoint that "brokers access to registered MCP servers" {{docs-sbx MCP gateway}}. Inside `m101-mcp` the environment holds `MCP_GATEWAY_URL=http://mcp-gateway.docker.internal/mcp` and `MCP_SENTINEL_TOKEN_NAME=proxy-managed` (capture/out/11-static-inside.txt). The docs list the agents that read that URL at start: Claude Code, Codex, Devin, Gemini, Kiro, and OpenCode {{docs-sbx Prerequisites}}. Docker Agent is absent from that list. A plain `shell` sandbox reached the gateway with curl all the same (capture/fixtures/mcp-probe.sh):

```listing
title: the initialize answer of the gateway inside m101-mcp
source: capture/out/11-gateway-initialize.http
lang: http
note: Three headers and the instructions text are cut.
---
HTTP/1.1 200 OK
…
Content-Type: text/event-stream
…
Mcp-Session-Id: <session>
…
event: message
id: <event-id>
data: {"jsonrpc":"2.0","id":1,"result":{"capabilities":{"logging":{},"prompts":{"listChanged":true},"resources":{"listChanged":true},"tools":{"listChanged":true}},"instructions":"### m101-deepwiki…"protocolVersion":"2025-11-25","serverInfo":{"name":"mcp-gateway-m101-mcp","version":"0.1.0"}}}
```

The gateway names itself `mcp-gateway-m101-mcp`, one per sandbox, answers protocol version `2025-11-25`, and declares `tools.listChanged: true`. `sbx mcp ls` adds a `GATEWAY` column, `LOCAL, managed by you`, with `signed_in_as` in the JSON {{help-sbx sbx mcp ls}}. `mcp.forceLocalGateway`, default `false`, and `SBX_MCP_URL=none` select the local data plane when an account would otherwise use the hosted gateway {{docs-sbx mcp.forceLocalGateway}}.

The docs separate it from the Desktop product: "You don't need the Docker Desktop MCP Toolkit to use `sbx mcp`" {{docs-sbx MCP gateway}}. Network policy does not apply to a server the host registered, as Kevin Wittek said on 2026-09-04 {{talk 2026-09-04 T02}}. A server the agent starts inside the VM is subject to it. [DMR, Compose models, and the MCP gateway service](#s-dmr-compose-models-and-the-mcp-gateway-service) covers the Toolkit gateway.

## Static and dynamic

**Static mode:** `--static-mcp a,b` at `create` or `run` fixes the set once at creation {{help-sbx sbx create}}. The static sandbox exposed the three deepwiki tools plus `code-mode` and `mcp-exec`, and no discovery tool. The dynamic sandbox started with discovery tools only, and `sbx mcp load m101-deepwiki --sandbox m101-mcp-dyn` added the three:

| Sandbox and moment | `tools/list` names | Capture |
|---|---|---|
| `m101-mcp`, static | `ask_wiki_question code-mode mcp-exec read_wiki_contents read_wiki_structure` | capture/out/11-gateway-probe-static.txt |
| `m101-mcp-dyn`, before load | `code-mode mcp-add mcp-config-set mcp-exec mcp-find` | capture/out/11-gateway-probe-dynamic-before.txt |
| `m101-mcp-dyn`, after load | `ask_wiki_question code-mode mcp-add mcp-config-set mcp-exec mcp-find read_wiki_contents read_wiki_structure` | capture/out/11-gateway-probe-dynamic-after.txt |

```listing
title: loading a registered server into a running sandbox
source: capture/out/11-load.txt
lang: text
---
$ sbx mcp load m101-deepwiki --sandbox m101-mcp-dyn
MCP server "m101-deepwiki" loaded into sandbox "m101-mcp-dyn" (live)
```

The help promises the notice: "Connected agents see the new server's tools immediately via the standard MCP tools/list_changed notification" {{help-sbx sbx mcp load}}. The probe opened a new session for each run, so it recorded the two lists and not the notification itself. The built-in tools belong to the gateway: `mcp-exec`, `code-mode`, `mcp-find`, `mcp-add`, `mcp-config-set`, and `<server>-authorize` for OAuth servers {{docs-sbx Built-in gateway tools}}. In Cedar MCP policies those are `MCP::Primordial` resources and a server's tools are `MCP::Tool` resources {{docs-sbx Built-in gateway tools}}, which [org policies](#s-org-policies-profiles-and-the-audit-log) returns to.

`sbx mcp catalog` was removed in v0.45.0 {{rel-sbx v0.45.0}}, and the `sbx mcp enable` of the product page never existed ([conflict C11](#s-ref-sources-and-the-conflicts-register)). [Figure](#fig-3-7) draws the store, the two gateways, and the load. For the protocol itself, read [the MCP lesson](phases/13-tools-and-protocols/06-mcp-fundamentals).

```figure
id: fig-3-7
kind: flow
title: one registration, two gateways, two tool lists
claim: The host store holds m101-deepwiki once, each sandbox gets its own gateway at one URL, and a static set is fixed while load changes a dynamic one live.
caption: Read from the store on the left to the two sandboxes on the right. Solid ink arrows are the registration reaching a gateway. The dotted indigo arrow is the tools/list_changed notice, and the dashed olive arrow is the remote server outside the VM. From capture/out/11-mcp-inspect.json, 11-static-inside.txt, 11-gateway-probe-static.txt, 11-gateway-probe-dynamic-before.txt, 11-load.txt, and 11-gateway-probe-dynamic-after.txt.
```

```takeaways
- Register with `sbx mcp add`, then pick `--static-mcp` for a fixed set or `sbx mcp load` for a live change.
- Treat a `--command` server as a host process with your permissions, never as sandboxed.
- Check `sbx mcp inspect NAME --json` for `requires_oauth`, and store client secrets as `mcp:NAME:client_secret`.
- Read `MCP_GATEWAY_URL` inside the sandbox when an agent is not on the integration list.
```

Sources: help-sbx sbx mcp, sbx mcp add, sbx mcp auth, sbx mcp inspect, sbx mcp load, sbx mcp ls, sbx create (research/sources/help-sbx.md); docs-sbx MCP gateway, Architecture, Security model, Settings (research/sources/docs-sandboxes.md); rel-sbx v0.45.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C11, C91; talk T02 (2026-09-04), T23 (2026-09-29) from research/plan.md; capture/fixtures/mcp-probe.sh; capture/out/11-mcp-add.txt, 11-mcp-add-registry.txt, 11-mcp-ls.json, 11-mcp-inspect.json, 11-mcp-auth-status.json, 11-static-create.txt, 11-static-inside.txt, 11-gateway-initialize.http, 11-gateway-probe-static.txt, 11-dynamic-create.txt, 11-gateway-probe-dynamic-before.txt, 11-load.txt, 11-gateway-probe-dynamic-after.txt, 11-mcp-rm.txt
