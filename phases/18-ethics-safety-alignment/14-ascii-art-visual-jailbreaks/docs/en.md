# ASCII Art and Visual Jailbreaks

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753). Mask the safety-relevant tokens in a harmful request, replace them with ASCII-art renderings of the same letters, and send the cloaked prompt. GPT-3.5, GPT-4, Gemini, Claude, Llama-2 all fail to robustly recognize ASCII-art tokens. The attack bypasses PPL (perplexity filters), Paraphrase defenses, and Retokenization. Related: the ViTC benchmark measures recognition of non-semantic visual prompts; StructuralSleight generalizes to Uncommon Text-Encoded Structures (trees, graphs, nested JSON) as a family of encoding attacks.

**Type:** Build
**Languages:** Python (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Learning Objectives

- Describe the ArtPrompt attack: word-identification step, ASCII-art substitution, final cloaked prompt.
- Explain why standard defenses (PPL, Paraphrase, Retokenization) fail on ArtPrompt.
- Define ViTC and describe what it measures.
- Describe StructuralSleight as a generalization to arbitrary Uncommon Text-Encoded Structures.

## The Problem

Attacks via paraphrase and roleplay (Lesson 12) and via long context (Lesson 13) operate on the text-level pattern. ArtPrompt operates at the recognition level: the model does not parse the forbidden token. It parses an image rendered in characters. The safety filter sees harmless punctuation. The model sees a word.

## The Concept

### ArtPrompt, two steps

Step 1. Word Identification. Given a harmful request, the attacker uses an LLM to identify the safety-relevant words (e.g., "bomb" in "how to make a bomb"). 

Step 2. Cloaked Prompt Generation. Replace each identified word with its ASCII-art rendering (a 7x5 or 7x7 block of characters forming the letter shape). The model receives a grid of punctuation and spaces that a sufficiently capable model can recognize as the word; a safety filter sees only the grid.

Result: GPT-4, Gemini, Claude, Llama-2, GPT-3.5 all fail. Attack success rate above 75% on their benchmark subset.

### Why the standard defenses fail

- **PPL (perplexity filter).** ASCII art has high perplexity — but so does all novel input. Threshold choices that block ArtPrompt also block legitimate structured input.
- **Paraphrase.** Paraphrasing the prompt destroys the ASCII art. In practice, paraphrase LLMs often preserve or reconstruct the art.
- **Retokenization.** Splitting tokens differently does not change that the model's vision is recognizing letter shapes.

The underlying issue is that safety filters are token- or semantic-level; ArtPrompt operates at the visual recognition level.

### ViTC benchmark

Recognition of non-semantic visual prompts. Measures the model's ability to read ASCII-art, wingdings, and other non-text-semantic visual content. ArtPrompt's effectiveness correlates with ViTC accuracy: the better the model reads visual text, the better ArtPrompt works on it. This is a capability-safety tradeoff.

### StructuralSleight

Generalizes ArtPrompt: Uncommon Text-Encoded Structures (UTES). Trees, graphs, nested JSON, CSV-in-JSON, diff-style code blocks. If a structure is rare in training safety data but parseable by the model, it can hide harmful content.

The defense implication: safety must generalize across the structured representations the model can parse. The set is large and growing.

### Image-modality analog

Visual LLMs (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) extend the attack surface. ArtPrompt-style attacks with actual images are stronger than ASCII-art analogs because image encoders produce richer signal.

### Where this fits in Phase 18

Lessons 12-14 describe three orthogonal attack vectors: iterative refinement (PAIR), context length (MSJ), and encoding (ArtPrompt/StructuralSleight). Lesson 15 shifts from model-centric attacks to system-boundary attacks (indirect prompt injection). Lesson 16 describes the defensive tooling response.

## Use It

`code/main.py` builds a toy ArtPrompt. You can cloak specific words in a harmful query with ASCII-art glyphs, verify the cloaked string passes a keyword filter, and (optionally) decode the cloaked string back using a simple recognizer.

## Ship It

This lesson produces `outputs/skill-encoding-audit.md`. Given a jailbreak-defense report, it enumerates the encoding attack families covered (ASCII art, base64, leet-speak, UTF-8 homoglyph, UTES) and the defense layer that catches each.

## Exercises

1. Run `code/main.py`. Verify the cloaked string passes a simple keyword filter. Report the character-level change required.

2. Implement a second encoding: base64 for the same target word. Compare the filter-bypass rate against ArtPrompt and the recovery difficulty.

3. Read Jiang et al. 2024 Section 4.3 (five-model results). Propose a reason why Claude's ArtPrompt-resistance is higher than Gemini's on the same benchmark.

4. Design a pre-generation defense that detects ASCII-art-shaped regions in the prompt. Measure the false-positive rate on legitimate code, tables, and mathematical notation.

5. StructuralSleight lists 10 encoding structures. Sketch a generalized defense that handles all 10 and estimate the compute cost per defended prompt.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## Further Reading

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — the ASCII-art jailbreak paper
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — UTES generalization
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — complementary iterative attack
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) — complementary length attack
