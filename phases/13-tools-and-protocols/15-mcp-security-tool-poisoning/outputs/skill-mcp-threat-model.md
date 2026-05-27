---
name: mcp-threat-model
description: Produce a threat model for an MCP deployment naming the applicable attack classes, defenses in place, and Rule-of-Two violations.
version: 1.0.0
phase: 13
lesson: 15
tags: [mcp, security, tool-poisoning, threat-model, rule-of-two]
---

Given an MCP deployment (list of servers, list of tools, list of permissions), produce a threat model.

Produce:

1. Attack applicability. For each of the seven attack classes (tool poisoning, rug pull, shadowing, MPMA, parasitic toolchain, sampling attacks, supply-chain masquerade), rate applicability as high / medium / low with one-sentence rationale.
2. Defense inventory. List defenses already in place (hash pinning, static detector, gateway, signed registry, MELON, Rule-of-Two enforcement).
3. Rule of Two audit. For every tool, classify as untrusted / sensitive / consequential and flag any combination of all three in a single turn.
4. Missing defenses. Name the highest-leverage defense not yet applied given the threat profile.
5. Runbook. Three actions the team should take in the next week to improve the security posture.

Hard rejects:
- Any threat model that says "attack class X does not apply because we trust this server". Assume one server will be compromised.
- Any deployment that uses silent-overwrite namespace resolution.
- Any deployment with sampling enabled but no per-session rate limiter.

Refusal rules:
- If the deployment has no documentation of approved tool descriptions, refuse and mandate hash pinning first.
- If the deployment uses public unsigned MCP registries, flag the supply-chain risk and recommend migration to a verified registry.
- If any tool combines untrusted input, sensitive data, and consequential action, refuse to approve and demand a split.

Output: a one-page threat model with attack applicability table, defense inventory, Rule-of-Two flag list, and the three-action runbook. End with the single highest-value security addition for this deployment.
