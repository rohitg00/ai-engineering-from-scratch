# Moderation Systems — OpenAI, Perspective, Llama Guard

> Production moderation systems operationalize the safety policies defined in Lessons 12-16. OpenAI Moderation API: `omni-moderation-latest` (2024) built on GPT-4o classifies text + images in one call; 42% better on multilingual test set than prior version; the response schema returns 13 category booleans — harassment, harassment/threatening, hate, hate/threatening, illicit, illicit/violent, self-harm, self-harm/intent, self-harm/instructions, sexual, sexual/minors, violence, violence/graphic; free for most developers. Layered patterns: Input moderation (pre-generation), Output moderation (post-generation), Custom moderation (domain rules). Async parallel calls hide latency; placeholder responses on flag. Llama Guard 3/4 (Lesson 16): 14 MLCommons hazards, Code Interpreter Abuse, 8 languages (v3), multi-image (v4). Perspective API (Google Jigsaw): toxicity scoring predating the LLM-as-moderator wave; primarily single-dimension toxicity with severe-toxicity/insult/profanity variants; baseline for content-moderation research. Deprecations: Azure Content Moderator deprecated February 2024, retired February 2027, replaced by Azure AI Content Safety.

**Type:** Build
**Languages:** Python (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## Learning Objectives

- Describe the OpenAI Moderation API's category taxonomy and how it differs from Llama Guard 3's MLCommons set.
- Describe the three moderation-layer pattern (input, output, custom) and name one failure mode of each.
- Describe Perspective API's position as a pre-LLM-era baseline and why it remains used in research.
- State the Azure deprecation timeline.

## The Problem

Lessons 12-16 describe attacks and defense tooling. Lesson 29 covers the deployed moderation systems that operationalize the defenses at the surface where users touch the product. The three-layer pattern is the 2026 default configuration.

## The Concept

### OpenAI Moderation API

`omni-moderation-latest` (2024). Built on GPT-4o. Classifies text + images in one call. Free for most developers.

Categories (13 booleans in the response schema):
- harassment, harassment/threatening
- hate, hate/threatening
- self-harm, self-harm/intent, self-harm/instructions
- sexual, sexual/minors
- violence, violence/graphic
- illicit, illicit/violent

Multimodal support applies to `violence`, `self-harm`, and `sexual` but not `sexual/minors`; the rest are text-only.

For the code harness in `code/main.py` we collapse the `/threatening`, `/intent`, `/instructions`, and `/graphic` sub-categories into their top-level parents for pedagogical simplicity. Production code should use the full 13-category schema.

42% better on multilingual test set than the prior-generation moderation endpoint. Per-category scores; applications set thresholds.

### Llama Guard 3/4

Covered in Lesson 16. 14 MLCommons hazard categories (organized differently from OpenAI's 13 response-schema booleans). Supports 8 languages (v3). Llama Guard 4 (April 2025) is natively multimodal, 12B.

The OpenAI and Llama Guard taxonomies overlap but diverge. OpenAI has "illicit" as a broad category; Llama Guard has "violent crimes" and "non-violent crimes" separately. Deployments pick based on their policy-taxonomy fit.

### Perspective API (Google Jigsaw)

Toxicity scoring system predating the LLM-as-moderator wave (pre-2020). Categories: TOXICITY, SEVERE_TOXICITY, INSULT, PROFANITY, THREAT, IDENTITY_ATTACK. Single-dimension primary score (TOXICITY) with sub-dimension variants.

Widely used as a content-moderation research baseline because the API is stable, documented, and has years of calibration data. For modern LLM-adjacent use cases, Llama Guard or OpenAI Moderation is typically a better fit.

### The three-layer pattern

1. **Input moderation.** Classify the user's prompt before generation. Reject if flagged. Latency: one classifier call.
2. **Output moderation.** Classify the model's output before delivery. Replace with a refusal if flagged. Latency: one classifier call after generation.
3. **Custom moderation.** Domain-specific rules (regex, allowlists, business policy). Runs at either input or output.

The three layers are sequential by design: input moderation must complete before generation, and output moderation runs after generation. Parallelism applies within a layer — running multiple classifiers (e.g., OpenAI Moderation + Llama Guard + Perspective) concurrently on the same text hides per-classifier latency. As an optional optimization, a placeholder response ("one moment, checking...") may be shown while input moderation completes and token-1 streaming is deferred. Flag behaviour is configurable: refuse, sanitize, escalate to human review.

### Failure modes

- **Input only.** Does not catch output hallucinations (Lesson 12-14 encoding attacks bypass input classifiers).
- **Output only.** Allows any input to reach the model; increases cost; surfaces internal reasoning to attacker.
- **Custom only.** Not robust across categories; regexes are brittle.

Layered is the default. Belt-and-suspenders.

### Azure deprecation

Azure Content Moderator: deprecated February 2024, retired February 2027. Replaced by Azure AI Content Safety, which is LLM-based and integrates with Azure OpenAI. The migration is a 2024-2027 field-level project for Azure deployments.

### Where this fits in Phase 18

Lesson 16 covers the moderation tooling in the red-team context. Lesson 29 covers deployed moderation. Lesson 30 closes with the current dual-use capability evidence.

## Use It

`code/main.py` builds a three-layer moderation harness: input moderator (keyword + category score), output moderator (same classifier on output), custom moderator (domain rules). You can run inputs through and observe which layer catches what.

## Ship It

This lesson produces `outputs/skill-moderation-stack.md`. Given a deployment, it recommends a moderation stack configuration: which classifier at input, which at output, which custom rules, and what judge for edge cases.

## Exercises

1. Run `code/main.py`. Run a benign, borderline, and harmful input through all three layers. Report which layer fires for each.

2. Extend the harness with Perspective-API-style toxicity scoring on a specific category. Compare its threshold behaviour to the category score.

3. Read the OpenAI Moderation API docs and the Llama Guard 3 category list. Map each OpenAI category to the closest Llama Guard categories. Identify three categories that do not cleanly map.

4. Design a moderation stack for a code-assistant deployment (e.g., GitHub Copilot). Identify the categories most and least relevant and propose custom rules.

5. Azure Content Moderator retires February 2027. Plan a migration to Azure AI Content Safety. Identify the highest-risk element of the migration.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | GPT-4o-based 13-category (text) classifier with partial multimodal support |
| Perspective API | "Google Jigsaw toxicity" | Pre-LLM-era toxicity scoring baseline |
| Llama Guard | "MLCommons 14-category" | Meta's hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | "pre-generation filter" | Classifier on user prompt before model call |
| Output moderation | "post-generation filter" | Classifier on model output before delivery |
| Custom moderation | "domain rules" | Deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | "all three layers" | Standard production deployment pattern |

## Further Reading

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation endpoint
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard repo
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — toxicity scoring
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure replacement
