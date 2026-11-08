---
id: governance-narrows-never-widens
title: One allowlist for every laptop, and who can widen it
card: sandboxes
kind: tradeoff
level: 3
roles: [forward-deployed-ai-engineer, agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [sandbox, governance, audit-log, network-policy, compliance]
minutes: 10
lessons: []
manuals: [docker-sandboxes-101#s-org-policies-profiles-and-the-audit-log, docker-sandboxes-101#s-sbx-policy-init-allow-deny-and-check-network]
practice: []
cheatsheet: [sandbox-policy, ai-governance]
related: [sandboxes/deny-wins-and-the-two-scopes]
updated: 2026-11-03
---

Security wants one allowlist across every developer laptop, a record of each host an agent reached, and proof that no developer can widen the list. Compare local policy on each laptop with an organization policy from the governance product. What changes on a laptop the moment a policy becomes active, and what does one audit record hold?

## Short answer

Local policy gives each laptop its own preset and rules, a per-host `policy log`, and a developer who can add a global allow at will, so it fails the third requirement. An organization policy is written centrally, reaches the daemon within 5 minutes, and from then on only organization allow rules grant access: local and kit allow rules go inactive, local and kit deny rules still apply, and a local deny even beats an organization approval requirement. The daemon then writes one JSONL audit record per decision, holding metadata such as the decision, the resource, the deny reason, the action type and the agent, and never prompt content, agent output or parameter values; the cost is a paid subscription, and the coverage is local sandboxes only.

## Full answer

### What the organization can write

Three policy kinds exist: network access, filesystem access and MCP access. A network rule is HTTP, one destination with methods and path patterns, or all traffic over TCP, UDP or both, with allow or deny, and it can require approval so that each allowed destination waits once for the developer's confirmation. An MCP policy is Cedar in the `MCP` namespace, default deny, where a `forbid` beats every `permit`. An organization holds at most 100 policies of 250 rules and 400 KB each. Network rules apply to the next request, filesystem rules only when a sandbox is created, and MCP registration rules at the next `sbx mcp add`.

### What the laptop loses and keeps

| Rule | Evaluated under governance |
|---|---|
| organization allow | yes |
| organization deny | yes |
| local allow | no |
| local deny | yes |
| kit allow | no |
| kit deny | yes |

`sbx policy reset` forces the pull at the price of every local rule and recorded approval. The test for an active policy is the `Governance: Managed by <org>` line in `sbx policy ls`, and `check network` reports `"governance": {"active": false}` on an unmanaged machine, which is what the recorded capture showed. Sign-in enforcement lists `allowedOrgs` in a managed profile, and `sbx login` then revokes a credential from any other account.

### The audit record

The daemon writes records only for a signed-in user with a governance license under an enforced policy; the CLI never writes one. Files are named `audit-<utc-timestamp>-<process-uuid>-<seq>.jsonl`, finalized from `.tmp` every 5 minutes, 1000 events or 50 MiB, and never deleted. `category` is management, evaluation or execution; `decision` has five values from allow to approval-deny; `action_type` names the payload, such as `network_egress`, `http_request` with method, host, port and path, or `tool_invocation`. The sample record's `deny_reason` carries the same string that a local `policy log` prints: `no applicable policies for op(action=net:connect:tcp, resource=net:domain:example.com:443)`. Cloud delivery keeps events searchable for 90 days and forwards to SIEMs.

### Where governance stops

It covers local sandboxes only; a cloud sandbox uses its own account and policy store. A server registered on the host with `--command` runs as the host user outside the proxy. And a rule that allows a host still allows any request to it unless an HTTP rule narrows it.

## Follow-ups

- **Level 3:** A developer adds a global allow for a new host under governance. Does the agent reach it? Expected: no; local allow rules are inactive while a policy is active, and only the organization's allows grant.
- **Level 3:** The organization tightens a filesystem rule. Which sandboxes see it? Expected: new ones; filesystem rules apply at creation, so remove and recreate the running ones.
- **Level 4:** What must a SIEM pipeline not expect from these records? Expected: prompt text, output or parameter values; map fields by `schema_version` and collect only finalized `.jsonl` files.
- **Level 4:** Where would an attacker who controls a laptop still widen egress? Expected: nowhere through policy; a host-side `--command` MCP server or a cloud sandbox under another account sits outside the governed proxy.

## Wrong answers

- "An organization policy adds to the local allowlist." It replaces it; local and kit allows stop granting while it is active.
- "Every laptop has the audit log." Only a licensed, signed-in user under an enforced policy produces records; the recorded capture produced none.
- "A local deny under governance prompts for approval." It blocks with no prompt; a deny beats the approval requirement.

## Taught in

The [governance section](../../../manuals/docker-sandboxes-101/sections/7-2-org-policies-profiles-and-the-audit-log.md) prints the precedence table and the sample record, and the [policy section](../../../manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md) shows the governance flag in `check network`.
