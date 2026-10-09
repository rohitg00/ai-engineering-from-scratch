# sbx policy ls --source org, --profile, and the audit JSONL

> An organization writes policies in Docker Home, the daemon pulls them within five minutes, local rules can only narrow, and every decision is written to a rotating JSONL file.

Your security team asks which hosts the agents reached last week, who allowed each one, and whether a developer could have widened the list. On one laptop the answer is `sbx policy log`, and across a company it is an organization policy with an audit log behind it. When you finish this section, you can say what an organization policy changes on a developer machine and read one audit record.

## What an organization can set

**Organization policy:** a named set of rules written in Docker Home, applied to every local sandbox of the organization or of chosen teams {{docs-sbx Organization policies}}. Three kinds exist: Network access, Filesystem access, and MCP access. A network rule is HTTP, one destination with methods and path patterns, or All traffic over TCP, UDP, or both, with Allow or Deny {{docs-sbx Organization policies}}. A network policy can require approval, so each destination it allows waits once for the developer's confirmation. An MCP policy is Cedar in the `MCP` namespace, default deny, where a `forbid` beats every `permit` {{docs-sbx Policy concepts}}. An organization holds at most 100 policies of 250 rules and 400 KB each {{docs-sbx Policy concepts}}.

A change reaches developer machines within 5 minutes, and `sbx policy reset` forces the pull at the price of every local rule and recorded approval {{docs-sbx Organization policies}}. Network rules apply to the next request, filesystem rules only when a sandbox is created, and MCP registration rules at the next `sbx mcp add`. Sign-in enforcement lists `allowedOrgs` in a managed `com.docker.sbx` profile on macOS, the key `HKLM\SOFTWARE\Policies\Docker\SBX` on Windows, or `/etc/docker-sbx/config.json` on Linux {{docs-sbx Sign-in enforcement}}. `sbx login` then revokes a credential from any other account. All of this is a separate paid subscription, Docker AI Governance, and local use stays free {{docs-sbx FAQ}}.

## What an organization cannot do

Governance narrows and never widens. When a policy is active, only organization allow rules grant access, and deny rules from every source still apply {{docs-sbx Policy concepts}}. Local and kit allow rules are inactive. The help text for `--deny-network` says the same:

```rule
label: the narrowing rule
source: help-sbx sbx create --deny-network
---
"Safe under centralized governance because a local deny can only narrow, never widen, egress."
```

A local deny even beats an organization approval requirement, so the request is blocked and no prompt appears {{docs-sbx Policy concepts}}.

| Rule | Evaluated under organization governance |
|---|---|
| Organization allow | yes |
| Organization deny | yes |
| Local allow | no |
| Local deny | yes |
| Kit-defined allow | no |
| Kit-defined deny | yes |

Governance covers local sandboxes only, and a cloud sandbox uses its own account and sandbox policy, as [the cloud section](#s-sbx-cloud-run-move-and-ttl) describes {{docs-sbx Governance}}. Audit records hold metadata and never prompt content, agent output, or parameter values {{docs-sbx AI Governance Audit Logs}}.

## This capture has no organization

```listing
title: the organization filters on a machine without governance
source: capture/out/03-policy-org.txt
lang: text
note: Both commands as recorded. The second shows the one local policy and no STATUS column, because nothing is inactive.
---
$ sbx policy ls --source org
No policies match the selected filters.
[exit 0]

$ sbx policy ls --include-inactive
POLICY         SOURCE   APPLIES TO   SUMMARY
local-policy   local    all          network: 194 allow; filesystem read: 1 allow; filesystem write: 1 allow
[exit 0]
```

```listing
title: no profiles from remote governance
source: capture/out/03-policy-profile-ls.txt
lang: json
note: The JSON form only. The text form prints "No policy profiles found".
---
{
  "profiles": [],
  "policy_rules_unavailable": false
}
```

No `Governance: Managed by <org>` line appears, and the docs name that line as the test for an active policy {{docs-sbx Local audit logs}}. Every `policy check` in this capture reports `"governance": {"active": false}` (capture/out/09-check-verbose.json). **Profile:** a named group of organization policies that a developer assigns with `--profile` at creation, listed by `sbx policy profile ls` {{help-sbx sbx policy profile ls}}. When no rule matches and no organization governs the machine, the proxy asks for approval. Its 403 body names `sbx policy approval ls` (capture/out/09-blocked.txt), a command the v0.47.0 help tree does not list ([conflict C16](#s-ref-sources-and-the-conflicts-register)).

## The audit record

**Audit record:** one JSON object per policy decision or daemon session event, written by the daemon and never by the CLI {{docs-sbx Local audit logs}}. Records exist since v0.32.0 {{rel-sbx v0.32.0}}. The daemon writes them only for a signed-in user with an AI Governance license under an enforced organization policy. This capture therefore produced none, and the directory listing planned as capture K32 was not recorded ([conflict C37](#s-ref-sources-and-the-conflicts-register)). The sample record in the docs carries the same reason string that `sbx policy log` printed for `m101-policy`:

```listing
title: the reason string in the policy log
source: capture/out/09-policy-log.json
lang: json
note: The one blocked_hosts entry, cut after its reason.
---
  "blocked_hosts": [
    {
      "host": "example.com:443",
      "vm_name": "m101-policy",
      "proxy_type": "forward",
      "rule": "no applicable policies for op(action=net:connect:tcp, resource=net:domain:example.com:443)",
      …
      "reason": "No matching allow rule (default deny)"
```

```listing
title: a denied connection in the docs' sample audit record
source: research/sources/docs-sandboxes.md
lang: json
note: The sample record from the Local audit logs page, cut to the fields the text names. The user, organization, and session fields are cut.
---
{
  "audit_event_id": "95e7257f-93c9-4f29-bde7-88830e2dae80",
  "timestamp": "2026-05-28T19:15:00.728933Z",
  "schema_version": "1.82.0",
  "category": "AUDIT_CATEGORY_EVALUATION",
  "decision": "AUDIT_DECISION_DENY",
  …
  "resource_id": "example.com:443",
  "os": "macos",
  "app_version": "v0.31.0",
  "client_name": "sbx",
  "hostname": "host-machine",
  "deny_reason": [
    "no applicable policies for op(action=net:connect:tcp, resource=net:domain:example.com:443)"
  ],
  "action_type": "network_egress",
  "network_egress": { "protocol": "tcp" },
  "agent": "claude"
}
```

On macOS the files are `audit-<utc-timestamp>-<process-uuid>-<seq>.jsonl` under `~/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/` {{docs-sbx Local audit logs}}. The daemon finalizes a `.tmp` file into `.jsonl` every 5 minutes, 1000 events, or 50 MiB, and never deletes one. `category` is management, evaluation, or execution, and `decision` is one of five values from `AUDIT_DECISION_ALLOW` to `AUDIT_DECISION_APPROVAL_DENY` {{docs-sbx Audit record reference}}. `action_type` names the payload, such as `network_egress`, `http_request` with method, host, port, and path, or `tool_invocation`.

`client_name` is `sbx` and `hostname` names the machine, which is how a GitHub Actions run with `runtime: docker-sbx` appears {{blog 2026-08-21}}. Docker Cloud delivery is on by default and keeps events searchable for 90 days, with CSV export up to 1 000 000 rows {{docs-sbx View and export audit events}}. From 0.39.0 on it also forwards to Splunk Cloud, Dynatrace, Datadog, or Sumo Logic {{docs-sbx SIEM forwarding}}.

```figure
id: fig-7-2
kind: flow
title: from Docker Home to a SIEM
claim: One policy decision becomes one JSONL record on the developer machine, and only an enforced organization policy makes the daemon write it.
caption: Read top to bottom. The daemon pulls the organization policy, merges it with the local deny rules, and decides each request at the proxy. The record goes to the auditkit directory, where rotation finalizes it and cloud delivery forwards it. From research/sources/docs-sandboxes.md (Local audit logs, Audit record reference) and capture/out/09-policy-log.json.
```

```takeaways
- Run `sbx policy ls` and look for the `Governance:` line before you debug a blocked host.
- Add local deny rules when you need less than the organization allows, and never expect a local allow to work.
- Collect only `.jsonl` files from the auditkit directory, and pin SIEM field mappings to `schema_version`.
- Remove and recreate a sandbox after a filesystem policy change.
```

Sources: docs-sbx Governance, Organization policies, Policy concepts, Local policy, Monitoring policies, AI Governance Audit Logs, Local audit logs, Audit record reference, Configure audit delivery, SIEM forwarding, View and export audit events, Sign-in enforcement, FAQ (research/sources/docs-sandboxes.md); help-sbx sbx create, sbx policy ls, sbx policy profile ls (research/sources/help-sbx.md); rel-sbx v0.32.0, v0.39.0 (research/sources/sbx-releases.md); blog 2026-08-21 and research/conflicts-register.md rows C16, C28, C37, C41; capture/out/03-policy-org.txt, 03-policy-profile-ls.txt, 09-check-verbose.json, 09-policy-log.json, 09-blocked.txt
