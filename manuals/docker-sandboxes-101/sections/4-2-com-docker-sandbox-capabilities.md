# `com.docker.sandbox/*` capabilities

> A kit grants itself nothing: each capability is typed and versioned, the resolver unions one workload with its mixins, and any widening on update stops for approval.

The `gh` mixin a colleague published reaches `api.github.com` with your token. You want to know exactly which requests it can make with that token, and what changes when version 2 arrives. Both answers are in its `capabilities` list.

When you finish this section, you can read that list, predict the merged grant set, and say which update will stop and ask.

## Typed, versioned requests

**Capability:** one typed request in a kit's `capabilities` list, "Everything the Kit needs but cannot supply itself" {{kitspec §7}}. The host answers each one: granted, refused, or prompted.

Each entry has a `type` of the form `<namespace>/<name>@<version>`, an optional display `name`, and an `optional` flag {{kitspec §7}}. Its `config` is decoded strictly for the types the specification defines, so an unknown key is an error {{kitspec §7}}. The version names the config schema, so `network-policy@1` and `@2` both exist and a descriptor states one of them {{kitspec §7.1}}. "Policy-shaped types are singletons" {{kitspec §7.1}}, while instance-shaped types repeat once per thing requested, such as `credential@1` per service and phase.

Unknown types are allowed by design: "An unknown type is the extension point working as designed" {{kitspec §7.3}}. A required unknown type fails resolution, and an optional one is skipped and recorded.

## The nineteen types at the pin

| Type | Shape | What it asks for |
|---|---|---|
| `network-policy@1` | singleton | hosts the sandbox can reach, per phase |
| `network-policy@2` | singleton, exclusive with `@1` | hosts plus HTTP methods and paths |
| `credential@1` | per service and phase | one service the workload authenticates to |
| `ssh-agent@1` | per phase | what the forwarded SSH agent signs |
| `volume@1` | per path | persistent or tmpfs storage |
| `host-mount@1` | per path | a host directory, sharing the storage key with `volume@1` |
| `port@1` | per container port and transport | a published port |
| `usb-device@1` | instance | a USB device match |
| `resources@1` | singleton | CPU, memory, and GPU limits, a constraint rather than a grant |
| `privileged@1` | singleton, no config | a privileged container |
| `long-running@1` | singleton, no config | keep running with no session attached |
| `lifecycle@1` | singleton | install hooks, startup hooks, files, the interactive argv |
| `agent-context@1` | singleton | the instruction file for the agent |
| `agent-sessions@1` | singleton | headless prompt and resume verbs |
| `agent-skills@1` | per path | where the agent reads skills |
| `agent-skill@1` | per effective name | one bundled skill |
| `git-identity@1` | singleton, no config | the runtime's git name and email |
| `kit-registry@1` | singleton, no config | reach the runtime's own kit registry, where builds push and pull |
| `sbx@1` | singleton, no config | launch the workload a particular way, with the identity the image states |

The table is `kitspec §7.2` at the `v3.0.0-m.8` tag. The main branch adds a twentieth, `com.docker.sandbox/agent-interactive-sessions@1`, as a singleton {{kitspec-main §7.2}}, unreleased at the pin. The newest type in sbx itself arrived with the pinned release: "Kits can declare `com.docker.sandbox/long-running@1` to keep local sandboxes running after all sessions disconnect" {{rel-sbx v0.47.0}}.

## network-policy@2 and credential@1

A `network-policy@2` entry is a plain host string or an object with `hosts`, `methods`, and `paths` {{kitcap network-policy@2}}. A host string grants the connection for any protocol, as `@1` did. An entry with `methods` or `paths` is bounded: it grants those HTTP requests and nothing else on that host. Deny entries are "Entries to refuse. Deny wins" {{kitcap network-policy@2}}. A refused request gets a status, because a runtime "MUST answer a request these entries refuse with HTTP status `403`" {{kitcap network-policy@2}}. The proxy that enforces this is the one in [the policy log section](#s-sbx-policy-log-and-the-proxy).

A `credential@1` entry names a `service` and a `phase`, "never where the secret lives" {{kitcap credential@1}}. With `apiKey.proxyManaged`, "The real value stays on the host" {{kitcap credential@1}}. Every `inject` domain must appear in the allow list of the same phase {{kitcap credential@1}}. The binding that answers it is the one [the secret section](#s-sbx-secret-set-import-and-set-custom) stores.

## Resolution and the merged set

A runtime "MUST include exactly one `workload` Kit per composition" {{kitspec §5.3}}. It "MUST fail when two Kits provide the same normalized name" {{kitspec §5.3}}, so `claude` plus `claude-mixin` is refused. Across the set, allow entries union per phase, deny entries union per phase, and deny wins on the result {{kitcap network-policy@2}}. When one kit allows a host outright, another kit's bounded entry for that host is dropped, because the union is the unbounded grant {{kitspec §9.5}}. [Figure](#fig-4-2) runs that arithmetic on three kits.

```figure
id: fig-4-2
kind: tree
title: three kits resolve into one grant set
claim: One workload and two mixins merge into one grant set where allows union, deny wins, and a removed deny on the next version stops for approval.
caption: Read top down. The three kits are the captured hello-kit, the gh example of kitspec §2, and the network-policy@2 config example of its capability page. The teal block is the lock. From capture/fixtures/kits/hello-kit/kit.yaml, kitspec §5.3, §7.4, §9.5, and the kitcap pages.
```

## What a grant looks like inside sbx

The recording host ran a v2 mixin, so the captured rows come from `permissions.network.allow` rather than a v3 entry. The daemon stores the grant as a policy rule the sandbox owner cannot edit:

```listing
title: the kit's allow rule on sandbox m101-kit
source: capture/out/12-policy-kit.json
lang: json
note: The rules array has one element, cut to the fields named in the text.
---
      "name": "kit:m101-kit",
…
      "scope": "sandbox:m101-kit",
…
      "resource_type": "network",
      "decision": "allow",
      "resources": [
        "example.com"
      ],
…
      "editable": false,
…
        "created_via": "provisioned",
```

`sbx policy check network example.com --sandbox m101-kit --json` then answers `"allowed": true` (`capture/out/12-check-kit.json`). The rule carries `created_via: provisioned` and answers to `--source kit`, which is how [the policy section](#s-sbx-policy-init-allow-deny-and-check-network) tells a kit rule from one you added.

## Updates and the lock

Every grant projects onto one normalized set, and "Consumers that gate updates store a Kit's surface in the lock and diff a candidate's against it" {{kitspec §7.4}}. A new version whose set stays inside the stored one can apply silently. Any widening must stop for approval. The list is explicit: a new allow entry, "a removed deny entry (the deny was part of what made the grant acceptable)" {{kitspec §7.4}}, a new credential, path, or port, or write access over a read-only skills path. `optional` does not change the set {{kitspec §7.4}}. Six types contribute nothing to it: `resources@1`, `lifecycle@1`, `agent-context@1`, `agent-sessions@1`, `sbx@1`, and `long-running@1` {{kitspec §7.4}}.

```takeaways
- Read a kit's `capabilities` list before you run it, and treat each entry as a request you answer.
- Expect allows to union across kits, and write a `deny` when another kit must not widen a host.
- Review every update that adds an allow, a credential, a path, or a port, or removes a deny.
```

Sources: kitspec §5.3, §7, §7.1, §7.2, §7.3, §7.4, §9.5 (research/sources/SPEC-v3-at-v3.0.0-m.8.md); kitspec-main §7.2 (research/sources/SPEC-v3.md, unreleased); kitcap network-policy@2, credential@1 (research/sources/kit-capabilities.md); rel-sbx v0.47.0 (research/sources/sbx-releases.md); capture/fixtures/kits/hello-kit/kit.yaml; capture/out/12-policy-kit.json, 12-policy-kit.txt, 12-check-kit.json
