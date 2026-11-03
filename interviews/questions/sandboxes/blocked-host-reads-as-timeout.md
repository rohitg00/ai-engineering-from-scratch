---
id: blocked-host-reads-as-timeout
title: The host that timed out in 90 bytes
card: sandboxes
kind: debug
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, coding]
tags: [sandbox, network-policy, proxy, policy-log, tls]
minutes: 8
lessons: []
manuals: [docker-sandboxes-101#s-sbx-policy-log-and-the-proxy, docker-sandboxes-101#s-sbx-policy-init-allow-deny-and-check-network]
practice: []
cheatsheet: [docker-sandboxes, sandbox-policy]
related: [sandboxes/deny-wins-and-the-two-scopes]
updated: 2026-11-03
---

Your agent reports that `example.com` over HTTPS timed out inside the sandbox, and `npm install` fails with a connection error. The sandbox keeps no shell history. Show how you find out which rule decided, and prove that this was a policy decision and not a network fault.

## Short answer

It did not time out: the proxy accepted the `CONNECT`, then answered inside the TLS session with `403 Forbidden` and a 90-byte body that reads `Approval required for example.com:443`. Run `sbx policy log SANDBOX --json` and read the `blocked_hosts` row: `proxy_type`, the `rule` text and the `reason`. Then run `sbx policy check network --sandbox NAME example.com:443 --json` and read `deny_kind`, where `implicit` means no rule matched and the default denied, and `explicit` names the deny rule. Add an allow in the right scope, or remove the deny first.

## Full answer

### What curl shows

With `-I`, the request prints two status lines. `HTTP/1.1 200 OK` is the proxy accepting the tunnel. `HTTP/1.1 403 Forbidden` with `Content-Length: 90` arrives inside TLS, under the proxy's own certificate authority, which the guest trusts because `PROXY_CA_CERT_B64` is merged into `/etc/ssl/certs/ca-certificates.crt`. The agent read the body as a failure and called it a timeout.

After `sbx policy allow network --sandbox NAME example.com`, the same request gets `HTTP/1.0 200 Connection established` and then `HTTP/2 200` from the origin. The log classes that one as `forward-bypass`: a tunnel with no inspection and no credential injection. The proxy terminates TLS only when it has to speak, on a blocked host or a host with a bound credential.

### Reading the log

Each `blocked_hosts` row carries `host`, `vm_name`, `proxy_type`, `rule`, `reason`, `last_seen`, `since` and `count_since`. The `rule` text names the operation, `op(action=net:connect:tcp, resource=net:domain:example.com:443)`, and either `no applicable policies` or the rule that matched. An allowed row may carry an empty `rule`, so the log says that a host passed and `check network` says why. `PROXY` takes five values: `forward`, `forward-bypass`, `transparent`, `network` and `browser-open`.

### When npm cannot resolve the host

A deny covers more than TCP. Since v0.33.0 a sandboxed process cannot resolve a domain that policy denies, loopback names excepted, and since v0.45.0 DNS stops when no rule permits the host. Outgoing ICMP stays blocked and cannot be allowed. The card so far shows a denial only for `example.com`, and `registry.npmjs.org:443` is on the `balanced` default allowlist, so find the npm host in `blocked_hosts` first. If a row names it, the connection error from npm is the lookup failing, which looks like a network fault and is a policy decision. If no row names it, look for another cause.

### The bypass that is not one

A request to a name listed in `NO_PROXY` skips the forward proxy and opens a plain TCP connection. The transparent path catches it, blocks it, and the log records `transparent`. Both paths enforce the same policy.

## Follow-ups

- **Level 2:** An allowed row shows an empty `rule` field. Which command tells you which rule admitted it? Expected: `sbx policy check network` with the same context; the log records that a host passed and the check names the rule.
- **Level 2:** Is name resolution outside the policy? Expected: no; a denied domain does not resolve, and from v0.45.0 the lookup itself stops when no rule permits it.
- **Level 3:** `deny_kind` is `explicit`. What changes about the fix? Expected: a deny exists for that host in that scope, and the CLI refuses an allow that conflicts with it, so remove the deny first or move scope.
- **Level 3:** Why does `curl -I` print a 200 before the 403? Expected: the 200 is the tunnel being accepted, and the 403 is the proxy's own answer inside the TLS session it terminated.

## Wrong answers

- "The network is flaky, retry with a longer timeout." The proxy answered at once with a body that names the approval command; nothing waited.
- "Put the host in `NO_PROXY` so the request goes around the proxy." The transparent path catches the direct connection and blocks it; the log shows it as `transparent`.
- "The agent's TLS library is broken because the certificate is unknown." The guest trusts the proxy CA on purpose; that is how the 403 arrives inside TLS.

## Taught in

The [proxy section](../../../manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md) records the blocked and allowed requests and the log rows, and the [policy section](../../../manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md) shows the two kinds of denial from `check network`.
