---
name: skill-quantization
description: Choose the right quantization strategy for deploying LLMs based on hardware, quality, and latency constraints
version: 1.0.0
phase: 10
lesson: 11
tags: [quantization, inference, deployment, optimization, fp8, int4, int8, gptq, awq, gguf]
---

# Quantization Decision Framework

When deploying a language model, use this framework to select the right number format, quantization method, and quality validation strategy.

## Input Requirements

Provide:
- **Model** (name, parameter count, original precision)
- **Target hardware** (GPU model/VRAM, CPU, Apple Silicon, edge device)
- **Latency target** (tokens/second, time to first token)
- **Quality floor** (max acceptable perplexity increase, benchmark delta)
- **Serving pattern** (batch size, max context length, concurrent users)

## Quick Selection

| Your Situation | Format | Method | Expected Quality Loss |
|---------------|--------|--------|----------------------|
| H100 GPU, maximum throughput | FP8 E4M3 | Native H100 casting | < 0.1% |
| A100/A10, need 2x throughput | INT8 | LLM.int8() or SmoothQuant | < 0.5% |
| Single 24GB GPU, 70B model | INT4 | AWQ or GPTQ | 1-3% |
| MacBook / Apple Silicon | INT4 GGUF | Q4_K_M via llama.cpp | 1-2% |
| Mobile / edge device | INT4 or INT3 | QAT + device-specific | 2-5% |
| Maximum compression, some loss OK | INT2 | QuIP# or AQLM | 5-15% |
| Training (mixed precision) | BF16 + FP32 accum | Native framework support | 0% |

## Precision Selection by Component

Not all tensors should get the same treatment.

| Component | Safe Minimum | Recommended | Avoid |
|-----------|-------------|-------------|-------|
| FFN weights | INT4 | INT4 (AWQ/GPTQ) | INT2 without QAT |
| Attention weights | INT4 | INT8 or FP8 | INT2 |
| Embedding layer | INT8 | FP16 (keep original) | INT4 |
| Output head | INT8 | FP16 (keep original) | INT4 |
| KV cache | FP8 | FP8 or INT8 | INT4 at long context |
| Attention logits | FP16 | FP16 or BF16 | INT8 |
| Activations (inference) | INT8 | FP8 or INT8 | INT4 |

## Method Comparison

### GPTQ
- **When:** GPU inference, you want a Hugging Face-compatible model
- **Calibration data:** 128 examples, 2048 tokens each
- **Time:** 30-60 minutes for 70B on A100
- **Tooling:** `auto-gptq`, `exllama`, `exllamav2`
- **Strength:** Well-tested, huge model zoo on Hugging Face
- **Weakness:** Slower than AWQ to apply, slightly lower quality than AWQ on some models

### AWQ
- **When:** GPU inference, you want best quality-per-bit
- **Calibration data:** 128 examples
- **Time:** 15-30 minutes for 70B on A100
- **Tooling:** `autoawq`, `vLLM` (native support)
- **Strength:** Best INT4 quality, fast to apply, vLLM integration
- **Weakness:** Smaller model zoo than GPTQ

### GGUF
- **When:** CPU inference, Apple Silicon, llama.cpp ecosystem
- **Variants:** Q2_K, Q3_K_S/M/L, Q4_K_S/M, Q5_K_S/M, Q6_K, Q8_0, F16
- **Recommended default:** Q4_K_M (best quality/size balance)
- **Tooling:** `llama.cpp`, `ollama`, `LM Studio`
- **Strength:** Self-contained files, mixed precision, massive ecosystem
- **Weakness:** Not optimal for GPU (designed for CPU/Metal)

### SmoothQuant
- **When:** INT8 on GPU, need both weight and activation quantization
- **Key idea:** Migrate quantization difficulty from activations to weights via per-channel scaling
- **Tooling:** `smoothquant`, `TensorRT-LLM`
- **Strength:** Enables W8A8 (both weights and activations in INT8) for 2x speedup
- **Weakness:** INT8 only, does not extend to INT4

## Quality Validation Protocol

After quantizing, validate before deploying:

1. **Perplexity test.** Compute on WikiText-2 or your domain corpus. Delta < 0.5 is excellent, 0.5-1.0 is good, > 2.0 is a problem.

2. **Benchmark sweep.** Run MMLU (general), GSM8K (math), HumanEval (code). Math and code are most sensitive to precision loss.

3. **Output comparison.** Generate 100 responses from both original and quantized model. Use LLM-as-judge to compute win rate. Target: quantized model wins or ties on > 90% of prompts.

4. **Latency measurement.** Measure tokens/second at batch size 1 and your target batch size. Verify the speedup justifies the quality cost.

5. **Long-context test.** If serving long contexts (> 4K tokens), test at your maximum context length. KV cache quantization errors compound with sequence length.

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
- Total with FP8 KV: ~55 GB (fits one 80GB A100)

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Quantizing the embedding layer to INT4 | First layer amplifies errors through entire model | Keep embeddings at FP16 or INT8 |
| Using per-tensor scales for INT4 | One outlier row destroys precision for all rows | Use per-channel or per-group scales |
| Not calibrating GPTQ/AWQ | Scale factors are wrong without representative data | Use 128 examples from your domain |
| Same bit-width for all layers | First/last layers are more sensitive | Mixed precision: higher bits for first/last |
| Quantizing KV cache at very long context | Errors compound quadratically with sequence length | Use FP8 for KV cache, not INT4 |
| Skipping quality validation | Some models quantize poorly (especially at boundaries) | Always run perplexity + task evals |

## Deployment Recipes

### Recipe 1: vLLM with AWQ (GPU server)
```
pip install vllm autoawq
vllm serve model-awq --quantization awq --dtype half --max-model-len 8192
```

### Recipe 2: llama.cpp with GGUF (MacBook)
```
./llama-server -m model.Q4_K_M.gguf -c 4096 -ngl 99
```

### Recipe 3: TensorRT-LLM with FP8 (H100)
```
trtllm-build --model_dir model --output_dir engine --dtype float16 --use_fp8
```
