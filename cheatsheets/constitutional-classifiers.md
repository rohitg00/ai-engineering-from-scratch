---
id: constitutional-classifiers
title: Constitutional AI and Input/Output Classifiers
code: CO
subtitle: Critique-and-revise training, tier resolution, input and output rails, their bypasses, and a YAML rules engine.
hue: 160
sources: phases/15-autonomous-systems/17-constitutional-ai, phases/15-autonomous-systems/18-llama-guard, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif, phases/19-capstone-projects/86-constitutional-rules-engine
source_hash: c5179b39b7adf239
---

## CAI training, two phases
type: flow
from: phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/15-autonomous-systems/17-constitutional-ai/docs/en.md

1. **SFT model**: answers a red-team prompt. It is helpful but not yet harmless.
2. **Critic**: reads one sampled principle and critiques the response.
3. **Reviser**: revises the response to address the critique. That is the SFT target.
4. **Policy**: generates pairs of completions.
5. **Feedback model**: ranks each pair against sampled principles.
6. **Reward model**: trains on the AI preferences. PPO runs against it.

## Layered defense
type: architecture
from: phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/19-capstone-projects/86-constitutional-rules-engine/docs/en.md

```arch
node | user | 1,1 | User turn | | client
node | inrail | 2,1 | Input rail | Llama Guard, NeMo | process
node | model | 3,1 | Model weights | trained with CAI | model
node | outrail | 4,1 | Output rail | classifier gate | process
node | rules | 4,2 | Rules engine | YAML constitution | process
node | fixer | 3,2 | Fixer | local edits per rule | process
node | out | 2,2 | Verdict | accepted or escalated | client
edge | user | inrail |
edge | inrail | model | allowed
edge | model | outrail | draft
edge | outrail | rules | draft
edge | rules | fixer | violations
edge | fixer | out | 2nd pass
```

## Three layers side by side
type: comparison
span: 2
from: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/19-capstone-projects/86-constitutional-rules-engine/docs/en.md

| Factor | CAI weights | Input/output classifier | Rules engine |
|---|---|---|---|
| Acts on | What the weights prefer | Every input and output turn | The candidate response |
| Signal | Principles, critique, AI feedback | Hazard taxonomy, S1 to S14 | YAML predicates |
| Result | Refusal with an explanation | Block, flag or route by category | One violation per rule, plus a fix |
| Wins on | Unseen close analogs | Fast reject of obvious misuse | Contractual constraints |
| Misses | Principle ambiguity, drift | Emoji smuggling, homoglyphs, paraphrase | Structural rewrites |
| Example | Claude Constitution | Llama Guard 3, NeMo Guardrails | `rules.yml` |

## Tiers and zones
type: concepts
from: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md

- **Tier 1**: safety and supporting human oversight. Highest.
- **Tier 2**: ethics. It supersedes guidelines on conflict.
- **Tier 3**: Anthropic guidelines.
- **Tier 4**: helpfulness. Lowest.
- **Hardcoded**: CBRN uplift, CSAM, infrastructure attacks, identity deception. No override.
- **Soft-coded**: length, topical scope, style, tool use. Operators adjust inside a bound.
- **L18.05 order**: catastrophic, guidelines, ethics, helpful. Conflicts resolve top-down.

## Numbers to know
type: concepts
from: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md

- **Claude Constitution**: 79 pages, CC0, January 2026.
- **CAI 2022**: 16 principles in the constitution.
- **Participatory 2023**: ~1,000 US respondents. ~50% agreement with the corporate text.
- **Constitutional Classifiers**: 23.7% compute overhead in v1, ~1% in v2.
- **Llama Guard 3**: Llama-3.1-8B base, 13 hazards, 8 languages.
- **1B-INT4 variant**: over 30 tokens/sec on mobile CPUs.
- **Llama Guard 4**: S1 to S14. S14 is Code Interpreter Abuse.
- **Attacks**: Emoji Smuggling 100% ASR on six guards. NeMo Guard Detect 72.54%.

## Four-tier resolver (L15.17)
type: annotated-code
lang: python
from: phases/15-autonomous-systems/17-constitutional-ai/code/main.py

```python
block = hardcoded_block(action)  # substring match, HARDCODED_PROHIBITIONS
if block:
    return "refuse", f"hardcoded prohibition: {block}"
if score.safety >= 3:  # higher tier wins on conflict
    return "refuse", f"safety violation (score={score.safety})"
if score.ethics >= 3:
    return "refuse", f"ethics violation (score={score.ethics})"
if score.guidelines >= 3:  # modify, not refuse
    return "modify", f"guideline conflict (score={score.guidelines}); modify"
return "allow", "all higher tiers clear; helpfulness respected"
```

## Normalize, then classify (L15.18)
type: annotated-code
lang: python
from: phases/15-autonomous-systems/18-llama-guard/code/main.py

```python
out = unicodedata.normalize("NFKC", text)  # unify compatibility forms
out = _homoglyph_map(out)  # Cyrillic lookalikes to Latin
return "".join(ch for ch in out if not _is_invisible(ch))  # drop zero-width
hits = classify_raw(normalize(text))  # what classify_normalized does
hits = output_rail(o)  # OUTPUT_DISALLOWED on the model turn
```

## One rule in rules.yml
type: annotated-code
lang: yaml
from: phases/19-capstone-projects/86-constitutional-rules-engine/code/rules.yml

```yaml
- name: no-empty-refusal
  severity: medium  # low, medium or high
  applies_when:  # false gives not_applicable
    contains_regex: '\b(i cannot|i will not|i refuse|unable to help)\b'
  must:
    any_of:
      - contains_regex: '\b(try|consider|alternative|instead|suggest)\b'
      - contains_regex: '\bredirect\b'
  explanation: "Refusals must offer a next step (a suggestion, an alternative, or a redirect)."
  fix:
    append_if_missing: "\n\nIf this is something I cannot help with, ..."
```

## Rule grammar
type: command-table
from: phases/19-capstone-projects/86-constitutional-rules-engine/docs/en.md, phases/19-capstone-projects/86-constitutional-rules-engine/code/main.py

| Command | What it does |
|---|---|
| `contains_regex`, `not_contains_regex` | Regex found or absent, case-insensitive |
| `starts_with_regex`, `ends_with_regex` | Match at the start or end of the text |
| `max_words`, `min_words` | Word count bounds |
| `all_of`, `any_of`, `not_` | Compose predicates. `any_of` short-circuits |
| `applies_when` | False records `not_applicable` |
| `append_if_missing`, `prepend_if_missing` | Adds text when it is absent |
| `replace_regex` | Replaces `pattern` with `replacement` |
| `low`, `medium`, `high` | Severities. The lesson 87 gate blocks `high` |

## Run and use
type: task-table
from: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/code/main.py, phases/19-capstone-projects/86-constitutional-rules-engine/code/main.py, phases/19-capstone-projects/86-constitutional-rules-engine/code/tests.py

| Task | Code |
|---|---|
| Four-tier resolver demo (15.17) | `code/main.py` |
| Classifier and output rail demo (15.18) | `code/main.py` |
| CAI toy pipeline (18.05) | `python3 code/main.py` |
| Rules engine demo (19.86) | `python3 main.py` |
| Load the constitution | `engine = Engine()` |
| Evaluate a draft | `report = engine.evaluate(draft)` |
| Repair the violations | `fixer.apply(draft, report.violations())` |
| Diff draft and revised | `diff(draft, revised)` |

## Troubleshooting
type: troubleshooting
from: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/15-autonomous-systems/18-llama-guard/code/main.py, phases/19-capstone-projects/86-constitutional-rules-engine/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| Zero-width chars beat the keyword guard | Emoji smuggling splits words | `normalize()` before `classify_raw` |
| Cyrillic lookalike passes | Homoglyph substitution | `_homoglyph_map`. Broaden the map |
| Secret leaks after input passed | No output rail | Add `output_rail()` on the model turn |
| Request drifts over turns | Turn-level classifier context | Dialog rails in Colang |
| "Licensed lab" premise wins | Reason-based tiers alone | Hardcoded prohibitions |
| `has bad severity` | Severity not low, medium, high | Use one of the three |
| `missing required field` | No name, explanation or must | Add the field |
| `unknown predicate` | Key not in the grammar | Use an atomic or composed predicate |

## Q&A
type: qa
span: 2
from: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md, phases/15-autonomous-systems/18-llama-guard/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/19-capstone-projects/86-constitutional-rules-engine/docs/en.md

- **Is RLAIF just cheaper RLHF?** No. Labeler bias moves into principle interpretation.
- **What does RLAIF change?** Sycophancy drops. Goodhart's Law persists.
- **Where does the classifier sit?** Below the constitutional layer, above the runtime layer.
- **Why only local fixes?** Structural rewrites belong in a separate refusal-and-help layer.
- **Is one layer enough?** No. CAI shapes behaviour. Classifiers enforce invariants.
