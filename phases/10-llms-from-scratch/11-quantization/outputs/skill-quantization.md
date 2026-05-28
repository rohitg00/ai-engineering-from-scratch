---
name: skill-quantization
description: hardware、品質、latency 制約に基づいて LLM deployment に適した量子化戦略を選ぶ
version: 1.0.0
phase: 10
lesson: 11
tags: [quantization, inference, deployment, optimization, fp8, int4, int8, gptq, awq, gguf]
---

# 量子化の意思決定フレームワーク

言語モデルをデプロイするときは、このフレームワークを使って適切な数値形式、量子化手法、品質検証戦略を選びます。

## 入力要件

次を用意してください。
- **モデル** (名前、パラメータ数、元の precision)
- **対象 hardware** (GPU model/VRAM、CPU、Apple Silicon、edge device)
- **Latency target** (tokens/second、time to first token)
- **Quality floor** (許容できる最大 perplexity 増加、benchmark delta)
- **Serving pattern** (batch size、max context length、concurrent users)

## クイック選択

| 状況 | Format | Method | 想定される品質低下 |
|---------------|--------|--------|----------------------|
| H100 GPU で最大 throughput が必要 | FP8 E4M3 | Native H100 casting | < 0.1% |
| A100/A10 で 2x throughput が必要 | INT8 | LLM.int8() or SmoothQuant | < 0.5% |
| 24GB GPU 1枚で 70B model | INT4 | AWQ or GPTQ | 1-3% |
| MacBook / Apple Silicon | INT4 GGUF | Q4_K_M via llama.cpp | 1-2% |
| Mobile / edge device | INT4 or INT3 | QAT + device-specific | 2-5% |
| 最大圧縮が必要で多少の劣化は許容 | INT2 | QuIP# or AQLM | 5-15% |
| Training (mixed precision) | BF16 + FP32 accum | Native framework support | 0% |

## Component 別の Precision 選択

すべての tensor を同じように扱うべきではありません。

| Component | 安全な最小値 | 推奨 | 避ける |
|-----------|-------------|-------------|-------|
| FFN weights | INT4 | INT4 (AWQ/GPTQ) | QAT なしの INT2 |
| Attention weights | INT4 | INT8 or FP8 | INT2 |
| Embedding layer | INT8 | FP16 (元のまま保持) | INT4 |
| Output head | INT8 | FP16 (元のまま保持) | INT4 |
| KV cache | FP8 | FP8 or INT8 | long context での INT4 |
| Attention logits | FP16 | FP16 or BF16 | INT8 |
| Activations (inference) | INT8 | FP8 or INT8 | INT4 |

## 手法比較

### GPTQ
- **使う場面:** GPU inference で、Hugging Face-compatible model が必要
- **Calibration data:** 128 examples、各 2048 tokens
- **時間:** A100 上の 70B で 30-60 分
- **Tooling:** `auto-gptq`, `exllama`, `exllamav2`
- **強み:** よく検証されており、Hugging Face 上の model zoo が非常に大きい
- **弱み:** 適用が AWQ より遅く、一部 models では AWQ より品質がわずかに低い

### AWQ
- **使う場面:** GPU inference で、bit あたりの最高品質が必要
- **Calibration data:** 128 examples
- **時間:** A100 上の 70B で 15-30 分
- **Tooling:** `autoawq`, `vLLM` (native support)
- **強み:** 最高レベルの INT4 品質、適用が速い、vLLM integration
- **弱み:** model zoo は GPTQ より小さい

### GGUF
- **使う場面:** CPU inference、Apple Silicon、llama.cpp ecosystem
- **Variants:** Q2_K, Q3_K_S/M/L, Q4_K_S/M, Q5_K_S/M, Q6_K, Q8_0, F16
- **推奨 default:** Q4_K_M (品質/サイズのバランスが最良)
- **Tooling:** `llama.cpp`, `ollama`, `LM Studio`
- **強み:** 自己完結型ファイル、mixed precision、大きな ecosystem
- **弱み:** GPU には最適ではない (CPU/Metal 向けに設計)

### SmoothQuant
- **使う場面:** GPU 上の INT8 で、weight と activation の両方を量子化したい
- **Key idea:** per-channel scaling により、量子化の難しさを activations から weights へ移す
- **Tooling:** `smoothquant`, `TensorRT-LLM`
- **強み:** W8A8 (weights と activations の両方を INT8) を可能にし、2x speedup を得る
- **弱み:** INT8 専用で、INT4 には拡張できない

## 品質検証プロトコル

量子化後、デプロイ前に検証してください。

1. **Perplexity test。** WikiText-2 または自分の domain corpus で計算します。Delta < 0.5 は優秀、0.5-1.0 は良好、> 2.0 は問題です。

2. **Benchmark sweep。** MMLU (general)、GSM8K (math)、HumanEval (code) を実行します。math と code は precision loss に最も敏感です。

3. **Output comparison。** original model と quantized model の両方から 100 responses を生成します。LLM-as-judge で win rate を計算します。目標は、quantized model が > 90% の prompts で勝つか引き分けることです。

4. **Latency measurement。** batch size 1 と target batch size で tokens/second を測定します。speedup が品質 cost に見合うことを確認します。

5. **Long-context test。** long contexts (> 4K tokens) を serving する場合は、最大 context length でテストします。KV cache quantization errors は sequence length とともに蓄積します。

## Memory Budget Calculator

```
Weight memory (GB) = parameters (B) * bits / 8 / 1.073741824
KV cache per token (MB) = 2 * num_layers * d_model * bits / 8 / 1048576
KV cache for context (GB) = kv_per_token * max_context_length / 1024
Activation memory (GB) ~ 1-4 GB (relatively constant, depends on batch size)
Total = weight_memory + kv_cache + activation_memory + overhead (10-20%)
```

Example for Llama 3 70B at INT4, 32K context:
- Weights: 70B * 4 / 8 / 1.07 = 32.6 GB
- KV cache (FP16): 2 * 80 * 8192 * 16 / 8 / 1e9 * 32768 = ~40 GB
- KV cache (FP8): ~20 GB
- FP8 KV を使った total: ~55 GB (80GB A100 1枚に収まる)

## よくある失敗

| 失敗 | なぜ失敗するか | 修正 |
|---------|-------------|-----|
| embedding layer を INT4 に量子化する | first layer の誤差がモデル全体に増幅される | embeddings は FP16 または INT8 に保つ |
| INT4 に per-tensor scales を使う | 1つの outlier row が全 row の precision を壊す | per-channel または per-group scales を使う |
| GPTQ/AWQ を calibrate しない | representative data なしでは scale factors が不適切になる | 自分の domain から 128 examples を使う |
| すべての layer に同じ bit-width を使う | first/last layers はより敏感 | mixed precision: first/last は higher bits |
| very long context で KV cache を量子化する | 誤差が sequence length に対して二次的に蓄積する | KV cache には INT4 ではなく FP8 を使う |
| quality validation を skip する | 一部 models は量子化がうまくいかない (特に境界条件) | perplexity + task evals を必ず実行する |

## Deployment Recipes

### Recipe 1: AWQ を使う vLLM (GPU server)
```
pip install vllm autoawq
vllm serve model-awq --quantization awq --dtype half --max-model-len 8192
```

### Recipe 2: GGUF を使う llama.cpp (MacBook)
```
./llama-server -m model.Q4_K_M.gguf -c 4096 -ngl 99
```

### Recipe 3: FP8 を使う TensorRT-LLM (H100)
```
trtllm-build --model_dir model --output_dir engine --dtype float16 --use_fp8
```
