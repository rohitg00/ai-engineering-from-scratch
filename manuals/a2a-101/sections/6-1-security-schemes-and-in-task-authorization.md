# Security schemes and in-task authorization

> The card declares which credentials an agent accepts, HTTP checks them on every request, and a running task can still stop to ask for an approval.

The planner's last delegation goes to `deployer`, the only agent in the kit that guards its endpoint. A request without a token gets HTTP 401 before any A2A method runs. A request with the token starts a deploy that stops again, in `TASK_STATE_AUTH_REQUIRED`, until an operator approves it.

[Figure](#fig-credential-path) follows that credential from the card to the approval. When you finish this section, you can read a card's security fields, send what they ask for, and scope tasks to their owner.

```figure
id: fig-credential-path
kind: flow
title: one credential, from the card to an in-task approval
claim: The card names the scheme, HTTP rejects a request without the token before A2A runs, and a running task can still stop for an approval.
caption: Read top to bottom, in five steps. From step 2 on, the left box is what the planner sends and the right box is what deployer answers. Grey boxes sit outside A2A. The task id is shortened to 8 characters. From capture/out/01-agent-cards.http, 18-extended-card.http, and 07-auth-required.http.
```

## What the card declares

Only the deployer's card carries security fields, so `test-runner` and `code-reviewer` accept any caller.

```listing
title: the security fields on the deployer card
source: capture/out/01-agent-cards.http
lang: json
note: Cut from the deployer card. The two fields sit between capabilities and defaultInputModes.
---
  "securitySchemes": {
    "bearer": {
      "httpAuthSecurityScheme": {
        "description": "A token issued by the platform team.",
        "scheme": "Bearer"
      }
    }
  },
  "securityRequirements": [
    {
      "schemes": {
        "bearer": {
          "list": []
        }
      }
    }
  ],
```

**Security scheme:** one entry in the card's `securitySchemes` map. The key, here `bearer`, is a name the agent picks. The value holds exactly one of five variants: `apiKeySecurityScheme`, `httpAuthSecurityScheme`, `oauth2SecurityScheme`, `openIdConnectSecurityScheme`, or `mtlsSecurityScheme` {{proto SecurityScheme}}.

**Security requirement:** one entry in `securityRequirements`. Its `schemes` map names schemes from `securitySchemes`, and each name maps to "the required scopes" {{proto SecurityRequirement}} in a `StringList` whose only field is `list`. The deployer names `bearer` with an empty `list`, so the token alone is enough.

The §8.5 sample card still says `security` where the proto says `securityRequirements` {{spec §8.5}} ([conflict D6](#s-ref-sources)). The migration guide calls the implicit and password flows removed {{docs whats-new-v1}}, while the proto keeps both as deprecated {{proto OAuthFlows}} ([conflict D11](#s-ref-sources)), so offer neither.

## How credentials travel

The client obtains the credential outside A2A and sends it "in protocol-appropriate headers or metadata for every A2A request" {{spec §7.3}}. That header carries a secret, and "Production deployments MUST use encrypted communication (HTTPS for HTTP-based bindings, TLS for gRPC)" {{spec §7.1}}. The specification recommends TLS 1.3 or later {{spec §7.1}}, and the enterprise guide TLS 1.2 or later {{docs enterprise-ready}} ([conflict D18](#s-ref-sources)).

Without it, `deployer` answers HTTP 401 with a `WWW-Authenticate` challenge before any A2A method runs, as [extended cards and signatures](#s-extended-cards-and-signatures) shows.

```rule
label: every request, checked against the card
source: spec §7.4
---
"MUST authenticate every incoming request based on the provided credentials and its declared authentication requirements."
```

## Authorization scope: a task you cannot see does not exist

"Authorization logic is implementation-specific" {{spec §7.5}}. The specification fixes how a refusal looks: "Servers MUST NOT reveal the existence of resources the client is not authorized to access" {{spec §3.3.2}}. So another caller's task gets the same `TaskNotFoundError` as a task that never existed. The same section lists "Attempting to access a task created by another user" {{spec §3.3.2}} as a case for an authorization error, which would confirm that the task exists ([conflict D36](#s-ref-sources)). Answer with the not-found error.

The check runs first: "Authorization checks MUST occur before any database queries or operations that could leak information" {{spec §13.1}}. `ListTasks` must scope its results to the caller even when the request has no filter {{spec §13.1}}. The SDKs differ on who the owner is:

| Implementation | Owner scope | Another caller's task |
|---|---|---|
| Kit | none, and the deployer needs one shared bearer token | returned |
| a2a-python 1.2.2 | task stores keyed by the call context's `user_name`, and every unauthenticated caller has the empty name {{sdk src/a2a/server/owner_resolver.py}} {{sdk src/a2a/auth/user.py}} | `TaskNotFoundError` |
| a2a-js 1.3.0 | tenant and owner in every store, with `unknown` for an anonymous caller {{sdk-js src/server/owner_resolver.ts at v1.3.0}} | `TaskNotFoundError` |
| a2a-java 1.4.0.Final | a `TaskAuthorizationProvider` interface with no implementation in the release, and without one every task operation fails closed {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/auth/TaskAuthorizationProvider.java at v1.4.0.Final}} | `TaskNotFoundError` |
| a2a-go 2.6.0 | the in-memory store records the call's user name, and an empty name makes `ListTasks` fail with `ErrUnauthenticated` {{sdk-go a2asrv/taskstore/inmemory.go at v2.6.0}} | `ErrTaskNotFound` once a name is set |
| a2a-dotnet 1.0.0-preview2 | none, because the store and the handler carry no principal {{sdk-dotnet src/A2A/Server/ITaskStore.cs at v1.0.0-preview2}} | returned |
| a2a-rs a2a-server-lf-v0.5.1 | none in the stores, and an opt-in `RequestAuthorizer` sees only the headers and the task id {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}} | returned |

Without an authentication middleware that fills in the user, every task is visible to every caller.

## In-task authorization

**In-task authorization:** an agent's request for permission partway through a task, through `TASK_STATE_AUTH_REQUIRED` {{spec §7.6}}, which [interrupted states](#s-input-required-and-auth-required) follows frame by frame. The kit's `POST /approve/<task id>` checks no credentials, so anyone who learns the task id can approve. A real approval channel authenticates the operator and records who approved.

A client that is itself an agent can pass the request up a chain of tasks in `TASK_STATE_AUTH_REQUIRED` {{spec §7.6.2}}. An in-band credential then passes through every agent in the chain {{spec §7.6.3}}, so bind it to the agent that asked, "such that only this agent is able to use the credentials" {{spec §7.6.3}}.

[PR #2081](https://github.com/a2aproject/A2A/pull/2081) added §7.6.4 to main on 2026-07-30, after v1.0.1, and no release carries it yet. It says: "Agents MUST NOT treat the TASK_STATE_AUTH_REQUIRED state transition, by itself, as authorization for any particular operation." {{spec-main §7.6.4}} A credential obtained there does not authorize later messages unless the implementation, the issuer, or an extension says so {{spec-main §7.6.4}}. The kit keys each approval by task id, so one approval resumes one deploy, and its bearer check runs on every later request.

```takeaways
- Send the credential that `securityRequirements` names in an HTTP header on every request.
- Answer `TaskNotFoundError` for every task the caller is not allowed to see.
- Route each approval in `TASK_STATE_AUTH_REQUIRED` through a channel that authenticates the operator.
- Treat an approval as covering one task, and check authorization again on every later message.
```

Sources: spec §3.3.2, §7.1, §7.3, §7.4, §7.5, §7.6, §7.6.2, §7.6.3, §8.5, §13.1 (research/sources/specification.md); spec-main §7.6.4 (research/sources/specification-main.md, main 679ab3a, unreleased); proto SecurityScheme, SecurityRequirement, StringList, OAuthFlows (research/sources/a2a.proto); docs/topics/enterprise-ready.md and docs/whats-new-v1.md at v1.0.1; sdk src/a2a/server/owner_resolver.py, src/a2a/auth/user.py, src/a2a/server/tasks/inmemory_task_store.py at a2a-python 1.2.2; sdk-js src/server/owner_resolver.ts at v1.3.0; sdk-java server-common/src/main/java/org/a2aproject/sdk/server/auth/TaskAuthorizationProvider.java at v1.4.0.Final; sdk-go a2asrv/taskstore/inmemory.go at v2.6.0; sdk-dotnet src/A2A/Server/ITaskStore.cs at v1.0.0-preview2; sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1; a2aproject/A2A PR #2081 (unreleased, on main); capture/out/01-agent-cards.http, 07-auth-required.http, 18-extended-card.http; capture/planner.py, capture/a2a_ref.py, capture/README.md
