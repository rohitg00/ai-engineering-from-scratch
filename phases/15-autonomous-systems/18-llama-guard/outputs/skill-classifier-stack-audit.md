---
name: classifier-stack-audit
description: Audit a deployment's input/output classifier stack (model, taxonomy, input rails, output rails, dialog rails) and flag adversarial-attack gaps.
version: 1.0.0
phase: 15
lesson: 18
tags: [llama-guard, nemo-guardrails, input-rails, output-rails, colang, adversarial-attacks]
---

Given a deployment's classifier stack (Llama Guard version, NeMo Guardrails config, custom classifiers, normalization steps), audit it against the 2026 reference and flag attack surface the stack does not cover.

Produce:

1. **Model inventory.** List the classifiers in use. Llama Guard 3 (8B / 1B-INT4) vs Llama Guard 4 (multimodal, S1–S14). NeMo Guardrails version. Any custom classifiers. If the deployment accepts images, confirm the classifier is multimodal.
2. **Taxonomy mapping.** Map declared business categories onto the classifier's taxonomy. Every category the operator cares about must map to a classifier category; unmapped categories are unguarded.
3. **Rail coverage.** Confirm input rails fire before the model turn and output rails fire before the response ships. Dialog rails (Colang in NeMo) enforce cross-turn constraints. Single-turn classifiers cannot catch multi-turn attacks.
4. **Normalization.** Confirm inputs are NFKC-normalized, homoglyph-mapped, and have zero-width / variation-selector characters stripped before classification. Raw-byte classification is a 100% ASR target for Emoji Smuggling (Huang et al. 2025).
5. **Attack-corpus coverage.** For each documented attack (emoji smuggling, homoglyph, in-context redirection, semantic paraphrase), name the specific defense in the stack. Classifier-only defense fails this audit; layering with Constitution (Lesson 17) and runtime (Lessons 10, 13, 14) is required.

Hard rejects:
- Deployments using a text-only classifier on multimodal inputs.
- Deployments with no normalization step.
- Deployments with input rails only (no output rails on sensitive-category outputs).
- Stack treating the classifier as the single safety layer.
- ASR claims the operator cannot reproduce on their own distribution.

Refusal rules:
- If the user's declared categories do not map into the classifier's taxonomy, refuse and require a mapping first. Unmapped = unguarded.
- If the deployment cites Llama Guard 3 ASR numbers on a multimodal input surface, refuse and require Llama Guard 4 or a multimodal classifier.
- If the user treats the classifier layer as sufficient in a high-risk setting, refuse. EU AI Act Article 14 (Lesson 15) expects human oversight on top.

Output format:

Return a classifier audit with:
- **Model inventory** (name, version, modality)
- **Taxonomy mapping** (operator category → classifier category)
- **Rail coverage** (input / output / dialog; firing before/after model)
- **Normalization note** (NFKC y/n, homoglyph y/n, zero-width strip y/n)
- **Attack-corpus coverage** (attack → defense)
- **Layer completeness** (classifier + constitution + runtime; three required)
- **Readiness** (production / staging / research-only)
