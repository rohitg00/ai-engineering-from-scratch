# Serve MoE models with expert parallelism

> Expert parallelism spreads the experts of a MoE model across GPUs, and one GPU can still serve a small MoE model.

You serve a mixture-of-experts model. When you finish this section, you can decide when expert parallelism helps.

**Our result:** one DGX Spark served Qwen3-30B-A3B without expert parallelism, at 239 tokens per second for 64 users.

## Know what changes with a MoE model

A mixture-of-experts layer has many experts, and each token uses only a few of them. `Qwen/Qwen3-30B-A3B-Instruct-2507` has 30 billion parameters, and about 3 billion are active for each token. So the model needs memory for all its weights, but each token costs compute for only a small part.

## Start with one device if the model fits

On our DGX Spark, one GB10 held the whole model in BF16. The weights took 56.93 GiB, and the server gave 239.3 tok/s at 64 users. One device needs no communication between GPUs. If the model and its KV cache fit, start there.

Our reading: a batch of many tokens uses many different experts, so a decode step reads more of the weights as the batch grows. On a device with limited memory bandwidth, that makes the time per token grow with the batch. On our GB10, the median time per token went from 32 ms at one user to 244 ms at 64 users.

## Add expert parallelism for large models

On one machine with eight GPUs, spread the experts across all of them:

```bash
vllm serve <model> --data-parallel-size 8 --enable-expert-parallel
```

For a model that does not fit one machine, such as the large DeepSeek models, run one command on each machine. This example uses two machines with eight GPUs each. First install DeepEP and DeepGEMM on both machines, as the expert parallel guide in the vLLM documentation describes. They are not part of the normal install, and a server with a DeepEP backend stops at startup without DeepEP. The first machine takes the requests:

```bash
vllm serve <model> --enable-expert-parallel \
  --all2all-backend deepep_low_latency \
  --data-parallel-size 16 --data-parallel-size-local 8 \
  --data-parallel-address 192.168.1.100 --data-parallel-rpc-port 13345
```

The second machine runs headless, with no API server. Its start rank is the count of ranks on the machines before it:

```bash
vllm serve <model> --enable-expert-parallel \
  --all2all-backend deepep_low_latency \
  --data-parallel-size 16 --data-parallel-size-local 8 \
  --data-parallel-start-rank 8 \
  --data-parallel-address 192.168.1.100 --data-parallel-rpc-port 13345 \
  --headless
```

Set the address to the IP of the first machine, and use the same RPC port on both. Across machines, the vLLM documentation uses the DeepEP kernels for the exchange of tokens.

With expert parallelism, each GPU holds some of the experts, and tokens travel to the GPU that holds their expert and back. The attention layers run in data parallel on each GPU. The all-to-all exchange of tokens needs fast links between the GPUs.

Two more features help at large scale:

- **Expert load balancing.** `--enable-eplb` moves busy experts to spread the load, because some experts receive far more tokens than others.
- **Elastic expert parallelism.** It adds or removes GPUs from a running deployment. Release 0.32 brought it to Model Runner V2.

Not measured on our hardware. We have one GPU on each machine, so we have not run expert parallelism.

## Check the setup

On a multi-GPU deployment, watch the time per token as the load grows, and compare it with the same model on fewer GPUs. If the time per token rises faster than the output, the exchange between GPUs limits the step.

```takeaways
- A MoE model needs memory for all its experts and compute for only a few.
- Start on one device if the model fits, because one device needs no exchange.
- Use expert parallelism with fast links for models too large for one machine.
```

Sources: capture/gpu/summary/gb10.json (load.vllm), capture/gpu/out-gb10/server-load-vllm.log, vLLM documentation at v0.31.0 (docs/serving/expert_parallel_deployment.md), the vLLM source at v0.31.0 (vllm/config/parallel.py), the release notes for v0.32.0.
