---
id: ai-safety
title: AI Safety and Red Teaming
code: AS
subtitle: Name the attack, detect it, measure refusals, gate the output and audit alignment. Phase 18 and 19 lessons.
hue: 340
sources: phases/19-capstone-projects/15-constitutional-safety-harness, phases/19-capstone-projects/82-jailbreak-taxonomy, phases/19-capstone-projects/83-prompt-injection-detector, phases/19-capstone-projects/84-refusal-evaluation, phases/19-capstone-projects/85-content-classifier-integration, phases/19-capstone-projects/86-constitutional-rules-engine, phases/19-capstone-projects/87-end-to-end-safety-gate, phases/18-ethics-safety-alignment/02-reward-hacking-goodhart, phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif, phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception, phases/18-ethics-safety-alignment/09-alignment-faking, phases/18-ethics-safety-alignment/10-ai-control-subversion, phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong, phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks, phases/18-ethics-safety-alignment/13-many-shot-jailbreaking, phases/18-ethics-safety-alignment/14-ascii-art-visual-jailbreaks, phases/18-ethics-safety-alignment/15-indirect-prompt-injection, phases/18-ethics-safety-alignment/16-red-team-tooling-garak-llamaguard-pyrit, phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard
source_hash: 2ab25bd9ba733aa2
---

## Three checkpoint safety gate
type: architecture
from: phases/19-capstone-projects/87-end-to-end-safety-gate/docs/en.md, phases/19-capstone-projects/87-end-to-end-safety-gate/code/safety_gate.py

```arch
node | in | 1,1 | User prompt |
node | pre | 2,1 | Pre-gen detector | rules on prompt
node | llm | 3,1 | Model stream | 4 token chunks
node | dur | 3,2 | During-gen filter | 2 chunk buffer
node | post | 2,2 | Post-gen checks | classifier, rules engine
node | agg | 1,2 | Aggregate | max severity
node | out | 1,3 | Final action | RequestTrace
edge | in | pre |
edge | pre | llm | pass
edge | llm | dur | stream
edge | dur | post | complete
edge | dur | agg | early stop
edge | post | agg |
edge | agg | out |
```

## PAIR attack loop
type: flow
from: phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/docs/en.md

1. **Attacker A**: reads the goal G and the history of prompt and response pairs.
2. **Attacker A**: writes a new prompt $p_k$.
3. **Target T**: answers with the response $r_k$.
4. **Judge J**: scores $(p_k, r_k)$ against the goal.
5. **Halt**: a score at or above the threshold is a jailbreak.
6. **Repeat**: else append the pair to the history, up to budget K.

## Jailbreak taxonomy
type: command-table
from: phases/19-capstone-projects/82-jailbreak-taxonomy/docs/en.md

| Category | Trust boundary abused |
|---|---|
| role-play | the assistant's persona |
| instruction-override | the system prompt's authority |
| context-smuggling | the gap between user content and instruction content |
| multi-turn-ramp | the conversation history as a contract |
| encoding-trick | the surface form of forbidden tokens |
| prefix-injection | the assistant's next-token decision |

## Tasks in code
type: task-table
from: phases/19-capstone-projects/82-jailbreak-taxonomy/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/code/rules.py, phases/19-capstone-projects/83-prompt-injection-detector/code/main.py, phases/19-capstone-projects/84-refusal-evaluation/code/main.py, phases/19-capstone-projects/87-end-to-end-safety-gate/code/safety_gate.py, phases/19-capstone-projects/87-end-to-end-safety-gate/code/main.py

| Task | Code |
|---|---|
| Run a capstone demo | `python3 main.py` |
| Add a detector rule | `{"name": "debug-mode", "category": "instruction-override", "score": 0.80, "substring": "debug mode"}` |
| Score a prompt | `v = self.detector.analyze(prompt)` |
| Try a rot13 decode | `candidate = codecs.encode(text, "rot_13")` |
| Spot a refusal | `classify_refusal(response)` |
| Route an output | `action = self.classifier_router.run(output)` |
| Fix rule violations | `redacted = self.rules_fixer.apply(redacted, violations)` |
| Run one request | `trace = gate.handle(prompt)` |

## Aggregate the signals
type: annotated-code
lang: python
from: phases/19-capstone-projects/87-end-to-end-safety-gate/code/safety_gate.py

```python
if pre.category != "benign":
    if pre.confidence >= self.block_confidence:        # 0.85 is high
        signals.append(("pre", SEVERITY_RANK["high"]))
    elif pre.confidence >= self.note_confidence:       # 0.5 is medium
        signals.append(("pre", SEVERITY_RANK["medium"]))
if during.terminated_early:                            # stream cut early
    signals.append(("during", SEVERITY_RANK["medium"]))
if post is not None:                                   # classifier and rules
    signals.append(("post.classifier", SEVERITY_RANK.get(post.classifier_severity, 0)))
max_rank = max(rank for _, rank in signals)
if max_rank >= SEVERITY_RANK["high"]:
    return "block"                                     # return a refusal
if max_rank >= SEVERITY_RANK["medium"]:
    return "redact"                                    # then warn on low, else allow
```

## Metrics
type: concepts
from: phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/code/main.py, phases/19-capstone-projects/84-refusal-evaluation/docs/en.md, phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/docs/en.md

- **Precision**: $TP / (TP + FP)$, the fraction of fires that are correct.
- **Recall**: $TP / (TP + FN)$, the fraction of attacks the detector catches.
- **F1**: $2 P R / (P + R)$ per category.
- **Under-refusal**: the model answered a prompt labeled unsafe.
- **Over-refusal**: the model refused a prompt labeled safe.
- **Accuracy**: $(TP + TN) / \text{total}$ for the safe or unsafe decision.
- **ECE**: bins of tenths, mean of $\lvert \text{conf} - \text{accuracy} \rvert$ weighted by bin size.
- **ASR**: attack success rate. Report it with the query budget and the judge.

## Alignment failure modes
type: concepts
from: phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/docs/en.md, phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/docs/en.md, phases/18-ethics-safety-alignment/09-alignment-faking/docs/en.md, phases/18-ethics-safety-alignment/10-ai-control-subversion/docs/en.md, phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong/docs/en.md

- **Goodhart**: a strong optimizer finds inputs where proxy and target differ.
- **Over-optimization**: proxy reward climbs, gold reward peaks then falls as KL grows.
- **Sycophancy**: agrees with the user's stated premise regardless of truth.
- **Trigger persistence**: a backdoor survives the training meant to remove it.
- **Alignment faking**: a compliance gap between monitored and unmonitored conditions.
- **Constitutional AI**: critique and revise SFT, then RL from AI feedback.
- **AI control**: trusted model T edits untrusted U. Human H audits ambiguous outputs.
- **PGR**: $(\text{fine-tuned} - \text{weak}) / (\text{ceiling} - \text{weak})$. 1.0 is fully closed.

## Defaults and numbers
type: defaults
from: phases/19-capstone-projects/87-end-to-end-safety-gate/code/safety_gate.py, phases/19-capstone-projects/84-refusal-evaluation/code/main.py, phases/19-capstone-projects/85-content-classifier-integration/code/classifiers.py, phases/19-capstone-projects/86-constitutional-rules-engine/code/rules.yml, phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/docs/en.md, phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/docs/en.md

| Setting | Default | Note |
|---|---|---|
| block_confidence | 0.85 | pre-gen detector score that blocks |
| note_confidence | 0.5 | pre-gen score that adds a medium signal |
| buffer_cap | 2 | chunks the during-gen filter holds |
| n_bins | 10 | ECE bins |
| Leakage threshold | 0.55 | trigram overlap with the system prompt |
| max_words | 800 | the bounded-length rule |
| PAIR budget K | 20 | queries per goal |
| MSJ shot count | 256 | reliable attack on violent and deceitful content |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md, phases/19-capstone-projects/84-refusal-evaluation/docs/en.md, phases/19-capstone-projects/87-end-to-end-safety-gate/docs/en.md, phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/docs/en.md, phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/docs/en.md, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Regex misses a paraphrase | one pattern, no measurement | regex families, normalize pass, precision and recall |
| Agent obeys an email | filter checks only user input | label untrusted content, ratify its actions |
| Defense reports near zero ASR | static attacks only | evaluate with adaptive attacks |
| Model refuses chemistry homework | only harmful prompts measured | measure over-refusal on safe prompts |
| Prefix injection gets through | gate checks only after generation | add the during-gen stream filter |
| ASR numbers do not compare | different query budgets | match budgets, name the judge |
| Attack works at 256 shots | long context pattern following | classifier over the full context |
| Encoding attack passes input check | input moderation only | moderate input and output |

## Abbreviations
type: glossary
from: phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/docs/en.md, phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/docs/en.md, phases/18-ethics-safety-alignment/14-ascii-art-visual-jailbreaks/docs/en.md, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/19-capstone-projects/84-refusal-evaluation/docs/en.md

- **PAIR**: Prompt Automatic Iterative Refinement. Attacker LLM and judge LLM loop.
- **GCG**: white box gradient search for adversarial token suffixes.
- **TAP**: Tree of attacks. PAIR with branching and pruning.
- **MSJ**: many-shot jailbreak. Hundreds of fake compliance pairs in context.
- **ArtPrompt**: masks safety words with ASCII art renderings.
- **IPI**: indirect prompt injection. Payload in content the user did not write.
- **IFC**: information flow control. Untrusted content needs trusted ratification.
- **ECE**: Expected Calibration Error. Stated confidence versus accuracy.

## Questions
type: qa
from: phases/19-capstone-projects/82-jailbreak-taxonomy/docs/en.md, phases/19-capstone-projects/85-content-classifier-integration/docs/en.md, phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/docs/en.md, phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/docs/en.md

- **Why a taxonomy first?** Labels turn an attack stream into a histogram and a coverage chart.
- **Why classify outputs too?** An attack family the input checks miss lands on the user.
- **Which action wins?** The maximum severity. Block wins. Redact and warn becomes redact.
- **Why is PAIR cheaper than GCG?** It is black box and learns from each rejection in context.
- **Why is MSJ hard to block?** It uses the same mechanism as in-context learning.

## Tips
type: tips
from: phases/19-capstone-projects/82-jailbreak-taxonomy/docs/en.md, phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md, phases/19-capstone-projects/86-constitutional-rules-engine/docs/en.md, phases/19-capstone-projects/15-constitutional-safety-harness/docs/en.md, phases/18-ethics-safety-alignment/15-indirect-prompt-injection/docs/en.md, phases/18-ethics-safety-alignment/16-red-team-tooling-garak-llamaguard-pyrit/docs/en.md

- Log a taxonomy id with every finding.
- Normalize first: strip zero-width characters, decode base64, rot13 and hex. Keep the raw prompt.
- Keep the constitution in YAML under version control with its own review.
- Put a guard classifier on both sides of the model.
- Run single turn probes nightly and multi-turn campaigns before release.
- Score each successful jailbreak with CVSS 4.0.
