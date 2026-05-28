---
name: finetuning-pipeline
description: ablation、quantization、2026 Model Openness Framework model card を含む、再現可能な data-to-SFT-to-DPO-to-serve fine-tuning pipeline を実行する。
version: 1.0.0
phase: 19
lesson: 07
tags: [capstone, fine-tuning, axolotl, trl, dpo, grpo, vllm, eagle-3, mof]
---

base model (Llama 3.3 8B、Qwen3 14B、または Gemma 3 12B) と task-specific dataset を受け取り、served endpoint と再現可能な model card を生成する single-command pipeline を構築する。

構築計画:

1. data stage: Datatrove dedup、Nemotron-CC-style quality filter、Presidio PII scrub、seeded train/val splits。
2. contamination check: MMLU-Pro、MT-Bench-v2、RewardBench-2 に対する MinHashLSH。overlap があれば拒否する。
3. SFT: ZeRO-3、Flash Attention 3、packed sequences、8xH100 上で2-3 epochs の Axolotl v0.8。
4. preference tuning: TRL 0.15 DPO (または verifiable rewards 付き GRPO) を1 epoch、beta sweep 付きで実行する。
5. quantize: GPTQ-INT4-Marlin + AWQ-INT4 + GGUF-Q4_K_M。
6. serve: EAGLE-3 speculative decoding (Red Hat Speculators または SGLang SpecForge の draft heads) 付き vLLM 0.7。queue-wait に基づく HPA を持つ K8s deployment。
7. eval: base/SFT-only/SFT+DPO/SFT+GRPO について lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。
8. safety: Llama Guard 4 pass rate、ShieldGemma-2 output filter。
9. 2026 Model Openness Framework に従い、data、training、eval、safety、reproducibility sections を含む model card を作成する。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Eval delta vs base | MMLU-Pro、MT-Bench-v2、task-specific benchmarks で測定された gain |
| 20 | Pipeline reproducibility | identical seeds で one-command rerun し、hash が一致すること |
| 20 | Data hygiene | dedup rate、PII scrub coverage、contamination check green |
| 20 | Serving efficiency | batch 1/8/32 の tokens/s、EAGLE-3 acceptance、$/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |

ハードリジェクト:

- MinHash contamination check を skip する pipeline。MMLU-Pro を training に漏らすのは典型的な eval-cheating failure mode。
- seed または YAML が添付されていない training run。reproducibility は必須。
- EAGLE-3 または equivalent speculative decoding configuration なしの serving。baseline tokens/s は2026年の基準ではない。
- safety eval の欠落。すべての fine-tune は Llama Guard 4 pass rate を伴う。

拒否ルール:

- lm-eval-harness commit SHA を添付せずに benchmark score を主張する model card の公開を拒否する。
- derivative models を禁じる license の data で fine-tune することを拒否する。MOF は data licensing を採点する。
- eval matrix 上で quality loss を測定せずに quantized model を出荷することを拒否する。

出力: pipeline orchestrator、Llama 3.3 8B と alternate base 1つの YAML、SFT と DPO の W&B run logs、quantized artifacts、served endpoint、3 benchmark eval matrix、safety eval、2026 MOF model card、検出して修正した上位3つの data-hygiene issue の write-up を含むリポジトリ。
