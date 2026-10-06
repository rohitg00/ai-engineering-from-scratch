# Discovery and supportedInterfaces

> The spec standardizes only the well-known path to a card, and a client takes the first `supportedInterfaces` entry it speaks before it checks a capability flag.

The planner starts with three ports in its configuration: `41241`, `41242`, and `41243`. Before it delegates any work, it fetches three cards, picks one interface from each, and records which agents stream and which one wants a token.

When you finish this section, you can locate an agent's card, pick the interface to call, and avoid the calls its card rules out.

## Three routes to a card

The spec names three ways to reach a card, and it standardizes the details of only one {{spec §8.2}}:

- **Well-known URI.** The client fetches `https://{server_domain}/.well-known/agent-card.json` from a host it already knows {{spec §8.2}}. The project recommends this route for public agents {{docs agent-discovery}}.
- **Registry or catalog.** The client queries "curated catalogs of agents" {{spec §8.2}}, and "The current A2A specification does not prescribe a standard API for curated registries." {{docs agent-discovery}}
- **Direct configuration.** The client starts from "Pre-configured Agent Card URLs or content" {{spec §8.2}}, kept in code, a configuration file, or an environment variable {{docs agent-discovery}}.

The planner's ports come from direct configuration in `capture/run.py`, and each card from the well-known path.

```listing
title: discovery is one GET on the well-known path
source: capture/out/01-agent-cards.http
lang: http
note: The response body is cut after its first field. [Figure](#fig-agent-card-fields) draws the whole card.
---
### 1 · discover test-runner
GET /.well-known/agent-card.json HTTP/1.1
Host: localhost:41241
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json

{
  "name": "test-runner",
…
}
```

Use the path exactly as the spec writes it. One diagram in the project's guides still shows `/.well-known/agent-card` with no `.json`, and `POST /sendMessage` where 1.0 has `POST /message:send` {{docs what-is-a2a}} {{spec §5.3}} ([conflict D32](#s-ref-sources)). [PR #2261](https://github.com/a2aproject/A2A/pull/2261) fixed the diagram on main after v1.0.1, not yet released.

[Figure](#fig-finding-an-agent) follows the planner from its configuration to a checked call on `code-reviewer`.

```figure
id: fig-finding-an-agent
kind: flow
title: from a host to a checked call
claim: Three routes lead to one card, and a client takes the first interface it speaks and checks a capability flag before each optional operation.
caption: Read top to bottom. The planner finds the code-reviewer card through configuration and the well-known path, takes interface 0, and reads two flags. The failed call is exchange 6 of capture/out/11-errors.http.
```

## Choosing from supportedInterfaces

The spec gives the client four rules for `supportedInterfaces`, all of them MUST {{spec §8.3.2}}. The first one decides the endpoint:

```rule
label: the first rule of interface selection
source: spec §8.3.2
---
"Parse `supportedInterfaces` if present, and select the first supported transport"
```

Supported means a binding and a version that the client implements. A JSON-RPC 1.0 client skips a `GRPC` entry and a `JSONRPC` entry at `0.3`, since one card can list a binding at several versions {{spec §3.6.2}}.

The other three rules ask the client to prefer earlier entries, to use the URL of the chosen entry, and to "Set the `tenant` field in every request message to exactly the value declared in the selected `AgentInterface` entry" {{spec §8.3.2}}. No kit card sets a tenant.

## Checking capabilities before a call

```rule
label: read the card before an optional call
source: spec §3.3.4
---
"Clients SHOULD validate capability support by examining the Agent Card before attempting operations that require optional capabilities."
```

On the server side the rule is a MUST: a call that the card rules out fails with a fixed error {{spec §3.3.4}}. The table gives each error with its JSON-RPC code {{spec §5.4}}.

| Flag in `capabilities` | Operations it allows | Error when the flag is absent or `false` |
|---|---|---|
| `streaming` | `SendStreamingMessage`, `SubscribeToTask` | `UnsupportedOperationError`, `-32004` |
| `pushNotifications` | `CreateTaskPushNotificationConfig`, `GetTaskPushNotificationConfig`, `ListTaskPushNotificationConfigs`, `DeleteTaskPushNotificationConfig` | `PushNotificationNotSupportedError`, `-32003` |
| `extendedAgentCard` | `GetExtendedAgentCard` | `UnsupportedOperationError`, `-32004` |

Section 3 says its operations "define the fundamental capabilities that all A2A implementations must support" {{spec §3}}, yet an agent declines streaming, push, or the extended card by leaving its flag out. The flags decide ([conflict D26](#s-ref-sources)).

The `code-reviewer` card has no `pushNotifications` flag, and the kit's error scenario registers a webhook with it anyway:

```listing
title: a push configuration on an agent that declares no push support
source: capture/out/11-errors.http
lang: http
note: Exchange 6, cut to the method, the task id, and the error. The JSON-RPC error arrives with HTTP 200, as [Errors](#s-errors) explains.
---
### 6 · CreateTaskPushNotificationConfig: not supported
POST /a2a/jsonrpc HTTP/1.1
Host: localhost:41242
…
  "method": "CreateTaskPushNotificationConfig",
  "params": {
    "taskId": "00000000-0000-4000-8000-000000000000",
…
HTTP/1.1 200 OK
…
    "code": -32003,
    "message": "Push notifications are not supported",
…
        "reason": "PUSH_NOTIFICATION_NOT_SUPPORTED",
```

The task id does not exist, yet the error names the missing capability, so the call cost a round trip the card had answered.

Skills, modes, and security fields say whether the agent fits the job and what it needs. The planner maps `run-tests` to `test-runner` and attaches a bearer token to every `deployer` call (`capture/planner.py`). [Part](#s-part) and [security schemes](#s-security-schemes-and-in-task-authorization) read those fields.

## Caching the card

A card changes rarely, so the spec asks both sides to use ordinary HTTP caching {{spec §8.6}}. A server "SHOULD include a `Cache-Control` response header with a `max-age` directive" {{spec §8.6.1}}, plus an `ETag` derived from the card's `version` or a hash of its content. A client honors those headers and revalidates an expired card with `If-None-Match` or `If-Modified-Since` {{spec §8.6.2}}.

The kit sends no `Cache-Control` or `ETag` header, as [the kit README](manuals/a2a-101/capture/README.md) lists. An extended card replaces the cached public card for an authenticated session, as [extended cards and signatures](#s-extended-cards-and-signatures) explains.

```takeaways
- Keep your agent hosts in configuration until you run a registry, and fetch each card from `/.well-known/agent-card.json`.
- Take the first `supportedInterfaces` entry whose binding and version you speak, and echo its `tenant` in every request.
- Skip any operation whose capability flag is absent or `false`, because the server must refuse it.
- Cache cards with standard HTTP caching, and revalidate an expired card with its `ETag`.
```

Sources: spec §3, §3.3.4, §3.6.2, §5.3, §5.4, §8.2, §8.3.2, §8.6, §8.6.1, §8.6.2 (research/sources/specification.md); docs/topics/agent-discovery.md, docs/topics/what-is-a2a.md at v1.0.1; capture/README.md, capture/run.py, capture/planner.py; capture/out/01-agent-cards.http, 11-errors.http
