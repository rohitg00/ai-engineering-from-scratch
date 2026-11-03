---
id: implicit-deny-looked-like-an-outage
title: An implicit deny that looked like an outage
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [sandbox, network-policy, proxy, deny, agent-failure-modes]
minutes: 20
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: [docker-sandboxes-101#s-sbx-policy-init-allow-deny-and-check-network, docker-sandboxes-101#s-sbx-policy-log-and-the-proxy]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: sbx v0.47.0
  model: none; shell commands inside the sandbox
  hardware: one Mac with the microVM runtime
source:
  - manuals/docker-sandboxes-101/capture/out/09-blocked.txt
  - manuals/docker-sandboxes-101/capture/out/09-check-verbose.json
  - manuals/docker-sandboxes-101/capture/out/09-policy-log.txt
  - manuals/docker-sandboxes-101/capture/out/09-allow.txt
  - manuals/docker-sandboxes-101/capture/out/09-allowed.txt
  - manuals/docker-sandboxes-101/capture/out/09-blocked-by-rule.txt
  - manuals/docker-sandboxes-101/capture/out/09-deny-conflict.txt
  - manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md
  - manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md
---

## Situation

A shell agent in a sandbox is asked to fetch a page from `example.com` as the first step of a larger task. It reports back that the network is down inside the sandbox and asks the operator to repair the connection. The operator pastes the agent's command into `sbx exec` and gets a reply within a second, so nothing timed out. The sandbox was created with the balanced preset and no rule of its own.

The team's first guess is a broken proxy, because the reply holds two status lines that disagree. The second guess is a DNS failure. You have the two requests the operator ran, the policy check for that host, the policy log, and the commands that changed the rules afterwards.

## Evidence

- [a HEAD request and a GET request to example.com from inside m101-policy](evidence/what-the-agent-saw.txt)
- [the decision for example.com from sbx policy check network](evidence/check-network-before-any-rule.txt)
- [the policy log of m101-policy](evidence/the-policy-log.txt)
- [a sandbox-scoped allow rule and the policy list after it](evidence/one-allow-rule-later.txt)
- [the HEAD request after the allow rule](evidence/the-same-request-after-the-allow.txt)
- [the GET request after a deny rule replaced the allow](evidence/an-explicit-deny-reads-differently.txt)
- [a deny rule added while the allow rule still exists](evidence/a-deny-against-an-existing-allow.txt)

## Questions

1. The HEAD request printed two status lines and exited 0. Which component sent each line, and why is the exit code 0?
2. The check says implicit and names no rule. What decided the request?
3. The log shows two allowed hosts with different proxy paths. What does forward-bypass tell you?
4. After the allow rule, what changed in the first status line of the same request?
5. An explicit deny gives a different body. How do you tell the two denials apart from inside the sandbox and from the host?
6. Why was the deny rule refused the first time, and what is the right order of operations?

## Walkthrough

1. **Read the HEAD request line by line.** `HTTP/1.1 200 OK` is the forward proxy accepting the `CONNECT`. The `HTTP/1.1 403 Forbidden` below it arrived inside the TLS session, with a 90 byte plain text body, under a certificate the sandbox trusts. curl printed both and exited 0 because it received a complete reply. The GET shows the body: an approval is required for `example.com:443`. Nothing was slow and nothing was unreachable. A proxy answered with a decision.
2. **Ask the authorizer.** `sbx policy check network` runs the same authorizer as the proxy, without sending anything. For this host in the sandbox context it returns `allowed: false`, `deny_kind: implicit`, the reason `No matching allow rule (default deny)`, and no rule. The balanced preset lists 194 hosts, and `example.com` is not one of them. The request matched nothing and was denied by default.
3. **Read the log.** The blocked row names the host, the proxy path `forward`, the rule text `no applicable policies for op(...)` and the same reason. Two allowed rows show what the preset admits: a package host over `forward`, and a download host over `forward-bypass`, a tunnel that the proxy does not inspect. The log says what passed, and the check says why.
4. **Add the narrow rule.** `sbx policy allow network --sandbox m101-policy example.com` adds a rule in the local scope for that one sandbox, and `policy ls` then counts 195 hosts. The same HEAD request now begins with `HTTP/1.0 200 Connection established`, and the origin's `HTTP/2 200` follows. The proxy tunnels the connection and no longer speaks.
5. **Compare the two denials.** With a deny rule in place of the allow, the GET body reads `Blocked by local rule for example.com:443`. The implicit one asks for an approval. On the host, the check reports `deny_kind: explicit` with the rule id for the second case, and `implicit` for the first.
6. **Mind the order.** The deny for `example.com` was refused while the allow for the same host existed in the same scope, and the error named the allow rule. Remove the allow first, then add the deny. Deny wins at evaluation time, but the CLI does not store the pair.

## Resolution

There was no outage. `example.com` is not on the allow list of the balanced preset, which has 194 hosts. The proxy denied the connection as an implicit default and answered inside TLS with a 403 and an approval message. A sandbox-scoped allow rule turned the same request into a tunnelled 200 from the origin. The agent's report was wrong in the way the lesson on failure modes predicts: it read one status code and reported a cause it had not checked.

Fixes:

1. Change the agent's instructions so that a 403 with an approval body is reported as a policy decision, with the host and the port, so the operator can add a rule.
2. Run `sbx policy check network --sandbox NAME host:port --json` before you touch the network, and read `deny_kind` and `rule`.
3. Add rules with `--sandbox` for one agent, and keep the global policy for hosts every agent needs. Before you add a deny in a scope, remove any allow for that host in that scope.

## Wrong turns

- "Restart the daemon, the proxy returns two different codes." Both lines are the proxy doing its job: the first accepts the tunnel, the second refuses the host. A restart changes no rule.
- "It is DNS, because example.com does not resolve." The request reached the proxy with the host name, and the proxy denied the host by policy. The body, the check and the log all name the host and the port.
- "Allow example.com globally so this stops." A global rule admits the host for every sandbox. The local scope exists for one agent's need.
- "Add a deny rule now so the agent cannot try again." The deny conflicts with the allow in the same scope and is refused, and the agent's task needed the host. Fix the report, not the host.

## Generalize

An agent that reports a failure gives you a claim, not a diagnosis. Reproduce the call outside the agent, read the whole reply and not only the first status line, and ask the policy layer for its decision before you look for a fault in the network. A deny with a body is an answer. A timeout is a fault.

## Taught in

[The policy page](../../../manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md) explains the scopes and `check network`, [the proxy page](../../../manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md) reads the 403 and the log, and [the failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names the mode where an agent reports a cause it did not check.
