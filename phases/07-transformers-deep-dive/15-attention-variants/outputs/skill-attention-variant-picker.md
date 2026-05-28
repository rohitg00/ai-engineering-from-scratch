---
name: attention-variant-picker
description: context length、retrieval demands、compute profile に基づき、新しい model の full / sliding-window / sparse / differential attention topology を選ぶ。
version: 1.0.0
phase: 7
lesson: 15
tags: [attention, transformer, long-context, inference, memory]
---

# Attention Variant Picker

developer が新しい transformer、または既存 transformer の longer context 拡張に対して attention topology を選び、正当化できるよう支援します。

## 収集する入力

1. **Target context length**。training 時と inference 時の両方 (多くの models は 16K で train し、inference で extend します)。
2. **Retrieval demand**。1–5 scale: 1 = pure chat、5 = needle-in-haystack / RAG / 長い repository context を持つ code。
3. **Inference memory budget**。request ごとの KV cache tolerance (bytes per token per layer が適切な単位)。
4. **Training cost tolerance**。SWA を scratch から train するのは安いですが、pretrained model に differential attention を retrofit するのは高価です。
5. **Hardware target**。Hopper+ は full FlashAttention-3、Ada は FA2、older GPUs は mask-limited。

## 判断ルール

- **Context ≤ 16K and retrieval ≤ 3**: FlashAttention 付き full attention。premature optimization はしない。
- **Context 16–128K and retrieval ≤ 3**: 5:1 の mixed SWA + global、window 1024 (Gemma 3 shape)。KV を collapse しつつ retrieval を実用範囲に保ちます。
- **Context > 128K**: full SWA に 4–6 layers ごとの global layer、さらに position interpolation / YaRN scaling (Lesson 04)。
- **Retrieval = 5 and training budget allows**: top 4 layers のみ differential attention を検討します (KV doubling は半分、sink-cancellation の gain は大半)。
- **You're shipping a public API**: stable patterns (full, SWA, Gemma-3 mix) を優先します。kernel engineers がいない限り native-sparse / DIFF は避けます。
- **You can't change the base model**: SWA は masking により inference で retrofit できます。differential と sparse はできません。

## 必ず flag すること

- Pure-SWA models below 7B は reasoning benchmarks で測定可能に落ちることが多いです。推奨しないでください。
- Window size < 512 が正しいことはほぼありません。より大きくするか、別の topology を使います。
- differential attention の paper の報告は small models (3–7B) 上です。early 2026 時点で scale-up evidence は薄いです。
- すべての variant は RoPE / YaRN scaling (Lesson 04) と相互作用します。position scheme を明示してください。

## 出力形式

次を返します。

1. **Recommendation** — single named topology (例: "Gemma-3 mix, W=1024, 5:1 SWA:global")。
2. **Justification** — 各 input を上の decision rule に対応づけます。
3. **KV cache estimate** — target context における bytes per token per layer と batch 1 での GB。
4. **Migration path** — base model がすでに trained の場合、どう retrofit するか。
5. **Known risks** — どの benchmarks / workloads が regress し得るか。
