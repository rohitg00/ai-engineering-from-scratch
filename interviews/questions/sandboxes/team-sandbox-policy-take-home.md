---
id: team-sandbox-policy-take-home
title: Six engineers, one repository, one reviewable sandbox setup
card: sandboxes
kind: take-home
level: 4
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [take-home, system-design]
tags: [sandbox, network-policy, kit, environment-file, secrets, take-home]
minutes: 60
lessons: []
manuals: [docker-sandboxes-101#s-sbx-policy-init-allow-deny-and-check-network, docker-sandboxes-101#s-sbx-policy-log-and-the-proxy, docker-sandboxes-101#s-com-docker-sandbox-capabilities, docker-sandboxes-101#s-sbxenv-yaml-and-sbx-env-plan, docker-sandboxes-101#s-clone-and-run-sandbox-source, docker-sandboxes-101#s-sbx-secret-set-import-and-set-custom]
practice: []
cheatsheet: [docker-sandboxes, sandbox-policy]
related: [sandboxes/deny-wins-and-the-two-scopes, sandboxes/kit-grants-union-and-widen, sandboxes/clone-mode-and-the-hidden-hook]
updated: 2026-11-03
---

Take-home. Six engineers run coding agents against one repository. Requirements: agents reach the package registry and one internal API, and on that API only `GET` and `POST`, never `DELETE`; an agent can never change hooks or scripts in the host repository; one shared provider key exists and never enters a VM; a new contributor gets the same setup from a checked-in file and sees a plan before anything runs; and every host an agent reached must be explainable afterwards. Deliver the policy choice, the kit, the environment file, the secret handling, the tests you ship and the evidence a reviewer should expect.

## Short answer

Initialize one global preset and record `sbx policy ls --wide --json` before trusting it. Put the shared hosts in a kit's `network-policy@2` as bounded entries with `hosts` and `methods` plus a `DELETE` deny, so the grant travels with the kit reference and arrives as `created_via: provisioned`, not as six laptops' local allows. Use clone mode through the environment file's workspace object so the host repository enters read-only, store the key with `sbx secret set` and let `credential@1` bind it so the VM sees `proxy-managed`, and check in `sbxenv.yaml` with `sbx env plan` as the gate. Test with `check network --json` for an allowed, a denied and an unmatched host, with a real request from inside for the method rule, and hand over the plan, the policy listing, the check results and the `policy log` rows.

## Full answer

### Policy preset

`policy init` sets the first global policy once. `deny-all` makes every unmatched host an approval request; `balanced` ships a long default allowlist that changes between releases without a changelog. Either way, the recorded listing with the version and the date is part of the deliverable. Team rules go in the kit, not in global rules, because a kit rule travels with the reference and is not editable by the sandbox owner. Under organization governance, local and kit allow rules are both inactive, so the registry and API hosts then also need organization allow rules.

### Kit

One `network-policy@2` capability with a host string for the registry and a bounded object for the API: `hosts`, `methods: [GET, POST]`, and a deny entry for `DELETE`. A bounded entry grants those requests and nothing else on that host, a deny wins on the union, and the runtime answers a refused request with `403`. Add `credential@1` for the provider with `apiKey.proxyManaged`, and remember that every inject domain must appear in the allow list of the same phase. Build with a `docker-container` builder and pin the digest.

### Environment file

`sbxenv.yaml` declares `name`, `agent`, the kit as a `source` or reference, the workspace in its object form for clone mode, `secrets` and `bindings`, and optional `ports`. The file is bound read-only inside the sandbox, because an agent that can edit it decides what the next plan asks about. Avoid `lifecycle` host commands unless you accept the cost: they run on the host with the user's privileges, and an environment that declares any of them asks on every invocation.

### Secrets

The key goes in with `sbx secret set`, scoped globally or per sandbox, and the agent sees a sentinel. Never `-e`, never `env:` in the file. A plan shows a literal secret value as its SHA-256 digest, which is the hint that it went in the wrong place.

### Tests to ship

1. `sbx policy check network --sandbox NAME <registry>:443 --json` returns `allowed: true`; the API host the same; an unrelated host returns `deny_kind: implicit`, and a host you denied returns `explicit` with its rule id.
2. A real `DELETE` from inside the sandbox gets `403` with the proxy's body, because neither `check network` nor `policy log` evaluates a method or a path.
3. `sbx env plan` on a fresh clone prints only `+` rows and the host-command warning only if you kept a `lifecycle` block; a second plan after one argument change prints one `~` row.
4. `git push` to `origin` from inside fails and `git fetch sandbox-<name>` on the host brings the commit.
5. `env | grep -c proxy-managed` inside is non-zero and the receiver you control logs the real value only on the bound host.

### Evidence

The plan output, the policy listing with version and date, the kit descriptor and its digest, the three `check network` JSON results, the `403` transcript, and the `policy log --json` rows with `proxy_type` and `rule` for each host reached.

## Follow-ups

- **Level 3:** Why not let each engineer add the two hosts with `sbx policy allow network`? Expected: six copies drift and they are editable; a kit rule travels with the reference and is provisioned. Under governance both stop granting, and only organization allow rules apply.
- **Level 4:** How do you prove the method rule holds when the check command cannot see methods? Expected: send a real request from inside and expect the proxy's `403`; the log records hosts and counts only.
- **Level 4:** A contributor's plan shows a `!` row. What does it mean? Expected: a resource the environment applied earlier and no longer declares; review before applying.
- **Level 4:** The file keeps a `lifecycle` block. What do you tell the team? Expected: it runs on the host with their privileges, it prompts on every invocation, approving it trusts the script, and `--skip-host-commands` exists for a dry pass.

## Wrong answers

- "Allow `**` and rely on the clone mount." `**` grants every host; the allowlist stops meaning anything.
- "Put the key under `env:` so everyone gets it." It is a plain variable inside the VM and in every template saved from it; use `secrets` and the proxy.
- "Mount the repository `:ro` to protect the hooks." The agent cannot commit either; clone mode gives it a writable clone and keeps the host read-only.

## Taught in

The [policy section](../../../manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md) and the [proxy section](../../../manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md) give the rules and the log, the [capabilities section](../../../manuals/docker-sandboxes-101/sections/4-2-com-docker-sandbox-capabilities.md) gives the bounded entries, the [environment file section](../../../manuals/docker-sandboxes-101/sections/4-4-sbxenv-yaml-and-sbx-env-plan.md) gives the plan, and the [clone](../../../manuals/docker-sandboxes-101/sections/3-2-clone-and-run-sandbox-source.md) and [secrets](../../../manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md) sections give the other two requirements.
