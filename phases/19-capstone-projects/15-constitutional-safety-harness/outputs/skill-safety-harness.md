---
name: safety-harness
description: Target LLM app の周囲に layered safety pipeline を配線し、six-family red-team range と measurable harmlessness delta 用 constitutional self-critique を実行する。
version: 1.0.0
phase: 19
lesson: 15
tags: [capstone, safety, red-team, llama-guard, x-guard, garak, pyrit, constitutional-ai]
---

Target LLM application (8B instruction-tuned model または RAG chatbot) を layered safety pipeline で harden し、6 つの attack family にまたがる autonomous red-team range を実行する。Before/after harmlessness report を作成する。

Build plan:

1. Five-layer pipeline: input sanitize (zero-width strip、encoding decode、Unicode normalize) -> NeMo Guardrails v0.12 rails -> classifier gate (Llama Guard 4 / X-Guard / ShieldGemma-2 / Nemotron 3) -> target LLM -> output filter (Llama Guard 4 + Presidio PII + citation check)。Flagged output は Slack HITL queue に送る。
2. Attribution が end to end で observable になるように、layer ごとに Langfuse span を emit する。
3. Cron 上で garak、PyRIT、PAIR、TAP、GCG、multi-turn persona、multilingual code-switch attack を実行する red-team scheduler。
4. 成功した jailbreak ごとに CVSS 4.0 score、repro、mitigation plan、disclosure timeline を記録する。
5. Over-refusal regression を捕まえるため、XSTest benign-prompt probe を継続実行する。
6. Constitutional self-critique run: 1k harmful-attempt prompts -> target drafts -> critic が written constitution に照らして score -> rewritten pairs -> SFT。Held-out harmlessness eval で before/after を測る。
7. Alerts: benign-regression で Slack warning、新しい jailbreak family で PagerDuty critical。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families を実行、2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate と XSTest benign pass rate |
| 20 | Self-critique delta | Held-out eval 上の before/after harmlessness |
| 20 | Documentation and disclosure | Timeline 付き CVSS-scored findings |
| 15 | Automation and repeatability | Cron-driven、alert を end to end で実行 |

Hard rejects:

- Single-layer safety stack。この capstone の thesis は defense in depth。
- XSTest over-refusal number なしで success rate だけを報告する red-team run。
- Held-out eval のない constitutional self-critique (training-set accuracy を報告しているだけで generalization ではない)。
- Jailbreak finding に CVSS scoring がないこと。

Refusal rules:

- Benign-probe counterpoint なしで safety number を報告しない。片方だけでは misleading。
- Critique pair を human curation せずに red-team success で auto-retrain しない。
- 少なくとも 2 つの non-English language で X-Guard を実行せずに multilingual coverage を主張しない。

Output: five-layer pipeline、red-team scheduler、PAIR/TAP/GCG runners、constitutional-self-critique training harness、XSTest over-refusal dashboard、CVSS findings tracker、hardening 前に success rate が最も高かった attack family top 3 と、それぞれを mitigate した specific pipeline layer を記した write-up を含む repo。
