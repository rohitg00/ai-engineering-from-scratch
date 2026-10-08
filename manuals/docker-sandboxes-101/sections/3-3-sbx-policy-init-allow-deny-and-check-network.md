# sbx policy init, allow network, deny network, and check network

> A global preset plus allow and deny rules in two scopes decide every connection, deny wins, and `check network` asks the same authorizer without sending anything.

Your agent reports that `npm install` failed with a connection error, and the sandbox keeps no shell history to say why. The question is which rule decided. `sbx policy` answers it in two halves: `ls` for the rules that exist, and `check network` for the decision one host would get.

When you finish this section, you can initialize a policy, add a rule in the right scope, and predict the decision for any host.

## The preset and the global policy

**policy init:** sets "the initial global policy, not a per-sandbox default" {{help-sbx sbx policy init}}. It runs once, before the first sandbox, with `allow-all`, `balanced`, or `deny-all`, and `sbx policy reset` or `sbx daemon start --policy` starts over {{help-sbx sbx daemon start}}. The capture host chose `balanced` on v0.47.0, and `sbx policy ls` then showed one policy, `local-policy`, with `network: 194 allow` (capture/out/03-policy-ls.txt). The wide JSON lists eight rules with `created_via: default`: six network groups and two filesystem rules that allow every path. The list changes between releases without a changelog ([conflict C23](#s-ref-sources-and-the-conflicts-register)), so this is the list as recorded on 2026-10-08:

```listing
title: two of the six balanced network groups
source: capture/out/03-policy-balanced.json
lang: json
note: Each group is cut after its first resources. The other groups are default-code-and-containers, default-os-packages, default-cloud-infrastructure, and default-cert-validation.
---
      "id": "default-ai-services",
      "name": "default-ai-services",
      "policy_id": "local-policy",
      "scope": "global",
      "applies_to": "all",
      "resource_type": "network",
      "decision": "allow",
      "resources": [
        "api.anthropic.com:443",
        "statsig.anthropic.com:443",
        "platform.claude.com:443",
…
        "**.openai.com:443",
…
      "id": "default-package-managers",
…
        "registry.npmjs.org:443",
…
        "pypi.org:443",
…
      "provenance": {
        "created_via": "default"
      },
      "actions": [
        "net:connect:tcp"
      ]
```

## Rule grammar and scope

**Allow rule:** a comma-separated list "of hostnames, domains, IP addresses, or CIDR prefixes" {{help-sbx sbx policy allow network}}. The forms are `example.com`, `*.example.com`, `**.example.com`, `api?.example.com`, `api[12].example.com`, `example.com:443`, `[2001:db8::1]:443`, a CIDR, and `**` for every host. A lone `*` and an escaped glob are rejected {{help-sbx sbx policy allow network}}. An allow rule covers TCP unless `--protocol` says otherwise, and a deny rule covers TCP and UDP {{help-sbx sbx policy deny network}}. The capture shows both: the allow came back as `(example.com [tcp])` and the deny as `(example.com [tcp,udp])` (capture/out/09-allow.txt, 09-deny.txt). The deny also warned that UDP egress stays off until `feature.udp-egress` is on.

Two scopes have existed since v0.29.0 ([conflict C41](#s-ref-sources-and-the-conflicts-register)): global, the default, and `local`, which `--sandbox` scopes to one sandbox {{help-sbx sbx policy allow network}}. A rule added with `--sandbox m101-policy` printed `Rule added to policy local (scope: sandbox:m101-policy): <uuid>`, and `sbx policy inspect` shows its scope, layer, origin, and provenance:

```listing
title: the sandbox-scoped allow rule
source: capture/out/09-inspect-rule.json
lang: json
note: The outer policy object and the remove_command field are cut.
---
      "id": "<uuid>",
      "name": "<uuid>",
      "policy_id": "<uuid>",
      "scope": "sandbox:m101-policy",
      "applies_to": "sandbox:m101-policy",
      "resource_type": "network",
      "decision": "allow",
      "resources": [
        "example.com"
      ],
      "origin": "scoped",
      "layer": "local",
      "status": "active",
      "editable": true,
      "sandbox_id": "m101-policy",
      "provenance": {
        "created_via": "added"
      },
      "actions": [
        "net:connect:tcp"
      ]
```

`--deny-network HOST` on `create` or `run` adds the same kind of per-sandbox deny at creation. The help says why that is safe under governance: "a local deny can only narrow, never widen, egress" {{help-sbx sbx create}}. A kit adds rules with `created_via: provisioned`, and `sbx policy ls --source org` on the capture host printed `No policies match the selected filters.` (capture/out/03-policy-org.txt).

**Deny wins:** "Deny rules take precedence over allow rules for the same hostname or CIDR. An allowed hostname isn't checked against CIDR rules for its resolved IP address." {{help-sbx sbx policy deny network}}

The CLI refuses a deny that conflicts with an allow in the same scope: `deny: "example.com" conflicts with existing allow rule "<uuid>"` (capture/out/09-deny-conflict.txt). The capture removed the allow with `sbx policy rm network --sandbox m101-policy --id <uuid> --force` before the deny was accepted. Under organization governance only organization allow rules grant access, while local and kit deny rules still apply {{docs-sbx Precedence}}, and [org policies](#s-org-policies-profiles-and-the-audit-log) prints that table.

`policy ls` filters with `--source local|org|kit`, `--decision`, `--type`, `--created-via default|added|provisioned|approval`, `--protocol`, `--wide` for `RULE_ID`, and `--json` {{help-sbx sbx policy ls}}. A wide row carries `METHOD` and `PATH` columns. The docs fill them with `--method` and `--path` flags. The v0.47.0 help of `sbx policy allow network` lists neither flag, so this manual marks local HTTP rules as unverified. [The proxy](#s-sbx-policy-log-and-the-proxy) returns to them.

## check network

**policy check network:** a read-only call that "evaluates the same daemon-side policy authorizer used by sandbox network enforcement" {{help-sbx sbx policy check}}. A host without a port is evaluated with port 443, and the command "evaluates network authorization, not HTTP method or path" {{help-sbx sbx policy check network}}. It exits 1 on a denial. The capture ran it on `example.com` in the `m101-policy` context before any rule, after the allow, and after the deny:

```listing
title: the explicit denial after the deny rule
source: capture/out/09-check-deny.json
lang: json
note: The implicit denial in 09-check-verbose.json has deny_kind implicit, no origin, no rule, and the reason No matching allow rule (default deny).
---
{
  "action": "net:connect:tcp",
  "allowed": false,
  "context": "sandbox:m101-policy",
  "deny_kind": "explicit",
  "governance": {
    "active": false
  },
  "origin": "local",
  "reason": "Denied by local rule",
  "resource_type": "net:domain",
  "resource_value": "example.com:443",
  "rule": "local:<uuid>",
  "target": "example.com:443",
  "type": "network"
}
```

After the allow, the same call returned `"allowed": true` with no `rule` field (capture/out/09-check-allowed.json). The global check of `api.anthropic.com` did the same under `"context": "global"` (capture/out/03-policy-check-anthropic.json). The two denials differ in `deny_kind`: `implicit` names no rule, and `explicit` names `local:<uuid>`. An implicit denial is also what a sandbox turns into an approval request, which the next section shows. [Figure](#fig-3-3) walks the request through the same order.

```figure
id: fig-3-3
kind: decision
title: how one request to example.com:443 is decided
claim: A matching deny ends the walk at once, an allow from any active scope admits the host, and a request that matches nothing is denied as implicit.
caption: Read top down. Each left box is one question the authorizer asks, and the right box is the answer the capture recorded for it. Dashed rose arrows are denials. From capture/out/09-check-deny.json, 09-check-allowed.json, 03-policy-check-anthropic.json, 09-check-verbose.json, and 09-blocked.txt.
```

```takeaways
- Run `sbx policy init balanced` once, then read `sbx policy ls --wide --json` before you trust the list.
- Add narrow rules with `--sandbox`, and keep global rules for hosts every agent needs.
- Remove the allow before you add a deny for the same host in the same scope.
- Check with `sbx policy check network --sandbox NAME host:port --json` and read `deny_kind` and `rule`.
```

Sources: help-sbx sbx policy init, sbx daemon start, sbx policy allow network, sbx policy deny network, sbx policy ls, sbx policy inspect, sbx policy rm network, sbx policy check, sbx policy check network, sbx create (research/sources/help-sbx.md); docs-sbx Policy concepts, Local policy, Monitoring policies (research/sources/docs-sandboxes.md); research/conflicts-register.md rows C23, C41; capture/out/03-policy-init.txt, 03-policy-ls.txt, 03-policy-org.txt, 03-policy-balanced.json, 03-policy-check-anthropic.json, 09-allow.txt, 09-deny.txt, 09-deny-conflict.txt, 09-inspect-rule.json, 09-rm-allow.txt, 09-check-verbose.json, 09-check-allowed.json, 09-check-deny.json, 12-policy-kit.txt
