---
id: quantization
title: Quantization Formats Compared
code: QF
subtitle: Pick a weight format by hardware, engine and workload. Bits, memory, commands and the traps that cost accuracy.
hue: 30
sources: phases/10-llms-from-scratch/11-quantization, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/09-production-quantization, phases/11-llm-engineering/08-fine-tuning-lora
source_hash: c4748b8c82542092
---

## Production formats side by side
type: comparison
span: 2
from: phases/17-infrastructure-and-production/09-production-quantization/docs/en.md

| Factor | GGUF Q4_K_M | GPTQ | AWQ | FP8 |
|---|---|---|---|---|
| Bits | 4-5 | 4-8 | 4 | 8 |
| Sweet spot | CPU, edge, laptops | Multi-LoRA on vLLM | Datacenter GPU production | Hopper/Ada/Blackwell datacenter |
| Engines | llama.cpp, Ollama | vLLM, TGI | vLLM (Marlin-AWQ), TGI | vLLM, TRT-LLM, SGLang |
| 7B speed in vLLM | ~93 tok/s | ~712 tok/s | ~741 tok/s | No number given |
| Kernel gain | None on GPU | Marlin: 2.6x vs non-Marlin | Marlin-AWQ: 10.9x vs naive | Native on Hopper Tensor Cores |
| Quality | Near-BF16 at 4-5 bits | Calibration pass | Best Pass@1 at INT4 | Near-lossless |

## Use X when
type: tips
from: phases/17-infrastructure-and-production/09-production-quantization/docs/en.md, phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md

- CPU or edge serve: GGUF Q4_K_M.
- GPU serve, routine chat, no LoRA: AWQ.
- GPU serve with multi-LoRA: GPTQ with Marlin.
- Reasoning workload: FP8.
- Blackwell datacenter with validated quality: NVFP4 + FP8 KV.
- Fine-tune on one consumer GPU: QLoRA with an NF4 base.
- Not sure: run a 1,000-sample eval on each candidate format.

## Bit layouts
type: concepts
from: phases/10-llms-from-scratch/11-quantization/docs/en.md, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/docs/en.md

- **FP32**: 1 sign, 8 exponent, 23 mantissa. Used for accumulation.
- **BF16**: 1 sign, 8 exponent, 7 mantissa. Same range as FP32.
- **FP16**: 1 sign, 5 exponent, 10 mantissa. Max value ~65,504.
- **FP8 E4M3**: 1 sign, 4 exponent, 3 mantissa. Inference weights and activations.
- **FP8 E5M2**: 1 sign, 5 exponent, 2 mantissa. Training gradients.
- **INT8**: 256 values from -128 to 127. Needs a scale factor.
- **INT4**: 16 levels. Needs GPTQ or AWQ to keep quality.
- **NVFP4**: 4-bit FP with one scale factor per block. Blackwell.

## Quantize and dequantize
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/11-quantization/code/main.py, phases/10-llms-from-scratch/11-quantization/docs/en.md

```python
def quantize_symmetric(tensor, num_bits=8):
    qmin = -(2 ** (num_bits - 1))  # -128 at 8 bits
    qmax = 2 ** (num_bits - 1) - 1  # 127 at 8 bits
    abs_max = np.max(np.abs(tensor))  # per tensor: one scale
    if abs_max == 0:
        return np.zeros_like(tensor, dtype=np.int32), 1.0
    scale = abs_max / qmax
    quantized = np.clip(np.round(tensor / scale), qmin, qmax).astype(np.int32)
    return quantized, float(scale)

def dequantize_symmetric(quantized, scale):
    return quantized.astype(np.float64) * scale  # error at most scale / 2

zero_point = int(np.round(qmin - t_min / scale))  # asymmetric offset
```

## Llama 3 70B measured
type: comparison
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

| Factor | FP16 | FP8 | GPTQ INT4 | AWQ INT4 |
|---|---|---|---|---|
| Size | 140GB | 70GB | 35GB | 35GB |
| Perplexity (WikiText-2) | 3.12 | 3.14 | 4.32 | 4.18 |
| MMLU | 79.5% | 79.3% | 77.8% | 78.1% |
| Tokens/sec (A100) | 38 | 55 | 72 | 75 |

## PTQ vs QAT
type: comparison
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

| Factor | PTQ | QAT |
|---|---|---|
| Cost | Minutes to hours | Full training run |
| Quality at INT8 | Excellent (< 0.1% loss) | Excellent |
| Quality at INT4 | Good with GPTQ/AWQ (1-3% loss) | Better (< 1% loss) |
| Quality at INT2 | Poor | Usable for some tasks |
| Calibration data | 128-1024 examples | Full training dataset |

## Sensitivity, low to high
type: flow
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

1. **Weights**: Gaussian near zero. INT4 works with GPTQ or AWQ.
2. **Activations**: wider range with outliers. Use INT8 with care.
3. **KV cache**: errors compound over all future tokens. Use FP8 or INT8.
4. **Attention logits**: softmax amplifies error. Keep them in FP16.

## HBM budget: 70B with AWQ
type: architecture
from: phases/17-infrastructure-and-production/09-production-quantization/docs/en.md

```arch
node | w | 1,1 | Weights | ~35 GB INT4 | store
node | kv | 2,1 | KV cache | ~20 GB, 128 x 2k | store
node | act | 3,1 | Activations | ~5 GB | store
node | gpu | 2,2 | H100 80GB | total ~60 GB | gpu
edge | w | gpu |
edge | kv | gpu |
edge | act | gpu |
```

## Quantize and serve
type: task-table
span: 2
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

| Task | Code |
|---|---|
| Convert to GGUF | `python llama.cpp/convert_hf_to_gguf.py <model> --outtype f16 --outfile <f16>.gguf` |
| Make Q4_K_M | `llama.cpp/build/bin/llama-quantize <f16>.gguf <out>.gguf Q4_K_M` |
| Serve GGUF | `llama.cpp/build/bin/llama-server -m <out>.gguf -c 4096 -ngl 99` |
| GPTQ config | `GPTQConfig(bits=4, group_size=128)` |
| GPTQ calibrate | `model.quantize(calibration_texts[:128], batch_size=1)` |
| AWQ recipe step | `AWQModifier(duo_scaling="both")` |
| AWQ scheme | `QuantizationModifier(ignore=["lm_head"], scheme="W4A16_ASYM", targets=["Linear"])` |
| Serve AWQ or GPTQ | `vllm serve <model> --max-model-len 8192` |

## QLoRA base in 4-bit
type: annotated-code
lang: python
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md

```python
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,  # frozen base in 4-bit
    bnb_4bit_quant_type="nf4",  # levels at normal quantiles
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,  # scale constants to fp8
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=bnb_config,
    device_map="auto",
)
model = get_peft_model(model, lora_config)  # adapters train in fp16
```

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/09-production-quantization/docs/en.md, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/docs/en.md, phases/10-llms-from-scratch/11-quantization/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| HumanEval Pass@1 drops several points | Calibrated on generic web text | Calibrate on in-domain data |
| Out of HBM after a 4-bit model | KV cache stays FP16/FP8 | Budget weights, KV and activations |
| MATH drops ~3-5 points | AWQ INT4 on a reasoning model | Ship FP8 or BF16 |
| ~93 tok/s on 7B in vLLM | GGUF is the wrong engine | Serve GGUF with llama.cpp |
| Attention scores collapse | KV cache in FP4 | Keep KV cache in FP8 |
| Naive INT4 destroys the model | Rounding errors accumulate | Use GPTQ or AWQ with calibration |
| Perplexity delta > 2.0 | Something went wrong | Check the method and scales |
| No LoRA on NVFP4 | No LoRA support yet (early 2026) | Use GPTQ-Int4 in vLLM |

## Q&A
type: qa
from: phases/10-llms-from-scratch/11-quantization/docs/en.md, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/docs/en.md, phases/17-infrastructure-and-production/09-production-quantization/docs/en.md

- **What is a good perplexity delta?** Under 0.5 is excellent.
- **How many calibration examples for GPTQ?** 128 examples is typical.
- **Typical Blackwell config?** NVFP4 weights and activations, FP8 KV cache, FP32 attention accumulator.
- **AWQ or GPTQ?** Same 4-bit footprint. Pick by LoRA support.
- **GGUF Q4_K_M for 70B?** About 40GB. 10-15 tokens/second on an M3 Max with 64GB.
