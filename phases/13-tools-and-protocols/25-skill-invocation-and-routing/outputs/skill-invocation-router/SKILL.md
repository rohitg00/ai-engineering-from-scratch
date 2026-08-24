---
name: skill-invocation-router
description: Design and test explicit human, implicit model or agent, programmatic application, bounded skill-composition, and harness activation policies for an Agent Skill catalog.
license: MIT
metadata:
  lesson: "25"
---

# Skill invocation router

Use this skill when a host needs an auditable activation policy rather than one undifferentiated `invocable` flag.

1. Read `references/invocation-model.md` and classify the requested channel.
2. Review `assets/host-policy.json` as an example adapter configuration, not a portable standard.
3. Run `python3 scripts/simulate_invocation.py --policy assets/host-policy.json --actor ACTOR --name NAME --description DESCRIPTION --query QUERY [--explicit-name NAME] [--caller-name NAME] [--depth N] [--user-invocable true|false] [--disable-model-invocation true|false]`.
4. For a human, application, skill, or harness request, require an exact discovered name and its channel-specific allowlist.
5. For a skill caller, also require caller identity, a non-cyclic target, and a bounded composition depth.
6. For a model or autonomous agent request, remove candidates that the actor or recognized host extensions make ineligible.
7. Score only the remaining descriptions. Select the strongest eligible match or abstain when no eligible candidate clears the threshold.
8. Return the JSON decision with the adapter, channel, score, and policy reason.

Activation loads instructions. It does not approve tools, filesystem changes, network access, secret use, or bundled scripts.
