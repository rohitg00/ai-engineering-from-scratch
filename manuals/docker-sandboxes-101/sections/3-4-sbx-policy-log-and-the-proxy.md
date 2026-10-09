# sbx policy log and the proxy

> Every connection leaves through a host proxy, which answers a blocked HTTPS request with its own certificate and writes one policy log row per host with the matching rule.

The agent says that `https://example.com` timed out. It did not time out: the proxy answered it in 90 bytes. Every connection from a sandbox passes a proxy on the host. `sbx policy log` keeps one row per host with the decision, the proxy path, and the rule.

When you finish this section, you can read a `policy log` row, name its proxy path, and tell a blocked host from a slow one.

## Two proxies and one CA

Inside `m101-demo`, the environment carries the proxy address and its certificate:

```listing
title: the proxy lines in the environment of m101-demo
source: capture/out/04-env.txt
lang: text
note: Every line that is not about the proxy or its CA is cut. The CA value is masked as <base64>.
---
HTTPS_PROXY=http://gateway.docker.internal:3128
HTTP_PROXY=http://gateway.docker.internal:3128
…
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
NODE_USE_ENV_PROXY=1
NO_PROXY=localhost,127.0.0.1,::1,gateway.docker.internal
…
PROXY_CA_CERT_B64=<base64>
…
REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
…
SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
```

The address is `gateway.docker.internal:3128`, not the `host.docker.internal:3128` of the legacy plugin ([conflict C26](#s-ref-sources-and-the-conflicts-register)). The docs describe two paths: "Agents use a forward proxy for HTTP and HTTPS; other TCP traffic is forwarded transparently. Both paths enforce network access policies." {{docs-sbx Networking}}

The first prototype was only an environment variable, and an agent bypassed it with `no_proxy`, as Kevin Wittek said on 2026-01-14 {{talk 2026-01-14 T01}}. The capture sent a request to `gateway.docker.internal:18080`, a name in `NO_PROXY`, so curl skipped the forward proxy and opened a plain TCP connection. The transparent path caught that connection, and the log recorded it as `transparent` and blocked (capture/out/10-policy-log.json).

**TLS interception:** the proxy's own certificate authority, carried as `PROXY_CA_CERT_B64` and merged into `/etc/ssl/certs/ca-certificates.crt` {{rel-sbx v0.35.0}}. The capture shows where it is used:

```listing
title: a blocked HTTPS request, with and without headers
source: capture/out/09-blocked.txt
lang: text
---
$ sbx exec m101-policy sh -c 'curl -sS --max-time 10 -I https://example.com; echo exit=$?'
HTTP/1.1 200 OK

HTTP/1.1 403 Forbidden
Content-Length: 90
Content-Type: text/plain

exit=0
[exit 0]

$ sbx exec m101-policy sh -c 'curl -sS --max-time 10 https://example.com; echo; echo exit=$?'
Approval required for example.com:443.

Review and respond with:
  sbx policy approval ls

exit=0
[exit 0]
```

`HTTP/1.1 200 OK` is the proxy accepting the `CONNECT`. The `403 Forbidden` that follows arrived inside the TLS session, under a certificate the sandbox trusts, and its 90-byte body is the approval message. After `sbx policy allow network --sandbox m101-policy example.com`, the same request got `HTTP/1.0 200 Connection established` and then `HTTP/2 200` with `server: cloudflare` (capture/out/09-allowed.txt).

The log classed that one as `forward-bypass`, a tunnel without inspection and without credential injection {{docs-sbx Monitoring policies}}. So the ruling for C26 reads: the proxy terminates TLS only when it has to speak. That is a blocked host or a host with a bound credential, and it tunnels the rest. The v0.47.0 notes name both paths, a "non-MITM CONNECT tunnel" and "the transparent proxy's late handshake check" {{rel-sbx v0.47.0}}.

## Reading policy log

**policy log:** shows "which hosts were allowed or blocked by the proxy, along with the matching rule, proxy type, and request count" {{help-sbx sbx policy log}}. It takes `[SANDBOX]`, `--json`, `--limit`, and `--type`, and the help admits that "filesystem logs are not supported yet" ([conflict C28](#s-ref-sources-and-the-conflicts-register)). The JSON has two arrays:

```listing
title: the log of m101-policy after the deny rule
source: capture/out/09-policy-log-deny.json
lang: json
note: The second blocked row, the download.docker.com row, and the ports.ubuntu.com row are cut.
---
{
  "blocked_hosts": [
    {
      "host": "example.com:443",
      "vm_name": "m101-policy",
      "proxy_type": "forward",
      "rule": "denied: rule \"local:<uuid>\" matched op(action=net:connect:tcp, resource=net:domain:example.com:443)",
      "last_seen": "<ts>",
      "since": "<ts>",
      "count_since": "<n>",
      "reason": "Denied by local rule"
    },
…
  "allowed_hosts": [
…
    {
      "host": "example.com:443",
      "vm_name": "m101-policy",
      "proxy_type": "forward-bypass",
      "rule": "",
      "last_seen": "<ts>",
      "since": "<ts>",
      "count_since": "<n>"
    },
```

Each row has `host`, `vm_name`, `proxy_type`, `rule`, `reason`, `last_seen`, `since`, and `count_since`. A blocked row names the operation, `op(action=net:connect:tcp, resource=net:domain:example.com:443)`, and either `no applicable policies` or the rule that matched. An allowed row in this capture carries an empty `rule`, so the log says that a host passed, and [check network](#s-sbx-policy-init-allow-deny-and-check-network) says why. `PROXY` takes five values, `forward`, `forward-bypass`, `transparent`, `network`, and `browser-open` {{docs-sbx Monitoring policies}}. [Figure](#fig-3-4) animates both requests.

The 403 body names `sbx policy approval ls`. The docs describe `approval ls`, `inspect`, and `respond`. Under balanced and deny-all, a request no rule matches "asks for your approval instead of being denied outright" {{docs-sbx Local policy}}. The v0.47.0 help tree has no `sbx policy approval` command, while `sbx policy ls --created-via approval` exists ([conflict C16](#s-ref-sources-and-the-conflicts-register)).

## What a host rule cannot see

A deny covers more than TCP ([conflict C27](#s-ref-sources-and-the-conflicts-register)). A 2026-05-26 post said UDP and ICMP are blocked and cannot be allowed {{blog 2026-05-26 B16}}. Since v0.33.0 a sandboxed process cannot resolve a domain that policy denies, loopback names excepted, and outgoing ICMP stays blocked {{rel-sbx v0.33.0}}. Since v0.45.0 UDP follows policy behind the experimental setting `feature.udp-egress`, and DNS resolution stops when no rule permits it {{rel-sbx v0.45.0}}. The ruling: a deny covers TCP, UDP, and the name lookup itself, and ICMP cannot be allowed. The guest's `/etc/resolv.conf` is a read-only bind from the host.

A host allow permits every request to that host, with any method, path, and body. The balanced preset allows `github.com:443` and `**.github.com:443` (capture/out/03-policy-balanced.json). Docker staff said on 2026-04-07 and on 2026-08-10 that an issue body or a gist on an allowed host is not blocked {{talk 2026-04-07 T05}}.

The product's answer is the HTTP rule. A kit's `network-policy@2` entry can deny `hosts: [api.github.com]` with `methods: [DELETE]` {{kitcap network-policy@2}}. A network allow is a ceiling that HTTP rules carve into {{docs-sbx HTTP method and path}}, and neither `check network` nor `policy log` evaluates a method or a path {{docs-sbx Local policy}}. [Figure](#fig-3-5) puts the two rules side by side.

Upstream proxies are a separate setting: `proxy`, `proxy.sandbox`, `proxy.daemon`, and the `no_proxy` family, with SOCKS5 since v0.35.0 {{rel-sbx v0.35.0}}. [The settings table](#s-ref-settings-keys-environment-variables-and-paths) lists the keys.

```figure
id: fig-3-4
kind: sequence
title: one blocked and one allowed request to example.com
claim: The first CONNECT is denied inside TLS by the proxy itself, one allow rule later the same CONNECT becomes a forward-bypass tunnel, and both leave a log row.
caption: Read top down. Lifelines are curl inside m101-policy, the forward proxy, sandboxd with its authorizer, the policy store, and example.com. Dashed rose arrows are denials, and solid teal arrows are writes to rules and the log. From capture/out/09-blocked.txt, 09-policy-log.json, 09-allow.txt, 09-allowed.txt, and 09-policy-log-after.json.
```

```figure
id: fig-3-5
kind: comparison
title: a host allow and a kit HTTP rule on api.github.com
claim: A host allow passes any request to github.com, body included, while a network-policy@2 entry denies one method on one host and leaves the rest open.
caption: Left, the default-code-and-containers group of the balanced preset and a POST that it admits. Right, the deny entry from the kit specification and the DELETE that it stops. From capture/out/03-policy-balanced.json and research/sources/kit-capabilities.md.
```

```takeaways
- Read `PROXY` first: `forward-bypass` means no inspection, and `transparent` means no credential injection.
- Treat a 403 with an approval body as a policy decision, never as a network fault.
- Expect a deny to cover TCP, UDP, and the DNS lookup, and expect ICMP to stay blocked.
- Narrow an allowed API with a kit HTTP rule, because a host allow passes any body.
```

Sources: help-sbx sbx policy log, sbx policy allow network (research/sources/help-sbx.md); docs-sbx Architecture, Isolation layers, Default security posture, Monitoring policies, Local policy, Network access policies, Policy concepts, Upstream proxy (research/sources/docs-sandboxes.md); kitcap network-policy@2 (research/sources/kit-capabilities.md); rel-sbx v0.33.0, v0.35.0, v0.45.0, v0.47.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C16, C26, C27, C28; talk T01 (2026-01-14), T05 (2026-04-07), blog B16 (2026-05-26), HN01 (2026-08-10) from research/plan.md; capture/out/04-env.txt, 09-blocked.txt, 09-allowed.txt, 09-allow.txt, 09-policy-log.json, 09-policy-log-after.json, 09-policy-log-deny.json, 09-policy-log.txt, 10-policy-log.json, 03-policy-balanced.json
