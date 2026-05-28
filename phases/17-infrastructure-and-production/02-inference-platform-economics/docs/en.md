# Inference Platform Economics — Fireworks, Together, Baseten, Modal, Replicate, Anyscale

> 2026年の inference market は、もはや GPU time rental ではありません。custom silicon（Groq、Cerebras、SambaNova）、GPU platforms（Baseten、Together、Fireworks、Modal）、API-first marketplaces（Replicate、DeepInfra）に分岐しています。Fireworks は2026年5月1日に GPU あたり $1/hr の値上げを行い、10T+ tokens/day を処理する $4B valuation は volume-driven model が成立していることを示します。Baseten は2026年1月に $5B valuation で $300M Series E を完了しました。competitive positioning の rule は単純です。Fireworks は latency、Together は catalog breadth、Baseten は enterprise polish、Modal は Python-native DX、Replicate は multimodal reach、Anyscale は distributed Python を最適化します。このレッスンでは、founder にそのまま渡せる matrix を作ります。

**種別:** 学習
**言語:** Python (stdlib, toy per-call economics comparator)
**前提条件:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (vLLM Serving Internals)
**所要時間:** 約60分

## Learning Objectives

- 3つの market segments（custom silicon、GPU platforms、API-first）を名前で説明し、各 vendor を segment に対応づける。
- "per-token" API pricing model が hardware ではなく serving engine の cost curve に収束する理由を説明する。
- 少なくとも3 vendor にまたがって effective cost per request を計算し、per-minute（Baseten、Modal）が per-token に勝つ条件を説明する。
- 与えられた workload（serverless bursty、steady high-throughput、fine-tuned variants、multimodal）に対して、どの platform が正しい default かを特定する。

## 問題

managed hyperscaler platform を評価しました。次に、より狭く速い provider が必要だと判断しました。latency なら Fireworks、breadth なら Together、fine-tuned custom model なら Baseten です。ここで6つの現実的な選択肢があり、pricing page の単位がそろっていません。Fireworks は $/M tokens、Baseten は $/minute、Modal は $/second、Replicate は $/prediction です。workload を model 化しない限り、正面から比較できません。

さらに悪いことに、各 pricing page の背後にある business model も違います。Fireworks は custom engine（FireAttention）を shared GPUs 上で動かします。per-token rate は utilization curve を反映します。Baseten は Truss + dedicated GPUs を提供します。per-minute は exclusivity を反映します。Modal は true Python serverless で、per-second billing と sub-second cold starts を提供します。同じ output（LLM response）でも、3つの異なる cost functions になります。

このレッスンでは6社を model 化し、それぞれがいつ勝つかを示します。

## The Concept

### The three segments

**Custom silicon** — Groq (LPU)、Cerebras (WSE)、SambaNova (RDU)。同じ model で GPU-based cluster と比べると、decode が通常5-10倍高速です。per-token price は高め（Groq は2025年後半に Llama-70B で約$0.99/M）ですが、latency-sensitive use case では無敵です。Groq は voice agents と real-time translation の production pick です。

**GPU platforms** — Baseten、Together、Fireworks、Modal、Anyscale。NVIDIA（2026年は H100、H200、B200）または時に AMD 上で動きます。"raw GPU rental"（RunPod、Lambda）と "hyperscaler managed service"（Bedrock）の間にある economic layer です。

**API-first marketplaces** — Replicate、DeepInfra、OpenRouter、Fal。広い catalog、pay-per-prediction または pay-per-second、time-to-first-call を重視します。

### Fireworks — latency-optimized GPU platform

- FireAttention engine（custom）。同等 config の vLLM より latency が4倍低いと marketed されています。
- non-interactive workload 向けに、serverless rate の約50%で batch tier を提供します。
- Fine-tuned model を base model と同じ rate で serve します。LoRA に premium を課す provider と比べて、実質的な差別化要因です。
- 2026年中盤: on-demand GPU rental を2026年5月1日から $1/hour 値上げ。scale では volume pricing を交渉可能。
- Financial signal: $4B valuation、10T+ tokens/day を処理。

### Together — breadth-optimized

- upstream publication から数日以内の open-source releases を含む 200+ models。
- 同等 LLM models で Replicate より 50-70% 安い。"AI Native Cloud" の positioning は volume と catalog です。
- inference + fine-tuning + training を1つの API で提供。

### Baseten — enterprise-polish-optimized

- Truss framework: dependencies、secrets、serving config を1つの manifest にまとめる model packaging。
- T4 から B200 までの GPU range。reasonable cold-start mitigation 付きの per-minute billing。
- SOC 2 Type II、HIPAA-ready。fintech と healthcare でよく選ばれます。
- $5B valuation、2026年1月 Series E（CapitalG、IVP、NVIDIA から $300M）。

### Modal — Python-native-optimized

- pure Python の infrastructure-as-code。`@modal.function(gpu="A100")` で function を decorate し、1 command で deploy。
- Per-second billing。pre-warming ありで cold start 2-4s、小型 model では <1s。
- $1.1B valuation の $87M Series B（2025年）。independent surveys で developer experience score が最も高い。

### Replicate — multimodal breadth

- Pay-per-prediction。image、video、audio models の default platform。
- Integration ecosystem（Zapier、Vercel、CMS plugins）。
- LLM per-token rates では競争力が弱いが、multimodal variety で勝ちます。

### Anyscale — Ray-native

- Ray 上に構築。RayTurbo は Anyscale の proprietary inference engine（vLLM と競合）。
- inference step が大きな graph の1 node である distributed Python workloads に最適。
- Managed Ray clusters、Ray AIR と Ray Serve との tight integration。

### Per-token versus per-minute — when each wins

Per-token は workload が latency-insensitive かつ bursty なときに理にかないます。使った分だけ支払うからです。Per-minute は utilization が高く予測可能なときに理にかないます。GPU を飽和させられると per-token に勝ちます。

rough rule: dedicated GPU の sustained utilization が約30%を超える workload では、per-minute（Baseten、Modal）が per-token（Fireworks、Together）に勝ち始めます。それ未満では idle に支払わずに済む per-token が勝ちます。

### Custom engine is the real moat

vLLM と SGLang より上位のすべての platform は custom engine を主張します。FireAttention、RayTurbo、Baseten の inference stack です。custom-engine claim は marketing の色合いもあります。正直な framing は、vLLM + SGLang が production open-source inference の約80%を占め、platform layer の differentiator は DX、attribution、SLA である、というものです。

### Numbers you should remember

- Fireworks GPU rental: $1/hr raise effective May 1, 2026.
- Fireworks claim: 4x lower latency than vLLM on equivalent configs.
- Together: 50-70% cheaper than Replicate on LLMs.
- Baseten valuation: $5B (Series E, Jan 2026, $300M round).
- Modal valuation: $1.1B (Series B, 2025).
- Per-minute beats per-token above ~30% sustained utilization.

## Use It

`code/main.py` は pricing model をまたいで6 vendor を synthetic workload 上で比較します。$/day と effective $/M tokens を報告します。実行して、per-token と per-minute の break-even を見つけてください。

## Ship It

このレッスンは `outputs/skill-inference-platform-picker.md` を生成します。workload profile、SLA、budget を入力すると、primary inference platform と runner-up を選びます。

## Exercises

1. `code/main.py` を実行してください。1台の H100 上の 70B model で、Baseten（per-minute）が Fireworks（per-token）に勝つ sustained utilization はどこですか。crossover を自分で導き、rule of thumb と比較してください。
2. あなたの product は image generation、chat、speech-to-text を提供します。各 modality の platform を選び、それらを統合する gateway pattern を名前で挙げてください。
3. Fireworks が primary model の price を $1/hr 値上げしました。traffic の40%を batch tier（50% off）に移す場合の blended cost impact を model 化してください。
4. 規制対象の customer が SOC 2 Type II + HIPAA + dedicated GPUs を要求しています。viable な platform はどの3つで、FinOps ではどれが勝ちますか。
5. Llama 3.1 70B の 1,000 predictions あたり cost を、Fireworks serverless、Together on-demand、Baseten dedicated、Replicate API で比較してください。10 predictions/day ではどれが最安ですか。10,000 ではどうですか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU、Cerebras WSE、SambaNova RDU — decode に最適化 |
| FireAttention | "Fireworks engine" | custom attention kernel。vLLM より4倍低 latency と marketed |
| Truss | "Baseten's format" | model packaging manifest。dependencies + secrets + serving config |
| Per-token | "API pricing" | consumed tokens で課金。idle には払わない |
| Per-minute | "dedicated pricing" | wall-clock GPU time で課金。high utilization で勝つ |
| Per-prediction | "Replicate pricing" | model invocation ごとの課金。image/video で一般的 |
| RayTurbo | "Anyscale engine" | Ray 上の proprietary inference。Ray clusters 上で vLLM と競合 |
| Batch tier | "50% off" | reduced rate の non-interactive queue。Fireworks や OpenAI で一般的 |
| Fine-tuned at base rate | "Fireworks LoRA" | LoRA-served requests を base model rate で課金すること（差別化要因） |

## 参考文献

- [Fireworks Pricing](https://fireworks.ai/pricing) — per-token rates, batch tier, GPU rental.
- [Baseten Pricing](https://www.baseten.co/pricing/) — per-minute rates, committed capacity, enterprise tiers.
- [Modal Pricing](https://modal.com/pricing) — per-second GPU rates and free tier.
- [Together AI Pricing](https://www.together.ai/pricing) — model catalog and per-token rates.
- [Anyscale Pricing](https://www.anyscale.com/pricing) — RayTurbo and managed Ray pricing.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) — comparative assessment.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) — vendor landscape.
