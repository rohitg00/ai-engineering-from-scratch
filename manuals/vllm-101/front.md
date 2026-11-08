# How to read this manual

> This manual helps you serve, size, tune, and debug open models with vLLM, and it gives a measured answer for each decision.

The vLLM documentation tells you what each flag does. This manual tells you which flags matter for your GPU and your traffic, and what happened when we changed them.

## Start here

These commands give you a server:

```bash
uv venv --python 3.12 --seed
source .venv/bin/activate
uv pip install vllm==0.31.0 --torch-backend=auto
vllm serve Qwen/Qwen3-0.6B --reasoning-parser qwen3 2>&1 | tee server.log
curl http://localhost:8000/v1/models
```

Run the `curl` command in a second terminal. [Part 1](#s-install-vllm-and-serve-your-first-model) walks through each command and the output you should see.

## What you can do after this manual

- Install vLLM, serve a model, and read the startup lines that decide most answers.
- Predict how many users fit on your GPU, and fix an out-of-memory failure at startup.
- Pick the one or two flags that matter for your traffic, and leave the rest at the default.
- Decide from a measurement when speculative decoding, FP8, or a compile level pays.
- Debug a slow or broken server from the symptom you see.

## Who this manual is for

You have called a model through an API, and now you want to serve an open model yourself. You know what a token and a GPU are. You have not read the code of a serving engine, and you do not need to.

## How the parts are ordered

Parts 1 to 7 follow the order of your work. You start a server, size it, tune it for your traffic, add speed features, measure it, scale it, and run it. Each page answers one question and ends with a check that proves the change worked.

Part 8 explains how vLLM works inside. Read it when a default surprises you. The reference pages hold the flag table, the metrics, the incident index, and the lab notes.

```parts
```

## What we tested on

We tested on vLLM 0.31.0 with an NVIDIA L4 and a DGX Spark. The L4 served Qwen3-8B, and the DGX Spark served Qwen3-30B-A3B. Each measured number in this manual names its machine. [The lab notes](#s-ref-lab-notes) give the seeds, the clocks, and the full tables.

### Four L4 sessions {#l4-sessions}

The L4 did not run at one speed. Its SM clock changed with its temperature and with other work on the node. So the same Qwen3-8B load gave different times in different sessions. Each L4 table in this manual names its session. Compare two numbers only inside one session.

| Session | Dates | Median SM clock | 1 user, median TPOT | 32 users, output tok/s |
|---|---|---|---|---|
| full clock, cooled before each run | 2026-10-17 to 2026-10-21 | 1,000 to 1,560 MHz | 60.4 ms | 273.9 to 275.1 |
| throttled | 2026-10-22 | 210 MHz at 1 user, 450 MHz at 32 users | 104.1 ms | 186.7 |
| locked at 900 MHz | 2026-10-22 | 881 to 900 MHz, 210 MHz for the 1-user baseline | 99.0 ms | 208.8 |
| shared GPU, pool of 2,928 tokens | 2026-10-22 | 368 to 450 MHz | 241.7 ms | not run |

A throttled GPU runs below its full clock because it is too hot or because it shares power with other work. A lock with `nvidia-smi -lgc` sets the highest clock. It cannot stop a hot GPU from slowing down below the lock.

Sources: vLLM documentation at v0.31.0 (docs/getting_started/quickstart.md, docs/features/reasoning_outputs.md), capture/gpu/summary/l4.json, capture/gpu/summary/l4-gpu1.json, capture/gpu/summary/gb10.json.
