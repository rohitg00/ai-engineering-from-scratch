---
id: the-key-that-was-a-placeholder
title: The key in the log was a placeholder
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [sandbox, secrets, proxy, placeholder, credential-isolation]
minutes: 20
lessons: []
manuals: [docker-sandboxes-101#s-sbx-secret-set-import-and-set-custom, docker-sandboxes-101#s-sbx-policy-log-and-the-proxy, docker-sandboxes-101#s-kit-tck-diagnose-and-the-claims-this-manual-checked]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: sbx v0.47.0
  model: none; shell commands inside the sandbox
  hardware: one Mac with the microVM runtime
source:
  - manuals/docker-sandboxes-101/capture/out/10-env-sentinel.txt
  - manuals/docker-sandboxes-101/capture/out/10-placeholder.txt
  - manuals/docker-sandboxes-101/capture/out/10-swap-curl.txt
  - manuals/docker-sandboxes-101/capture/out/10-receiver.log
  - manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md
  - manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md
  - manuals/docker-sandboxes-101/sections/7-4-kit-tck-diagnose-and-the-claims-this-manual-checked.md
---

## Situation

A security reviewer reads the transcript of a sandboxed agent session. The agent was asked to debug a failing request, so it ran `env` and printed its environment into the log that the team shares. One line reads `M101_RECV_KEY=sbx-cs-<rand>`, where the capture masks the random part. The reviewer files a ticket: the agent holds a credential in plain text, the value sits in a shared log, rotate it now.

The platform engineer disagrees and says the value is not a secret. Nobody can show why. You get the printed lines, the record of the secret in the store, four requests sent from inside the same sandbox, and the log kept by the host receiver that those requests reached.

## Evidence

- [the two custom lines of the environment inside m101-secret](evidence/what-the-agent-printed.txt)
- [a custom secret with a chosen placeholder prefix](evidence/how-a-placeholder-is-set.txt)
- [the record of M101_RECV_KEY in sbx secret ls](evidence/the-stored-record.txt)
- [four requests from the sandbox that carry the placeholder](evidence/four-requests-from-inside.txt)
- [the three requests as the receiver on the host saw them](evidence/what-the-receiver-logged.txt)

## Questions

1. Is the printed value the credential? What in the store record settles it?
2. The first three requests returned 204. What did the receiver get in each header, and what does that say about where the swap happens?
3. The fourth request got no reply and the code 000. Why, and what does that tell you about a placeholder sent to a host it is not bound to?
4. Which row of the manual's claims ledger does this evidence confirm, and which claim about the proxy stays unchecked?
5. What should the ticket become?

## Walkthrough

1. **Read the two printed lines.** `M101_RECV_KEY` holds `sbx-cs-<rand>`, and the other custom line holds the word `proxy-managed`. The manual names three sentinel formats in this release: `proxy-managed` for the provider keys, a token-shaped value for the git host, and `sbx-cs-<rand>` for custom secrets. The printed value has the custom shape.
2. **Read how a placeholder is made and stored.** `set-custom` saves a placeholder for a target host and an env name, and with `--placeholder 'sk-{rand}'` the saved value is `sk-<rand>`. The `secret ls` record for `M101_RECV_KEY` has two fields that matter: `placeholder` is `sbx-cs-<rand>`, and `secret` is masked as `m101-d**************0000`. The environment inside the sandbox holds the first field. The second never left the store.
3. **Follow the placeholder to a bound host.** From inside, three requests to `host.docker.internal:18080` returned 204: one with the variable inside `Bearer`, one with the placeholder typed as a literal, and one with the bare value and no scheme. The receiver logged `Bearer m101-dummy-receiver-0000` for the first two, the same value in `X-Demo`, and the bare value as the whole `Authorization` header for the third. The real value appears only on the host side, wherever the placeholder stood. So the swap is a substring replacement in the forward proxy, and it happens for a host that the secret is bound to.
4. **Follow it to another name.** The fourth request went to `gateway.docker.internal:18080`. That name is in `NO_PROXY`, so curl skipped the forward proxy and opened a direct connection. The transparent proxy blocked it: an empty reply, the code 000 and exit 52. Nothing was swapped. A placeholder sent anywhere else stays a placeholder.
5. **Place the result in the ledger.** The manual's claims table marks "credential values never enter the VM" as confirmed by these two files, and the header swap for a bound host as confirmed on both sides. It marks TLS interception as not checked, because no certificate chain was read, and the question of data leaving through an allowed host as disputed, with no capture. Say exactly that much.

## Resolution

The value in the log is the placeholder of a custom secret, not the credential. The credential stays in the host store. The forward proxy puts it into requests to the two bound hosts only, and the receiver log shows that this is where the real value first exists. A request to any other name carries the placeholder or is blocked. The ticket closes as no leak, with two notes: the placeholder tells a reader that a bound secret exists for those hosts, and the sandbox could reach `localhost:18080` only because a policy rule allowed it, so the receiver was a host the operator chose.

Two checks go into the runbook. For a suspected leak from a sandbox, compare the printed value with the `placeholder` field of `sbx secret ls --json` before anything is rotated. For a new custom secret, bind it to exact hosts and send one request to a receiver you control, so the swap is proven once, as the capture did.

## Wrong turns

- "Rotate the key and purge the log." Nothing in the log is the key. A rotation costs a change on the host and on the receiver and fixes nothing, and the next transcript shows the same placeholder.
- "The agent read the host keychain." The guest has no path to the store. The swap happens in the proxy on the host, after the request leaves the VM.
- "Pass the real key with -e so the agent can call the API itself." A plain variable is not a secret, and the sentinel exists so that the value never enters the VM. The store and the binding are the supported path.
- "The proxy touches only the Authorization header, so a value in another header is safe." The receiver shows the value in X-Demo too. A custom secret is replaced wherever the placeholder appears in a request to a bound host, so bind it to exact hosts.

## Generalize

A secret shown by a process inside a boundary is a secret only if the same bytes work outside the boundary. Before you call a leak, find where the value is stored, compare the printed bytes with the stored placeholder, and send the printed bytes to a receiver you control from an intended and from an unintended destination. Then write down what the test proved and what it did not, with the file names.

## Taught in

The manual's [secret page](../../../manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md) records the placeholder, the swap and the receiver, [the proxy page](../../../manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md) explains the two proxy paths, and [the claims ledger](../../../manuals/docker-sandboxes-101/sections/7-4-kit-tck-diagnose-and-the-claims-this-manual-checked.md) says which claim these files confirm.
