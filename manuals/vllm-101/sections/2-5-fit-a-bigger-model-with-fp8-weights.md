# Fit a bigger model with FP8 weights

> FP8 weights free memory for the KV cache, and the speed change depends on what your GPU supports.

Your model fits, but only with a small KV pool. When you finish this section, you can decide between a BF16 and an FP8 checkpoint at the same memory budget.

**Our result:** on our clock-locked L4, the FP8 checkpoint gave 36 percent more output than BF16 at 32 users, at the same pool.

## Pick a checkpoint

An FP8 checkpoint stores most weights in 1 byte instead of 2. Many model makers publish one next to the BF16 model. For `Qwen/Qwen3-8B`, the FP8 checkpoint is `Qwen/Qwen3-8B-FP8`, and you serve it like any other model:

```bash
vllm serve Qwen/Qwen3-8B-FP8
```

vLLM reads the quantization from the checkpoint config, so you set no extra flag. If no FP8 checkpoint exists, vLLM can quantize a BF16 model when it loads, with `--quantization fp8_per_tensor`. We did not test that path.

## Know what your GPU runs

The L4 is an Ada GPU, SM 8.9, and it has FP8 math. So vLLM runs the matrix math of the model in FP8, and the speed can rise as well as the free memory.

GPUs before Ada, such as the A100, have no FP8 math. On those, vLLM keeps the weights in FP8 and runs a weight-only kernel. You keep the memory saving, but expect less speed gain. We did not test such a GPU.

## Count the memory it frees

The weights take close to half the memory in FP8. vLLM gives the memory that it frees to the KV pool. For `Qwen/Qwen3-8B`, each GiB of KV pool holds about 7,300 tokens in BF16, as [the FP8 KV cache page](#s-fit-more-users-with-an-fp8-kv-cache) shows.

In our runs, we held the pool at 24,096 tokens as a [fixed pool](#s-count-the-memory-before-you-pick-a-gpu), so that both runs had the same room. So we did not measure the larger pool. The gain in room comes from the bytes, not from a run.

## See what our runs show

**We measured** `Qwen/Qwen3-8B-FP8` against `Qwen/Qwen3-8B` on our L4 on 2026-10-22, in [the session locked at 900 MHz](#l4-sessions). We ran 1 and 32 users with two seeds each.

```figure
id: fig-2-5
kind: chart
title: FP8 weights against BF16 at 32 users
claim: With the clock locked and the same KV pool, FP8 weights gave 284.7 against 208.8 output tokens per second at 32 users.
caption: Each bar is the median of two seeds. The BF16 run had a median clock of 881 MHz and the FP8 run 900 MHz. From capture/gpu/summary/l4.json.
```

| Users, L4 locked session | Median TPOT, BF16 / FP8 | Output tok/s, BF16 / FP8 | Median SM clock, BF16 / FP8 |
|---|---|---|---|
| 32 | 119.9 / 83.8 ms | 208.8 / 284.7 | 881 / 900 MHz |
| 1 | not compared / 35.3 ms | not compared / 25.4 | 210 / 900 MHz |

At 32 users, FP8 gave 36 percent more output and cut the time per token by 30 percent. The seed ranges did not overlap for either number. The BF16 clock was about 2 percent lower, much less than the gap.

At one user, the BF16 run fell to 210 MHz, below the lock, because the GPU throttled. So we do not compare the two at one user.

## Use a 4-bit or 8-bit integer checkpoint

FP8 halves the weights. A 4-bit checkpoint stores most weights in about half a byte, so a model with twice the parameters can fit. On a 24 GB GPU such as the L4, a 4-bit checkpoint is a common way to serve a 14B model.

vLLM 0.31.0 reads these formats from the checkpoint config, so you set no flag for a published checkpoint:

| Format | What it stores | Notes at 0.31.0 |
|---|---|---|
| AWQ and GPTQ | 4-bit weights, 16-bit math | runs from the Turing GPUs on, with the fast Marlin kernels on Ampere, Ada, and Hopper |
| compressed-tensors W4A16 or W8A8 | 4-bit or 8-bit weights, made with the LLM Compressor library | the vLLM project suggests this library to make your own checkpoint |
| bitsandbytes | 4-bit weights, made when the server loads the model | needs the separate `vllm-bnb-plugin` package, then set `--quantization bitsandbytes` for a model that is not quantized |
| GGUF | the llama.cpp file format | needs the separate `vllm-gguf-plugin` package, and the vLLM documentation calls it experimental |

For example, Qwen publishes a 4-bit AWQ checkpoint of Qwen3-14B:

```bash
vllm serve Qwen/Qwen3-14B-AWQ --max-model-len 8192
```

We started this AWQ checkpoint once on an L4, with no `--quantization` flag. The log showed `quantization=auto_awq` and the Marlin kernel. The weights took 9.44 GiB, and the pool held 36,272 tokens. We did not measure its speed or its accuracy.

We also started two of the other formats on the shared second GPU of our L4 node on 2026-10-23. That GPU was throttled, so we give no speeds.

- **bitsandbytes.** Without the plugin, `--quantization bitsandbytes` stops at start with `Unknown quantization method: bitsandbytes`. Install the plugin first, with `uv pip install vllm-bnb-plugin`, or `pip install vllm-bnb-plugin` on the pip path. With it, `Qwen/Qwen3-1.7B` loaded in 1.33 GiB against 3.22 GiB in BF16, which is 41 percent. The pool grew from 92,960 to 108,512 tokens.
- **GGUF.** With the plugin installed, `vllm serve unsloth/Qwen3-0.6B-GGUF:Q4_K_M --tokenizer Qwen/Qwen3-0.6B` loaded 0.55 GiB of weights, and a chat request returned HTTP 200.

The 41 percent is for one small model. It includes the embeddings and the output layer, which stay in 16-bit, so the share can differ on a larger model. We did not measure the accuracy of either format.

A 4-bit model can lose more accuracy than an FP8 model, and the loss depends on the model and the method. Test both formats on your own prompts.

## Check the accuracy

On 2026-10-23 we ran the first 500 GSM8K questions, 8-shot and greedy, on our L4, with `Qwen/Qwen3-8B` against `Qwen/Qwen3-8B-FP8`:

```listing
title: GSM8K accuracy, 500 questions, 8-shot, Qwen3-8B on vLLM 0.31.0
source: capture/gpu/out-l4/gsm8k-fp8-accuracy.txt
lang: text
note: The vLLM rows. The SGLang rows of the same file are cut.
---
engine   config                     correct   accuracy   Wilson 95% interval
…
vLLM     BF16                       459/500   91.8%      89.1 to 93.9
vLLM     FP8 weights                453/500   90.6%      87.7 to 92.9
vLLM     FP8 KV cache               454/500   90.8%      87.9 to 93.0
vLLM     FP8 weights + FP8 KV       453/500   90.6%      87.7 to 92.9
```

FP8 weights scored 1.2 points lower, and the two intervals overlap. So this run did not show a difference, and it cannot rule out a loss of a few points. It is one model and one benchmark. Run your own prompts on both checkpoints, and compare the answers before you go to production. We did not run this check on the 4-bit formats.

```takeaways
- Serve a published FP8 checkpoint, and set no extra flag.
- Use a 4-bit checkpoint when the model does not fit in FP8.
- Check output quality on your own prompts before production.
```

Sources: capture/gpu/summary/l4.json (load.vllm-lock-b, load.vllm-lock-fp8), the vLLM source at v0.31.0 (vllm/model_executor/layers/quantization/fp8.py), vLLM documentation at v0.31.0 (docs/features/quantization/online.md, docs/features/quantization/README.md, docs/features/quantization/auto_awq.md, docs/features/quantization/gptqmodel.md, docs/features/quantization/bnb.md, docs/features/quantization/gguf.md, docs/features/quantization/llm_compressor/), capture/gpu/out-l4/livecheck-2026-10-22.txt, capture/gpu/out-l4/livecheck-2026-10-23.txt, vLLM documentation at v0.31.0 (docs/features/quantization/bnb.md), capture/gpu/out-l4/gsm8k-fp8-accuracy.txt.
