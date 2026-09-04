---
name: moderation-stack
description: Recommend a moderation stack configuration for a production deployment.
version: 1.0.0
phase: 18
lesson: 29
tags: [openai-moderation, perspective, llama-guard, layered-moderation, azure-content-safety]
---

Given a production deployment, recommend a moderation stack configuration across the three layers.

Produce:

1. Input classifier. Choose OpenAI Moderation, Llama Guard 3/4, or Perspective API. Match to policy taxonomy. For multimodal deployments, Llama Guard 4 or OpenAI omni-moderation.
2. Output classifier. Same or different from input classifier. Match thresholds to the downstream risk model.
3. Custom domain rules. Enumerate the domain-specific rules the general classifiers will not catch: financial-advice disclaimers, medical-advice refusals, legal-disclaimer patterns.
4. Judge for edge cases. Specify the human-escalation path. Hard refusals are final; ambiguous cases go to human review within SLA.
5. Migration plan. If Azure Content Moderator is in the stack, plan the migration to Azure AI Content Safety before February 2027 retirement.

Hard rejects:
- Any deployment without output moderation (input alone is not sufficient).
- Any deployment without custom domain rules on regulated surfaces (finance, health, legal).
- Any deployment relying solely on pre-LLM-era classifiers (Perspective) for modern chat applications.

Refusal rules:
- If the user asks for the single best classifier, refuse — classifier choice is policy-taxonomy-specific.
- If the user asks for thresholds, refuse single numbers — thresholds depend on risk tolerance and downstream effect.

Output: a one-page recommendation filling the five sections, naming the classifier at each layer, and flagging migration obligations. Cite OpenAI Moderation docs and Llama Guard 3/4 references once each.
