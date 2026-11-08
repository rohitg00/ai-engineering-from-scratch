---
id: deny-wins-and-the-two-scopes
title: Why the deny for example.com was refused
card: sandboxes
kind: concept
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [sandbox, network-policy, allow, deny, scope]
minutes: 8
lessons: []
manuals: [docker-sandboxes-101#s-sbx-policy-init-allow-deny-and-check-network, docker-sandboxes-101#s-org-policies-profiles-and-the-audit-log]
practice: []
cheatsheet: [sandbox-policy]
related: [sandboxes/blocked-host-reads-as-timeout]
updated: 2026-11-03
---

`sbx policy init balanced` gave one global policy with 194 allow entries. A developer adds `example.com` with `--sandbox m101-policy`, later tries a deny for the same host at the same level, and gets a refusal. Explain the rule grammar, the two scopes, and the order in which the authorizer decides one connection.

## Short answer

An allow rule is a comma-separated list of hostnames, domains, IP addresses or CIDR prefixes, with globs such as `*.example.com`, `**.example.com`, `api?.example.com`, `example.com:443` and `**` for every host; an allow covers TCP unless `--protocol` says otherwise, and a deny covers TCP and UDP. Rules live in two scopes, global by default and local with `--sandbox`. For the same hostname or CIDR a deny wins over an allow, so the CLI refuses a deny that conflicts with an allow in the same scope and you remove the allow first. The authorizer stops at a matching deny, admits on an allow from any active scope, and otherwise denies as `implicit`.

## Full answer

### What `init` sets

`policy init` sets the first global policy, not a default for each sandbox. It runs once with `allow-all`, `balanced` or `deny-all`, and `sbx policy reset` or `sbx daemon start --policy` starts over. The balanced preset on the recorded host held six network groups and two filesystem rules, all with `created_via: default`. The list changes between releases without a changelog, so read `sbx policy ls --wide --json` before you trust it.

### Scope, provenance and who may edit

A rule added with `--sandbox` prints `scope: sandbox:<name>`, `layer: local`, `origin: scoped`, `created_via: added` and `editable: true`. A kit's grant arrives as `created_via: provisioned` with `editable: false`, and `--source kit` lists it. `--deny-network HOST` on `create` or `run` adds a per-sandbox deny at creation, and the help says why that is safe under governance: a local deny can only make egress narrower, never wider.

### The decision order

1. A matching deny ends the walk at once, and the deny also covers UDP and the name lookup.
2. An allow from any active scope admits the host.
3. Nothing matched: `implicit` denial, with the reason `No matching allow rule (default deny)`, which under balanced or deny-all becomes an approval request.

A host without a port is evaluated at port 443, and `check network` checks network access only, never an HTTP method or path. An allowed hostname is not checked against CIDR rules for the address it resolves to.

### Under organization governance

When an organization policy is active, only organization allow rules grant access. Local and kit allow rules are inactive, and local and kit deny rules still apply. A local deny even beats an organization approval requirement: the request is blocked and no prompt appears.

| Rule | Evaluated under governance |
|---|---|
| organization allow | yes |
| organization deny | yes |
| local allow | no |
| local deny | yes |
| kit allow | no |
| kit deny | yes |

## Follow-ups

- **Level 2:** You allow `*.example.com` and deny a CIDR that covers its address. What happens to a connection to `api.example.com`? Expected: it is allowed; an allowed hostname is not checked against CIDR rules for the resolved address.
- **Level 3:** A kit granted `example.com` to a sandbox and you want it blocked there. What do you do, given the kit rule is not editable? Expected: add a local deny with `--deny-network` or `sbx policy deny network --sandbox`, because a deny wins and a local deny only narrows.
- **Level 3:** Why can a local deny be trusted under central governance? Expected: it can only reduce egress; it is evaluated while local allows are not, and it even suppresses an organization approval prompt.
- **Level 4:** How do you keep a recorded policy list honest across releases? Expected: capture `sbx policy ls --wide --json` with the version and the date, because the preset changes without a changelog.

## Wrong answers

- "The later rule wins, so add the deny after the allow." A deny wins regardless of order, and the CLI refuses the conflicting pair in one scope.
- "A hostname deny also blocks the address it resolves to." Host rules and CIDR rules are evaluated apart; an allowed hostname skips the CIDR check.
- "`policy init` sets the default for each new sandbox." It sets one global policy; per-sandbox rules come from `--sandbox`, `--deny-network` or a kit.

## Taught in

The [policy section](../../../manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md) gives the grammar, the scopes and the recorded conflict, and the [governance section](../../../manuals/docker-sandboxes-101/sections/7-2-org-policies-profiles-and-the-audit-log.md) prints the precedence table.
