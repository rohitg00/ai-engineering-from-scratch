# Evidence: cheatsheets/quantization.md

Abbreviations: Q = phases/10-llms-from-scratch/11-quantization, T = phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, P = phases/17-infrastructure-and-production/09-production-quantization, L = phases/11-llm-engineering/08-fine-tuning-lora.

## Production formats side by side (comparison)
- Bits 4-5, 4-8, 4, 8 for GGUF Q4_K_M, GPTQ, AWQ, FP8: P/docs/en.md:29-32
- Sweet spot CPU edge laptops, multi-LoRA, datacenter GPU, Hopper Ada Blackwell: P/docs/en.md:29-32
- Engines llama.cpp Ollama, vLLM TGI, Marlin-AWQ, TRT-LLM SGLang: P/docs/en.md:29-32
- 7B speed ~93 tok/s GGUF: P/docs/en.md:40. ~712 tok/s GPTQ: P/docs/en.md:44. ~741 tok/s AWQ: P/docs/en.md:50. No FP8 number: P/docs/en.md:56
- Kernel gain, Marlin 2.6x vs non-Marlin: P/docs/en.md:44. Marlin-AWQ 10.9x vs naive: P/docs/en.md:50. FP8 native on Hopper Tensor Cores: P/docs/en.md:56
- Quality, near-BF16 at 4-5 bits: P/docs/en.md:38. Calibration pass: P/docs/en.md:44. Best Pass@1 at INT4: P/docs/en.md:50. Near-lossless: P/docs/en.md:56

## Use X when (tips)
- CPU/edge GGUF Q4_K_M: P/docs/en.md:92
- AWQ routine chat no LoRA: P/docs/en.md:93
- GPTQ with Marlin multi-LoRA: P/docs/en.md:94
- Reasoning FP8: P/docs/en.md:95
- NVFP4 + FP8 KV on Blackwell: P/docs/en.md:96
- QLoRA NF4 on one consumer GPU: L/docs/en.md:122,130
- 1,000-sample eval: P/docs/en.md:97

## Bit layouts (concepts)
- FP32 1 sign, 8 exponent, 23 mantissa: Q/docs/en.md:36. Accumulation: Q/docs/en.md:45
- BF16 1 sign, 8 exponent, 7 mantissa: Q/docs/en.md:38. Same range as FP32: Q/docs/en.md:49
- FP16 1 sign, 5 exponent, 10 mantissa: Q/docs/en.md:37. Max ~65,504: Q/docs/en.md:47
- FP8 E4M3 1 sign, 4 exponent, 3 mantissa: Q/docs/en.md:39, 51
- FP8 E5M2 1 sign, 5 exponent, 2 mantissa: Q/docs/en.md:40, 51
- INT8 256 values from -128 to 127, scale factor: Q/docs/en.md:41, 53
- INT4 16 levels, GPTQ or AWQ: Q/docs/en.md:42, 55
- NVFP4 per-block scale factor: T/docs/en.md:31

## Quantize and dequantize (annotated-code)
- quantize_symmetric body: Q/code/main.py:82-90
- dequantize_symmetric: Q/code/main.py:93-94
- zero_point line: Q/code/main.py:127
- error at most scale / 2: Q/docs/en.md:104

## Llama 3 70B measured (comparison)
- Size 140GB, 70GB, 35GB, 35GB: Q/docs/en.md:202-205
- Perplexity 3.12, 3.14, 4.32, 4.18: Q/docs/en.md:202-205
- MMLU 79.5%, 79.3%, 77.8%, 78.1%: Q/docs/en.md:202-205
- Tokens/sec on A100 38, 55, 72, 75: Q/docs/en.md:202-205

## PTQ vs QAT (comparison)
- Cost, minutes to hours versus full training run: Q/docs/en.md:150
- Quality at INT8, under 0.1% loss versus excellent: Q/docs/en.md:151
- Quality at INT4, 1-3% loss versus under 1%: Q/docs/en.md:152
- Quality at INT2, poor versus usable for some tasks: Q/docs/en.md:153
- Calibration data, 128-1024 examples versus full training dataset: Q/docs/en.md:154

## Sensitivity, low to high (flow)
- 1 weights: Q/docs/en.md:114, 126
- 2 activations: Q/docs/en.md:116, 127
- 3 KV cache: Q/docs/en.md:118, 128
- 4 attention logits FP16: Q/docs/en.md:120, 129

## HBM budget: 70B with AWQ (architecture)
- Weights ~35 GB: P/docs/en.md:77
- KV cache ~20 GB at 128 x 2k: P/docs/en.md:78
- Activations ~5 GB: P/docs/en.md:79
- Total ~60 GB fits H100 80GB: P/docs/en.md:80

## Quantize and serve (task-table)
- convert_hf_to_gguf.py --outtype f16 --outfile: Q/docs/en.md:828
- llama-quantize Q4_K_M: Q/docs/en.md:829
- llama-server -m -c 4096 -ngl 99: Q/docs/en.md:830
- GPTQConfig(bits=4, group_size=128): Q/docs/en.md:783
- model.quantize(calibration_texts[:128], batch_size=1): Q/docs/en.md:786
- AWQModifier(duo_scaling="both"): Q/docs/en.md:804
- QuantizationModifier(... W4A16_ASYM ...): Q/docs/en.md:805
- vllm serve --max-model-len 8192: Q/docs/en.md:839

## QLoRA base in 4-bit (annotated-code)
- BitsAndBytesConfig fields: L/docs/en.md:458-463
- from_pretrained with quantization_config and device_map: L/docs/en.md:465-469
- get_peft_model: L/docs/en.md:471
- adapters in fp16: L/docs/en.md:474. NF4 quantiles: L/docs/en.md:134. double quantization to fp8: L/docs/en.md:136

## Troubleshooting (troubleshooting)
- Pass@1 drop, generic web text, in-domain fix: P/docs/en.md:69-71
- KV cache stays FP16/FP8, budget holistically: P/docs/en.md:75, 82
- AWQ INT4 ~3-5 points on MATH, ship FP8 or BF16: P/docs/en.md:88
- ~93 tok/s, wrong engine: P/docs/en.md:40, P/code/main.py:103
- KV in FP4 collapses attention, keep FP8: T/docs/en.md:29
- Naive INT4 destroys, GPTQ/AWQ calibration: Q/docs/en.md:25, 144
- Perplexity delta > 2.0 means something went wrong: Q/docs/en.md:192
- No LoRA support on NVFP4, GPTQ-Int4 LoRA in vLLM: P/docs/en.md:46, 63

## Q&A (qa)
- Perplexity delta < 0.5 excellent: Q/docs/en.md:192
- 128 examples typical for GPTQ: Q/docs/en.md:159
- Blackwell config: T/docs/en.md:35-38
- AWQ vs GPTQ same footprint, LoRA support: P/code/main.py:100
- GGUF Q4_K_M 70B about 40GB, 10-15 tokens/second on M3 Max 64GB: Q/docs/en.md:218
