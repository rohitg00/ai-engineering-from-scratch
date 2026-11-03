---
id: tensor-pipeline-or-data-parallel
title: Choose tensor, pipeline or data parallelism
card: inference-serving
kind: design
level: 2
roles: [inference-engineer]
rounds: [system-design, screen]
tags: [tensor-parallel, pipeline-parallel, data-parallel, nvlink, multi-gpu]
minutes: 10
lessons: []
manuals: [vllm-101#s-choose-tensor-pipeline-or-data-parallelism, sglang-101#s-tp-size-dp-size-and-attn-dp-size]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You have a model that does not fit on one GPU, or you need more throughput than one GPU gives. Walk me through how you choose between tensor, pipeline and data parallelism, and what each one costs in communication.

## Short answer

Ask three questions. If the model fits on one GPU with room for the KV cache you need, use data parallelism, one full copy per GPU, and the output grows with the copies. If it does not fit, split it: tensor parallelism inside one machine when the GPUs have a fast link and the GPU count divides the attention heads, and pipeline parallelism when they do not or when the model needs more than one machine. Tensor parallelism talks after every layer, pipeline parallelism once per stage boundary, and data parallelism not at all between copies.

## Full answer

### Three questions

| Question | If yes | If no |
|---|---|---|
| Does the model fit on one GPU, with room for the KV cache you need? | Data parallelism: one copy per GPU, `--data-parallel-size N`. | Split the model; the next question decides where. |
| Does the split model fit inside one machine? | Keep the split inside the machine; the next question picks the layout. | Add pipeline parallelism across machines. |
| Do the GPUs have NVLink, and does the GPU count divide the model evenly? | Tensor parallelism, `--tensor-parallel-size N`. | Pipeline parallelism inside the machine, `--pipeline-parallel-size N`. |

Across machines: set the pipeline size to the number of machines and the tensor size to the GPUs in each machine. The tensor size must divide the attention-head count. If the GPUs in a machine do not divide it, use a tensor size of 1 and put the whole GPU count into the pipeline size.

### What each layout costs

| Layout | What it splits | Communication | Best for |
|---|---|---|---|
| Tensor | each layer across GPUs | after every layer, so it needs a fast link | a model too big for one GPU, inside one machine |
| Pipeline | the layers into stages | once per stage boundary | a model too big for one machine, or GPUs without a fast link |
| Data | nothing, each GPU holds a copy | none between copies | more output from a model that fits |
| Expert | the experts of a mixture-of-experts model | before and after the expert layers | large expert models |

Tensor parallelism also splits the KV cache, so each GPU has more room for it. When the weights fill most of one GPU, two GPUs can hold several times the pool of one. The exception is a model with multi-head latent attention: it stores one compressed latent per token that cannot be split across heads, so every tensor-parallel rank keeps the full cache and more ranks add no tokens. Attention data parallelism answers that case.

### Check the link

Tensor parallelism sends data after every layer. On GPUs joined only by PCIe, such as two L4s in one host, that traffic can cost more than the split saves. The vLLM documentation suggests pipeline parallelism on such a machine, because it sends data only at stage boundaries, and it also accepts a GPU count that does not divide the model evenly. The manual did not run either layout on its two L4s, so measure them against each other before you pick.

### Start a second machine

Run the collective test script on both machines first. When the network and the drivers work, each process prints its success lines. Then start the server with a launcher that spans the machines, and start the API on one machine only. The traffic between the machines is not encrypted and can run code on the other side, so keep it on a private network.

### Count the processes

With data parallelism vLLM starts one engine core per copy and one coordinator that keeps them in step. With tensor parallelism it starts one worker per GPU under one engine core. In SGLang the world size is `--tp-size` times `--pp-size`, and `--dp-size` copies get a controller that sends each request to one copy, round robin by default. That controller does not look at pools or queues. On the manual's two L4s, where one card was shared and its copy had a pool of 2,925 tokens against 24,094, the pair served less than one card at every load.

### Give a tensor group whole GPUs

Before SGLang loads weights for a tensor group, each rank measures its free memory and the group keeps the smallest value. If that value is under 90 percent of the local free memory, the server stops. On the shared pair the second card had 18.28 GB free against the 19.53 GB that the check required, so `--tp-size 2` refused to start, and no flag turns the check off. Every rank holds the same share of weights and the same pool, so the smallest card sets the size for all of them.

### Very long prompts

For prompts of hundreds of thousands of tokens, vLLM can split one sequence across GPUs with context parallelism. Use it when one long request is the problem, not when many short ones are.

## Follow-ups

- **Level 2:** Two GPUs in one host joined by PCIe only, and the model fits on one. What do you run? Expected: data parallelism, two full copies, because nothing moves between copies; tensor parallelism would pay after every layer over the slow link.
- **Level 3:** The model needs two machines of 8 GPUs. How do you set the sizes, and what do you check first? Expected: pipeline size 2 for the machines and tensor size 8 inside each, with 8 dividing the attention heads; run the collective test on both machines first and keep the traffic on a private network, because it is not encrypted.
- **Level 3:** Tensor parallelism on two GPUs where one is shared with another job. What does SGLang do at startup? Expected: it measures free memory on each rank, keeps the smallest, and stops if that is under 90 percent of the local free memory, because every rank holds the same share and pool; give the group whole GPUs.
- **Level 4:** Why does tensor parallelism add no KV capacity when the attention keeps one latent per token? Expected: that attention stores one compressed latent per token that cannot be split across heads, so every rank keeps the full cache; attention data parallelism gives each group its own requests and cache, so capacity grows with the groups.

## Wrong answers

- "Tensor parallelism is the default way to use more GPUs." It is the way to make a model fit; when the model fits, data parallelism adds output with no traffic between copies, and tensor parallelism over PCIe can cost more than it saves.
- "More copies always mean more throughput." Only when every copy has about the same pool; a pair where one copy had an eighth of the pool served less than one card, because the round-robin controller fed it half the requests.
- "Pipeline parallelism is only for several machines." Inside one machine it is the choice when the GPUs lack a fast link or when the GPU count does not divide the model evenly.
- "Any GPU count works with tensor parallelism." The size must divide the attention-head count of the model; otherwise use a tensor size of 1 and put the whole count into the pipeline size.

## Taught in

[Choose tensor, pipeline, or data parallelism](../../../manuals/vllm-101/sections/6-1-choose-tensor-pipeline-or-data-parallelism.md) gives the decision tree, and [the SGLang parallelism section](../../../manuals/sglang-101/sections/6-1-tp-size-dp-size-and-attn-dp-size.md) adds the memory balance check and the unequal pair.
