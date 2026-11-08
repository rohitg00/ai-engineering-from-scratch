---
id: kit-grants-union-and-widen
title: Two mixins, one host, and the update that must stop
card: sandboxes
kind: design
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [sandbox, kit, capabilities, network-policy, supply-chain]
minutes: 10
lessons: []
manuals: [docker-sandboxes-101#s-com-docker-sandbox-capabilities, docker-sandboxes-101#s-syntax-docker-sandbox-kit-3-and-kit-yaml, docker-sandboxes-101#s-sbx-kit-pack-push-sign-and-verify]
practice: []
cheatsheet: [docker-sandboxes, sandbox-policy]
related: [sandboxes/deny-wins-and-the-two-scopes, protocols/descriptor-pin-rug-pull]
updated: 2026-11-03
---

Your composition is one workload and two mixins. Mixin A allows `api.example.com` outright. Mixin B allows `api.example.com` with `methods: [GET]` only and denies `DELETE` on it. Next week mixin A ships a version that removes one of its deny entries and adds a `credential@1`. Predict the merged grant set, say which updates apply silently, and design the review step.

## Short answer

Allow entries union per phase, deny entries union per phase, and deny wins on the result. A's unbounded host allow swallows B's bounded `GET` entry, because the union of an unbounded grant and a bounded one is the unbounded grant, while B's `DELETE` deny survives and wins. Every grant maps onto one normalized set that the consumer stores in its lock file, and a candidate version whose set stays inside the stored set applies silently; any widening stops for approval, and a removed deny and a new credential are both on that list, so A's new version stops twice.

## Full answer

### What a capability is

A kit grants itself nothing. Each entry in `capabilities` is a typed, versioned request, `<namespace>/<name>@<version>`, that the host answers with granted, refused or prompted. The `config` is decoded strictly for the types the specification defines, so an unknown key is an error, and the reason is policy: a misspelled key that the parser ignored would be a policy that is missing without a warning. Unknown types are allowed by design; a required unknown type fails resolution and an optional one is skipped and recorded.

### network-policy@2 and credential@1

A `network-policy@2` entry is a plain host string, which grants the connection for any protocol, or an object with `hosts`, `methods` and `paths`, which grants those HTTP requests and nothing else on that host. Deny entries list what to refuse, and the runtime answers a refused request with HTTP status `403`. A `credential@1` entry names a `service` and a `phase` and never the place where the secret is kept, and every `inject` domain must appear in the allow list of the same phase.

### Resolution

A composition has exactly one `workload`, and two kits that provide the same normalized name fail resolution. Inside `sbx`, the grant arrives as a policy rule with `created_via: provisioned` and `editable: false`, which `--source kit` lists, and `check network` answers `allowed: true` for it.

### Updates and the lock

The widening list is explicit: a new allow entry, a removed deny entry, a new credential, path or port, and write access over a read-only skills path. A removed deny counts because the deny was part of what made the grant acceptable. `optional` does not change the set. Six types contribute nothing to it: `resources@1`, `lifecycle@1`, `agent-context@1`, `agent-sessions@1`, `sbx@1` and `long-running@1`.

### The review step

1. Build with a `docker-container` builder, because the default driver drops the descriptor annotation and an image without it is not a kit to any consumer.
2. Pin each kit by digest and store its normalized set; diff the set on every candidate.
3. Require signatures: set `kit.trustedSigners` before `kit.requireSignature`, or only the vendor's own identities pass.
4. Let the diff decide: a subset applies, a widening opens a ticket that names the entry, and a removed deny is a widening.

## Follow-ups

- **Level 3:** Why does the strict decoder treat an unknown key as an error instead of a warning? Expected: a silently ignored key is a policy that is absent without anyone knowing.
- **Level 3:** You want B's `GET`-only grant to hold. What do you change? Expected: remove A's unbounded allow, or add deny entries for the other methods in B, since a deny wins while a bounded allow is swallowed by an unbounded one.
- **Level 4:** Which capability types never trigger approval on update, and why is that safe? Expected: the six constraint and launch types, because they ask for nothing from the host.
- **Level 4:** A published kit shows no descriptor annotation on its index. What happened and what does a consumer do? Expected: the default builder dropped it; a consumer that finds no annotation on the index reads the platform manifest, and an image with none anywhere is not a kit.

## Wrong answers

- "The narrowest grant wins when kits overlap." Allows union; the unbounded entry swallows the bounded one, and only a deny narrows.
- "`optional: true` makes a capability safe to add." It changes whether resolution fails, not the grant set.
- "Every version bump needs approval." A candidate whose set stays inside the stored set applies silently; the lock is what makes that cheap and safe.

## Taught in

The [capabilities section](../../../manuals/docker-sandboxes-101/sections/4-2-com-docker-sandbox-capabilities.md) gives the union, the deny and the widening list, the [descriptor section](../../../manuals/docker-sandboxes-101/sections/4-1-syntax-docker-sandbox-kit-3-and-kit-yaml.md) shows the strict decode and the dropped annotation, and the [signing section](../../../manuals/docker-sandboxes-101/sections/4-3-sbx-kit-pack-push-sign-and-verify.md) names the signer settings.
