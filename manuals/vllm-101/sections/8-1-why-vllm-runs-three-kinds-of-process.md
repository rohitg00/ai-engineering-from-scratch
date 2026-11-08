# Why vLLM runs three kinds of process

> This page explains the API server, the engine core, and the workers, and why they are separate processes.

`vllm serve` with one GPU starts three processes, and the count grows with every GPU you add. When you finish this section, you can name each process, say what it owns, and predict the process count for a parallel setup.

## Three jobs that compete for one CPU

A serving engine does three kinds of work. It speaks HTTP and turns text into tokens and back. It decides which requests run in the next step. It runs the model on the GPU.

In one Python process, these jobs take turns on one interpreter lock. While the server tokenizes a long prompt, the scheduler waits, and the GPU waits for the scheduler. On a fast GPU, a decode step takes only milliseconds. A few milliseconds of Python work between steps then leaves the GPU idle for a large share of the time.

vLLM gives each job its own process:

| Process | What it owns | How many |
|---|---|---|
| API server | HTTP, the OpenAI routes, tokenization, multimodal input, and the stream back to the client | one by default, or one for each data-parallel rank |
| Engine core | the scheduler, the KV cache manager, and the loop that sends work to the workers | one for each data-parallel rank |
| GPU worker | the weights and the forward pass on one GPU | one for each GPU, so tensor size times pipeline size for each engine core |

The API server and the engine core exchange messages over ZeroMQ sockets. The engine core and its workers share memory queues. A data-parallel setup adds one more process, a coordinator that keeps the ranks in step.

## Count the processes

The vLLM design documents give a formula for the count. Add the API servers, the data-parallel engine cores, and the GPU workers, plus one coordinator for data parallelism. A server with `-tp 4` runs one API server, one engine core, and four workers, so six processes.

This matters when something goes wrong. A crash in a worker shows up in the engine core log. A slow tokenizer shows up as a long time to first token while the GPU is idle. When you read a log, first find which process wrote the line.

```figure
id: fig-8-1
kind: tree
title: six processes for four GPUs
claim: A server with tensor parallel size 4 runs six processes: one API server, one engine core, and four GPU workers.
caption: Read from the top down. Each worker owns one GPU. From the vLLM design documents at v0.31.0.
```

## Why not threads

Threads in one Python process share the interpreter lock, so they would not remove the wait. Separate processes also let vLLM restart or replace one part. The repository also has an experimental front end written in Rust. It replaces the Python API server and talks to the same engine core over the same sockets.

Separate processes have a cost: each request and each output is copied across a process boundary. The copy is small next to a model step, so the design accepts it. An environment variable, `VLLM_ENABLE_V1_MULTIPROCESSING=0`, runs the engine core in the API server process instead. The reproducibility guide uses it for offline runs, because one process makes the order of scheduling repeatable.

```takeaways
- The API server, the engine core, and the workers each run in their own process.
- Count processes as API servers plus engine cores plus GPU workers, plus a coordinator for data parallelism.
- Find the process that wrote a log line before you read the line.
```

Sources: the vLLM source at v0.31.0 (vllm/v1/engine/core.py, vllm/v1/engine/core_client.py, vllm/v1/executor/multiproc_executor.py, vllm/envs.py, rust/README.md), vLLM documentation at v0.31.0 (docs/design/arch_overview.md, docs/usage/reproducibility.md).
