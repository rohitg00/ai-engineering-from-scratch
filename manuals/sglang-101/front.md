# How to read this manual

> Install SGLang, serve your model, and then learn which few settings matter for your traffic, with the numbers we measured when we changed them.

This manual is for the engineer who wants an open model on their own GPU this week. It starts with a server that answers, and it ends with a fleet that you can measure and run.

These commands make an environment, install SGLang, start a server, and send it one request:

```bash
uv venv --python 3.12
source .venv/bin/activate
uv pip install --prerelease=allow "sglang==0.5.22"
sglang serve --model-path Qwen/Qwen3-8B --host 127.0.0.1 --port 30000 \
  --enable-cache-report --enable-metrics --mem-fraction-static 0.85
curl -s http://127.0.0.1:30000/generate -H 'Content-Type: application/json' \
  -d '{"text": "The capital of France is", "sampling_params": {"max_new_tokens": 12, "temperature": 0}}'
```

[Section 1.1](#s-install-sglang-and-serve-your-first-model) runs them step by step, with the output to expect after each one and the fix for each common error. We ran the uv install and the server command on an NVIDIA L4 with SGLang 0.5.22. The Apple silicon steps come from our Mac runs, and the Docker command follows the SGLang install page. Every measured number in this manual names the machine that it came from: an NVIDIA L4, an NVIDIA DGX Spark, or the Mac.

## What you can do after this manual

- Install SGLang, serve a model, and get the first answer from both of its APIs in about ten minutes.
- Size the KV pool for your GPU, and fix a server that runs out of memory.
- Tune the server for your traffic: shared prompts, long documents, many users, or FP8.
- Benchmark your own server, and watch it in production with its metrics.
- Choose how to scale to many GPUs, and judge a published benchmark before you trust it.

## Who this manual is for

You have called a model through an API, and now you want to serve an open model yourself. You know what a token and a GPU are. You have not tuned a serving engine before, and you want to know which settings matter before you pay for them.

`sglang serve --help` lists 535 options at version 0.5.22. The SGLang documentation describes each of them. This manual tells you which ones to change on your first day, and which defaults assume a machine that you do not have. It also shows what each change did on our GPUs.

## How the parts are ordered

Part 1 starts a server and checks it. Part 2 follows one request through the processes and the scheduler. Part 3 is the KV cache, which decides how many users one GPU serves.

Part 4 makes each forward pass fast, and Part 5 measures a server. Part 6 spreads one model over many GPUs. Part 7 operates SGLang and closes with reinforcement learning. The Reference holds the lookup tables and [how this manual was made](#s-ref-how-this-manual-was-made):

```parts
```

Each section ends with an "Our position" part that says what to do, and a short list of actions. Read those first when you need an answer today. Read the rest when you want the reason.

Seven lessons go deeper into the ideas this manual applies. [The serving internals lesson](phases/17-infrastructure-and-production/04-vllm-serving-internals) builds paged attention and continuous batching. [The goodput lesson](phases/17-infrastructure-and-production/08-inference-metrics-goodput) defines the metrics. [The speculative decoding lesson](phases/17-infrastructure-and-production/05-eagle3-speculative-decoding) builds EAGLE-3, and [the quantization lesson](phases/17-infrastructure-and-production/09-production-quantization) covers the formats. [The serving selection lesson](phases/17-infrastructure-and-production/28-self-hosted-serving-selection), [the inference optimization lesson](phases/10-llms-from-scratch/12-inference-optimization), and [the prompt caching lesson](phases/11-llm-engineering/15-prompt-caching) complete the set. This manual stays with SGLang.

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure 0.1](#fig-0-1) teaches the arrow styles with exchanges from our capture.

```figure
id: fig-0-1
kind: sequence
title: reading a sequence figure in this manual
claim: Each arrow style marks one kind of exchange, and every label is a real name, message, or number from our recorded runs.
caption: Read each numbered row from the tail of the arrow to its head, and the note under each label names the style. From capture/out/cache-experiment.txt, server-default.log, and the out-of-memory run in section 3.2.
```

Sources: manual.json; capture/gpu/out-l4/server-default.command.txt, capture/gpu/out-l4/generate.txt; capture/out/serve-help.txt, cache-experiment.txt, server-default.log; docs/docs/get-started/install.mdx at v0.5.22.
