---
id: exfil-through-an-allowed-host
title: The allowlist that still lets the repository leave
card: sandboxes
kind: design
level: 4
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, system-design]
tags: [sandbox, network-policy, exfiltration, http-rules, proxy]
minutes: 12
lessons: []
manuals: [docker-sandboxes-101#s-sbx-policy-log-and-the-proxy, docker-sandboxes-101#s-com-docker-sandbox-capabilities, docker-sandboxes-101#s-org-policies-profiles-and-the-audit-log]
practice: []
cheatsheet: [sandbox-policy, ai-security-incidents]
related: [sandboxes/blocked-host-reads-as-timeout, sandboxes/kit-grants-union-and-widen, sandboxes/governance-narrows-never-widens]
updated: 2026-11-03
---

The balanced preset allows `github.com:443` and `**.github.com:443`. A reviewer argues that an agent which reads a private repository can post its contents into an issue or a gist on that same allowed host, so the allowlist is theatre. Evaluate the claim, state what the product can and cannot see on that connection, and design the narrowing.

## Short answer

The claim holds for host rules: a host allow permits every request to that host with any method, path and body, the vendor's own staff said in 2026 that an issue body or a gist on an allowed host is not blocked, and the manual records the claim as disputed with no capture that tests it. On an allowed connection the proxy runs `forward-bypass`, a tunnel with no inspection and no credential injection; it terminates TLS only to speak on a blocked host or to inject on a host with a bound credential. The narrowing is an HTTP rule, a kit's `network-policy@2` entry with `methods` and `paths` or an organization HTTP rule, plus less to read in the first place: clone mode with secrets outside the repository, and deny-all with approvals so an unexpected host waits for a person.

## Full answer

### What the proxy sees, and when

Agents send HTTP and HTTPS through a forward proxy, and other TCP is forwarded transparently; both paths enforce policy. The guest trusts the proxy's certificate authority, which is why a blocked host gets a `403` inside TLS with an approval body. After an allow, the recorded request got `HTTP/1.0 200 Connection established` and then the origin's own `HTTP/2 200`, and the log classed it `forward-bypass`. So on the path the reviewer worries about, the proxy is a pipe. `policy log` keeps one row per host with a request count, not a body.

### What a host rule cannot say

A deny covers TCP, UDP and the name lookup, and ICMP cannot be allowed. An allow says nothing about method or path. The product's answer is the HTTP rule: a `network-policy@2` entry with `hosts`, `methods` and `paths` grants those requests and nothing else, a deny entry can refuse one method on one host, and the proxy answers a refused request with `403`. A network allow is a ceiling that HTTP rules carve into. Two limits follow. Neither `check network` nor `policy log` evaluates a method or a path, so the only test is a real request. And the local `--method` and `--path` flags are absent from the v0.47.0 help, so HTTP rules come from kits or from an organization policy.

### What governance adds

An organization network rule can be HTTP, one destination with methods and path patterns, and it can require approval. Under governance only organization allows grant, so a developer cannot re-widen the host. The audit record for `http_request` carries method, host, port and path, which is the first place the request shape becomes visible after the fact, and still never the body.

### The design

1. Reduce the readable set: clone mode, no secrets in the repository, mountless where the task allows.
2. Replace the host allow for the code host with bounded entries: read paths with `GET`, the one write path the workflow needs with `POST`, a deny for the rest.
3. Keep deny-all or balanced with approvals, so a new destination is a human decision that leaves a `created_via: approval` rule.
4. Put the bounded rules in a kit or an organization policy, pin the kit, and treat any new allow as a widening that stops.
5. Test with a real `DELETE` and a real post to a path outside the grant, expecting `403`, and keep the `policy log` rows as the record of hosts reached.

What remains open is stated plainly: a bounded `POST` to the one write path is still a channel. The design shrinks the channel to the request the workflow needs and makes every other destination a decision.

## Follow-ups

- **Level 3:** Why does the proxy not read the body of an allowed request even though it holds a CA the guest trusts? Expected: it terminates TLS only when it has to speak or inject; an allowed host without a bound credential is a `forward-bypass` tunnel.
- **Level 4:** Where is a method rule enforced, and where can you see that it fired? Expected: enforced by the proxy from a kit or organization rule, visible as a `403` to the request and in an organization audit record, not in `check network` or `policy log`.
- **Level 4:** The workflow must open pull requests. Write the minimum grant. Expected: bounded `GET` entries for the read paths, one bounded `POST` for the pull-request path, a deny for `DELETE`, and clone mode so the readable set is the repository alone.

## Wrong answers

- "Deny the main host and allow only the API host." It is still a host allow; any body to that host passes.
- "The proxy has a CA, so it inspects everything." It intercepts only to block or to inject; the allowed path is a tunnel.
- "`policy log` will show the leak." It shows the host and a count; the body never appears anywhere.

## Taught in

The [proxy section](../../../manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md) records the tunnel and the limits of a host-level allow, the [capabilities section](../../../manuals/docker-sandboxes-101/sections/4-2-com-docker-sandbox-capabilities.md) defines the bounded entries, and the [governance section](../../../manuals/docker-sandboxes-101/sections/7-2-org-policies-profiles-and-the-audit-log.md) shows the `http_request` audit payload.
