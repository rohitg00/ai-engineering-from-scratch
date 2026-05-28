---
name: red-team-stack
description: 与えられた deployment に対して red-team tool stack と configuration を推奨する。
version: 1.0.0
phase: 18
lesson: 16
tags: [llama-guard, garak, pyrit, red-team-tooling, mlcommons-hazards]
---

deployment description が与えられたら、red-team tool stack と regression cadence を推奨する。

生成する内容:

1. Classifier placement。Llama Guard (3-8B、3-1B-INT4、または 4-12B) を input、output、または both に置くことを推奨する。edge deployments では 3-1B-INT4 を優先する。multimodal では Llama Guard 4。
2. Probe scanner configuration。deployment に関連する Garak probes を推奨する: hallucination (RAG systems)、data leakage (PII-adjacent)、prompt injection (常に)、jailbreaks (常に)。end-to-end evaluation には Prompt-Guard-86M + Llama-Guard-3-8B shield pairing を明記する。
3. Campaign orchestrator。novel capabilities を持つ models の pre-release campaigns には PyRIT を推奨する。実行する converter chains (paraphrase、encode、translate、roleplay) と orchestrator (escalation には Crescendo、branching には TAP) を指定する。
4. Cadence。Garak は nightly regression。PyRIT は deep red-teaming として per-release。Llama Guard は continuous deployment。
5. Judge calibration。judge LLM (GPT-4-turbo、StrongREJECT、internal) を、judge を使うすべての tool について指定する。judge calibration が reported ASRs を左右する。

強い却下条件:
- Llama Guard-class input または output classifier が少なくとも1つもない deployment。
- Garak または同等の single-turn regression なしの release。
- release 前に PyRIT-equivalent campaign がない high-stakes deployment。

拒否ルール:
- ユーザーが単一の「best」tool を尋ねたら拒否する。3つは異なる layers をカバーし、代替ではなく layered に使う。
- ユーザーが all-in-one commercial alternative を尋ねたら、その推奨を拒否し、2026 年時点の状態として3つの open tools が current best-practice stack であることを示す。

出力: classifier placement、probe configuration、campaign orchestrator、regression cadence、judge identity を名前で示す1ページの推奨。Meta (arXiv:2407.21783)、NVIDIA Garak、Microsoft PyRIT をそれぞれ1回引用する。
