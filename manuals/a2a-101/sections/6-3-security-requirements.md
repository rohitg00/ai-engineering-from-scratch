# Security requirements

> Sections 13 and 14 list what a server and a client MUST and SHOULD check, and most of those checks fall on data that another agent sent.

The planner reads `review.json` from `code-reviewer` and the `test-log.txt` chunks from `test-runner`, registers a webhook at `localhost:41250`, and sends a bearer token to `deployer`. Each step crosses a boundary between two parties, and no field in A2A marks what crosses it as safe. Sections 13 and 14 of the specification say what each side must check at those boundaries.

When you finish this section, you can name the rule that applies at each boundary, and say whether the kit and the SDKs meet it. [Figure](#fig-trust-boundaries) maps six boundaries in the kit, with the check at each.

```figure
id: fig-trust-boundaries
kind: layers
title: trust boundaries in the kit, with a threat and a check at each
claim: Data crosses six boundaries in the kit's system, and each needs a check of its own, because A2A labels nothing it carries as safe.
caption: Read each row left to right: where data crosses, what can go wrong, and the check the specification asks for. Rows appear in the order the planner meets them. Violet checks belong to the planner and blue checks to the remote agent. From capture/out/15-push.http, 06-input-required.http, 11-errors.http, and 17-signed-card.txt.
```

## The requirements, and who meets them

The table lists each rule in §13 and §14 that binds a server or a client with a MUST or a SHOULD. The kit column says where the kit meets the rule or does not. The SDK column gives the comparison of the six official SDKs where one was made, with a link to the section that owns the detail.

| Rule | The kit | The SDKs |
|---|---|---|
| Servers "MUST implement authorization checks on every A2A Protocol Operations request" {{spec §13.1}} | none per caller: the deployer needs one shared token, and the other two agents accept anyone | none includes authentication, and owner scoping differs, as [security schemes](#s-security-schemes-and-in-task-authorization) tables |
| `GetExtendedAgentCard` "MUST require authentication" {{spec §13.3}} | the deployer checks its bearer token before every method | none in the core handlers, as [extended cards](#s-extended-cards-and-signatures) tables |
| Agents "MUST include authentication credentials in webhook requests" {{spec §13.2}} | `Authorization: Bearer hook_secret_91d2` on every POST | every SDK that pushes. a2a-go and a2a-rs send only the `Bearer` and `Basic` schemes {{sdk-go a2asrv/push/sender.go at v2.6.0}} {{sdk-rust a2a-server/src/push/sender.rs at a2a-server-lf-v0.5.1}}, and a2a-dotnet has no sender {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} |
| Agents "SHOULD validate webhook URLs to prevent SSRF" {{spec §13.2}} | accepts `http://localhost:41250/a2a-events`, because every process runs on one machine | a2a-go, a2a-rs, and a2a-java reject private hosts by default {{sdk-java server-common/src/main/resources/META-INF/a2a-defaults.properties at v1.4.0.Final}}. a2a-python has an opt-in validator {{sdk src/a2a/utils/push_url_validator.py}}, and the notes record no check in a2a-js |
| Agents "SHOULD implement reasonable timeout values for webhook requests" and "SHOULD implement retry logic" {{spec §13.2}} | 10 s, and no retry | 5 s in a2a-js, 30 s in a2a-go and a2a-rs, the HTTP client default in a2a-python and a2a-java, and none retries |
| Clients "MUST validate webhook authenticity using the provided authentication credentials" {{spec §13.2}} | the planner's receiver records the headers and checks nothing | not compared, and [push notifications](#s-push-notification-configs) lists the receiver's duties |
| Clients "SHOULD use unique, single-purpose tokens for each push notification configuration" {{spec §13.2}} | one token per run, and a read returns it in clear | the reference SDK returns stored credentials in clear too, as [push notifications](#s-push-notification-configs) shows |
| Agents "MUST validate all input parameters before processing" and "SHOULD sanitize or validate file content types and reject unexpected media types" {{spec §13.4}} | a missing field answers `-32602` with a `BadRequest` detail, and `code-reviewer` refuses a `url` part with `image/png` | the reference SDK's media type check is off by default, as the kit README lists |
| "Implementations MUST sanitize user-provided content to prevent injection attacks" {{spec §14.1.1}} | the planner decides on typed data fields only | not compared |
| "File references within A2A messages MUST be validated to prevent server-side request forgery (SSRF)" {{spec §14.1.1}} | `code-reviewer` fetches no URL | not compared |
| "Logs MUST NOT include sensitive information (credentials, personal data) unless required and properly protected" {{spec §13.4}} | the capture files hold `dpl_test_7c1e4b` and `hook_secret_91d2`, which are test values | not compared |
| "Implementations SHOULD support HTTPS to ensure authenticity and integrity of the Agent Card" and "Clients SHOULD verify signatures when present" {{spec §14.3}} | the planner fetches cards over plain HTTP and verifies nothing, and `17-signed-card.txt` shows the check | not compared, and [extended cards and signatures](#s-extended-cards-and-signatures) covers verification |
| Agents "SHOULD implement rate limiting on all operations" and "SHOULD log security-relevant events" {{spec §13.4}} | none | not compared |

Three of those rules deserve more than a row, because the data they guard arrives in every task.

## Text is data, even when it reads like an order

**Prompt injection:** text that arrives as data and that a model on the receiving side follows as an instruction. No field of a part says how far to trust its content {{proto Part}}, and `review.json` was built from a diff that other people wrote.

```rule
label: input is checked before it is read
source: spec §14.1.1
---
"Content MUST be validated against the A2A protocol schema before processing"
```

The kit's planner decides from data parts. It reads `failed` from `summary.json` and `severity` from each finding in `review.json`, and ignores the free text beside them. Its one use of remote text is a substring test on the reviewer's question. A planner built on a model reads much more. So act only on typed fields you have checked. Keep side effects behind an approval that a person or a policy controls, as the deployer does.

## URLs aim the receiver's own requests

**Server-side request forgery (SSRF):** a server sends a request to an address that an outside caller chose, such as an internal service. A `url` part invites it, and so does a webhook URL, which the agent calls for every later event of the task.

The kit's `code-reviewer` refuses a `url` part with media type `image/png`, because its input modes do not list it, and fetches nothing. For webhooks the specification asks agents to "Reject private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)" {{spec §13.2}} and to "Reject localhost and link-local addresses" {{spec §13.2}}. The kit accepts `http://localhost:41250/a2a-events` only because every process runs on one machine. The reference SDK's validator rejects hosts that resolve to loopback, private, link-local, reserved, multicast, or unspecified addresses {{sdk src/a2a/utils/push_url_validator.py}}. It runs only when the host turns it on. [Push notifications](#s-push-notification-configs) covers the receiver's checks.

## Records that outlive the task

A read of a stored configuration returns its secret in clear:

```listing
title: the configuration read back with its secret in clear
source: capture/out/15-push.http
lang: json
note: The ListTaskPushNotificationConfigs reply, cut to one configuration.
---
    "configs": [
      {
        "id": "92c697ef-4abc-4e86-82ba-dc6bce4077af",
        "taskId": "d7d3dceb-7333-4676-90ce-36542116a45c",
        "url": "http://localhost:41250/a2a-events",
        "token": "planner-run-0006",
        "authentication": {
          "scheme": "Bearer",
          "credentials": "hook_secret_91d2"
```

These reads need the task's own access check {{spec §13.1}}, and [security schemes](#s-security-schemes-and-in-task-authorization) covers that scope. The capture files hold `dpl_test_7c1e4b` and `hook_secret_91d2` in clear, which is safe only because they are test values. The `refunds.diff` part stays in the review task's `history`, and "Sensitive information in task history and artifacts MUST be protected according to applicable data protection regulations" {{spec §14.1.1}}. Set a retention period for all of it, as §13.4 recommends {{spec §13.4}}.

```takeaways
- Decide only on typed fields from data parts you have validated.
- Reject webhook and file URLs that resolve to loopback, private, or link-local addresses.
- Check the `Authorization` value and the task id on every notification.
- Keep credentials out of logs and out of records that other callers can read.
```

Sources: spec §13.1, §13.2, §13.3, §13.4, §14.1.1, §14.3 (research/sources/specification.md); proto Part (research/sources/a2a.proto); sdk src/a2a/utils/push_url_validator.py at a2a-python 1.2.2; sdk-go a2asrv/push/sender.go at v2.6.0; sdk-rust a2a-server/src/push/sender.rs at a2a-server-lf-v0.5.1; sdk-java server-common/src/main/resources/META-INF/a2a-defaults.properties at v1.4.0.Final; sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2; capture/out/06-input-required.http, 11-errors.http, 15-push.http, 17-signed-card.txt; capture/planner.py, capture/a2a_ref.py, capture/README.md
