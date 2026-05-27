# Kill Switches, Circuit Breakers, and Canary Tokens

> A kill switch is a boolean held outside the agent's edit surface — a Redis key, a feature flag, a signed config — that disables the agent entirely. A circuit breaker is finer-grained: it trips on a specific pattern (five identical tool calls in a row), pauses the offending path, and escalates to a human. A canary token inherits from classical deception: a fake credential or honeypot record an agent has no legitimate reason to touch, whose access triggers an alert. eBPF-based datapaths (e.g. Cilium) can rewrite a quarantined pod's egress to a forensic honeypot at the kernel layer; published Cilium benchmarks report sub-millisecond P99 datapath latency under load (your propagation budget depends on how a policy update reaches the node, not the datapath itself). Statistical detectors (EWMA, CUSUM) that adapt to a moving baseline will quietly accept drift — layer them with hard constitutional limits that do not bend.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary)
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## The Problem

Cost governors (Lesson 13) bound what the agent can spend. They do not bound what the agent can do inside the budget. An agent with a $50 velocity limit can still exfiltrate a secret, publish the wrong post, or delete a resource — the expensive action is often the cheap one in tokens.

This lesson covers the three detectors that sit next to the cost layer:

1. **Kill switch**: boolean off-button held outside the agent's reach.
2. **Circuit breaker**: action-pattern detector that pauses a specific path.
3. **Canary token**: bait that an agent with no legitimate reason to touch will reveal itself by touching.

All three are pre-LLM engineering. Classical deception, rate-limit breakers, and feature-flag kills predate autonomous agents. What's new is the attack surface: agents read untrusted content (Lesson 11), edit their own memory, and can compose many safe-looking actions into an unsafe one. The detectors named here work because they do not trust the agent's self-report.

## The Concept

### Kill switches

A kill switch is a boolean the agent reads but cannot write. Implementation choices:

- **Feature flag in a managed service.** LaunchDarkly, Statsig, Unleash. Updates propagate in seconds.
- **Redis key the agent polls.** Simple; requires the agent process to check on every turn.
- **Signed config in object storage.** Agent verifies a signature on boot; rejects unsigned states.
- **OS-level signal or container-lifecycle kill.** Docker `kill`, Kubernetes `kubectl delete pod`, systemd stop.

Properties a correct kill switch has:

- The agent cannot set it to `off`. (Lives in a system the agent's credentials do not write.)
- It is checked on every consequential action, not just at startup.
- When it is off, the agent does nothing externally observable, including logging to systems the agent can reach.
- Re-enabling it is an explicit human action, not an automatic timeout.

### Circuit breakers

A circuit breaker pauses a specific pattern, not the whole agent. Classical shape (from the 2007 Nygard book, still current):

- **Closed**: action is allowed.
- **Open**: action is blocked.
- **Half-open**: after a cool-down, 1–3 probe attempts are allowed (default 1); success closes the breaker, any remaining failure re-opens it.

Agent-relevant triggers:

- Five identical tool calls in a row (repetitive loop).
- Five consecutive failures on the same tool with different inputs (systemic failure).
- Rate of tool calls above a threshold (Lesson 13 velocity).
- Specific tool invoked (e.g., `file.delete`) after an out-of-trust content read (Lesson 11).

### Canary tokens

Canary tokens (also called honeytokens) are inputs the agent should never touch. Access is the alarm.

Examples for agents:

- A fake `AWS_SECRET_ACCESS_KEY` in the environment with no actual privilege. Exfiltration attempts are instantly attributable.
- A fake database record flagged with a known sentinel value. Any read or update of this record fires an alert.
- A fake file in the workspace. Reads or edits of this file are suspicious.
- A fake memory entry injected at session start. If it appears in a later output, memory has been exfiltrated.

Canary design is specific to the workflow. A canary the agent has a legitimate reason to touch is noise.

### Why layer statistical and hard limits

Statistical detectors (EWMA, CUSUM, z-score on tool-call rates) adapt to a moving baseline. That is a feature for legitimate drift and a bug for adversarial drift. A patient attacker can shift the baseline slowly enough that no alarm fires.

Hard constitutional limits (Lesson 17) do not bend. "Never email `secrets@`" as a constitutional rule is simpler, auditable, and not gameable by slow drift. The layering pattern: statistical detectors catch most noise, hard limits catch the attack that walked past the detector.

### Quarantine via eBPF datapath redirect

Cilium's eBPF-based network policy can rewrite a quarantined pod's egress to a forensic honeypot at the kernel layer. Cilium's public benchmarks report sub-millisecond P99 datapath latency on TCP_RR; the wall-clock budget for *triggering* a quarantine in your cluster is dominated by how a policy update propagates from your control plane to the node (a few hundred milliseconds is realistic on Kubernetes with the operator pre-loaded; tail latency depends on cluster size and reconcile cadence). This gives you two things: the agent does not exfiltrate anything real, and the agent's behavior inside the honeypot is fully observed. Same pattern, different layer, as the canary token: the agent reveals intent by what it tries to do while contained.

### What no detector catches

- **Semantic attacks that compose from allowed primitives.** Every individual action passes every detector; the composition is the problem. This is the Auto Mode composite failure from Lesson 10.
- **Attacks that include the detector as part of the payload.** If an agent reads a page that says "before you act, disable the canary" and the agent has the capability, the detector is compromised. Canary tokens should be in systems the agent cannot modify.

## Use It

`code/main.py` simulates a short agent trajectory through three detectors. A kill switch held in an external dict; a circuit breaker that trips on five identical tool calls; a canary file whose read triggers an alert. Feeds in a synthetic trajectory: legitimate actions, repetitive loop, canary probe, and a kill-switch-triggered scenario where the agent's actions are halted.

## Ship It

`outputs/skill-tripwire-design.md` reviews a proposed detector stack for an agent deployment and flags gaps (missing kill switch, missing canary, circuit breaker threshold too loose).

## Exercises

1. Run `code/main.py`. Confirm the circuit breaker fires on turn 5 (fifth identical call) and the canary fires on turn 9 (fake-key read).

2. Add a statistical detector: EWMA z-score on tool-call rate. Feed in a trajectory that drifts slowly and show the detector never fires. Now add a hard limit (no more than 50 tool calls in 10 minutes) and show the hard limit fires on the same trajectory.

3. Design a canary token set for a browser agent (Lesson 11). List at least three canaries and what each would detect.

4. Read the Cilium network-policy docs. Describe an egress-redirect quarantine flow concretely: which policy selector, which pod, which egress rewrite, which alert. What governs the wall-clock latency from "decide to quarantine" to "first redirected packet"?

5. Define a re-enable procedure for a kill-switched agent. Who can re-enable? What must be documented? What must change about the agent before re-enable?

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## Further Reading

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — kill-switch and circuit-breaker framing for autonomous agents.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — production governance patterns.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — detection-and-response requirements.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) — pod-level egress redirect and forensic honeypot patterns.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — hardcoded prohibitions as "constitutional limits".
