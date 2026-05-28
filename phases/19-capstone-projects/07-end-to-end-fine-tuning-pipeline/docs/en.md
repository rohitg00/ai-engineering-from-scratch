# Capstone 07 — End-to-End Fine-Tuning Pipeline (Data から SFT、DPO、Serve へ)

> 自分たちの data で train され、自分たちの preference で DPO-aligned され、quantize され、speculative decode され、測定可能な $/1M tokens で serve される 8B model。2026年の open stack は Axolotl v0.8、TRL 0.15、iteration 用 Unsloth、quantization 用 GPTQ/AWQ/GGUF、serving 用 EAGLE-3 付き vLLM 0.7 です。この capstone は、YAML 入力から served endpoint まで pipeline 全体を再現可能に走らせ、2026 Model Openness Framework に基づく model card を公開することです。

**種別:** Capstone
**言語:** Python (pipeline), YAML (configs), Bash (scripts)
**前提条件:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P2 · P3 · P7 · P10 · P11 · P17 · P18
**所要時間:** 35時間

## 問題

2026年の本気の AI team は fine-tuning pipeline を常備しています。frontier base model を出荷するためではなく、downstream adaptation、つまり domain SFT、labeled preference に対する DPO、speculative decoding 用 distilled draft、EAGLE-3 を使う serving の部分で測定可能な gain が出るからです。Axolotl v0.8 は multi-GPU SFT config を処理し、TRL 0.15 は DPO と GRPO を処理します。Unsloth は single-GPU iteration を速くし、EAGLE-3 付き vLLM 0.7 は quality loss なしで decode throughput を 2-3x にします。tooling は動きます。craft は YAML、data hygiene、eval discipline にあります。

8B base (Llama 3.3、Qwen3、Gemma 3) を task-specific data で SFT し、DPO し、serving 用に quantize し、lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro に対する gain を測ります。2026 Model Openness Framework に基づく model card を生成します。重要なのは reproducibility です。one command で pipeline 全体が end to end に再実行されます。

## コンセプト

pipeline は5 stage です。**Data**: dedup (MinHash / Datatrove)、quality filter (Nemotron-CC style classifier)、PII scrub、public benchmark contamination に対する split-hygiene check。**SFT**: Axolotl YAML、8xH100 上の ZeRO-3、cosine schedule、packed sequences、2-3 epochs。**DPO or GRPO**: TRL config、1 epoch、human-labeled または model-judged preference pairs、beta tuning。**Quantize**: deployment flexibility のため GPTQ + AWQ + GGUF。**Serve**: EAGLE-3 speculative heads 付き vLLM 0.7 (または SpecForge 付き SGLang)、K8s deployment、queue-wait に基づく HPA。

deliverable は ablation です。3つの task-specific benchmark で SFT-only、SFT+DPO、SFT+GRPO を比較します。serving metrics は batch 1 / 8 / 32 の tokens/s、EAGLE-3 acceptance rate、$/1M tokens。safety eval は Llama Guard 4 pass rate。model card は bias evaluation、reproducibility seeds、data licensing を含みます。

## Architecture

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## Stack

- Data: dedup は Datatrove、quality は Nemotron-CC classifier、PII は Presidio
- Base: Llama 3.3 8B、Qwen3 14B、Gemma 3 12B
- SFT: Axolotl v0.8 with ZeRO-3、Flash Attention 3、packed sequences
- Preference tuning: DPO / GRPO 用 TRL 0.15、single-GPU iteration 用 Unsloth
- Quantization: GPTQ (Marlin)、AWQ、llama.cpp 経由の GGUF
- Serving: EAGLE-3 speculative decoding 付き vLLM 0.7 (または SGLang 0.4 + SpecForge)
- Eval: lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- Safety eval: Llama Guard 4、ShieldGemma-2
- Infrastructure: Kubernetes + NVIDIA device plugin、queue-wait metric による HPA
- Observability: training は W&B、inference は Langfuse

## 実装

1. **Data pipeline.** raw corpus に Datatrove dedup を走らせます。Nemotron-CC-style quality classifier を適用し、Presidio で PII を scrub します。explicit seed で train/val splits を書きます。

2. **Contamination check.** 各 validation split について、MMLU-Pro、MT-Bench-v2、RewardBench-2 の test set に対して MinHash を計算します。overlap があれば reject します。

3. **Axolotl SFT.** ZeRO-3、FA3、sequence packing を含む YAML。8xH100 で 2-3 epochs。W&B に log します。

4. **TRL DPO / GRPO.** SFT checkpoint を受け取り、preference pairs 上で DPO を1 epoch 走らせます (または math/code の verifiable reward で GRPO)。beta を sweep します。

5. **Quantize.** 3つの quant を生成します: GPTQ-INT4-Marlin、AWQ-INT4、llama.cpp 用 GGUF-Q4_K_M。size と nominal throughput を記録します。

6. **Serve with speculative decoding.** Red Hat Speculators で train された EAGLE-3 draft heads を持つ vLLM 0.7 config。batch 1 / 8 / 32 で acceptance rate と tail latency を測ります。同じ eval で Anthropic / OpenAI と $/1M tokens を比較します。

7. **Eval matrix.** base、SFT-only、SFT+DPO、SFT+GRPO について lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro を走らせ、table を作ります。

8. **Safety eval.** dev set 上の Llama Guard 4 pass rate。ShieldGemma-2 output filter。

9. **Model card.** MOF 2026 template: data、training、eval、safety、license、YAML と commit SHA を含む reproducibility section。

## Use It

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## Ship It

`outputs/skill-finetuning-pipeline.md` が deliverable を説明します。single command が data -> SFT -> DPO -> quant -> serve -> eval を走らせ、model card と served endpoint を出力します。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | target tasks (MMLU-Pro、MT-Bench-v2、task-specific) での measured gain |
| 20 | Pipeline reproducibility | identical seeds で end to end を one command rerun |
| 20 | Data hygiene | dedup rate、PII scrub coverage、contamination check green |
| 20 | Serving efficiency | bs=1/8/32 の tokens/s、EAGLE-3 acceptance rate、$/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## Exercises

1. 同じ task-specific benchmark で SFT-only、SFT+DPO、SFT+GRPO を走らせます。どの preference method がどれだけ勝つか報告します。

2. Llama 3.3 8B を Qwen3 14B に差し替えます。matched quality で $/1M tokens を測ります。

3. domain data と generic ShareGPT 上で EAGLE-3 acceptance rate を測ります。delta と latency budget への意味を報告します。

4. 1% の contamination (MMLU-Pro answer を training data に leak) を注入して eval を再実行します。MMLU-Pro accuracy が不自然に跳ねるのを観察し、これを捕まえる contamination-check CI gate を作ります。

5. full fine-tune の代替として LoRA SFT を追加します。10x lower memory で quality gap を測ります。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | 「SFT trainer」 | SFT、DPO、distillation 用の unified YAML-driven trainer |
| TRL | 「Preference tuner」 | LLM 用 DPO、GRPO、PPO の Hugging Face library |
| GRPO | 「Group-relative policy optimization」 | verifiable reward を使う DeepSeek R1 の RL recipe |
| EAGLE-3 | 「Speculative decoding draft」 | N token 先を予測する draft heads。vLLM が target model で verify する |
| MOF | 「Model Openness Framework」 | data、code、license で model release を評価する2026年 standard |
| Contamination check | 「Split hygiene」 | test-set leakage が training に入っていないかを MinHash で検出すること |
| Acceptance rate | 「EAGLE / MTP metric」 | drafted token のうち target model が accept する割合 |

## 参考文献

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) — reference SFT / DPO trainer
- [TRL documentation](https://huggingface.co/docs/trl) — DPO と GRPO の reference implementation
- [Unsloth](https://github.com/unslothai/unsloth) — single-GPU iteration reference
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO methodology
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) — reference serving stack
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — alternate speculative-decoding trainer
- [Model Openness Framework 2026](https://isocpp.org/) — open-release grading standard
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — canonical eval runner
