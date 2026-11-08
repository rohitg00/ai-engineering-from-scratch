# Split prefill and decode

> Separate prefill and decode servers pay only when long prompts hurt the stream of other users.

Long prompts slow the stream for every user. When you finish this section, you can decide when disaggregated serving pays.

## Know the problem it solves

On one server, a long prompt shares each step with the running streams. While it computes, every stream waits a little longer for its next token. With many long prompts, the worst token gaps grow for everyone.

Disaggregated serving runs two kinds of server. A prefill server computes the prompt and builds its KV cache. A decode server receives that cache and generates the answer. Long prompts then never share a step with a stream.

## Know what it does not solve

The vLLM documentation says that disaggregated prefill does not raise throughput. It gives you control over the first token and the stream as two separate numbers, and it controls the tail of the inter-token latency. It costs a transfer of the KV cache for every request, and more servers to run.

Even for the tail, the gain is a condition, not a default. The paper "Revisiting Disaggregated Large Language Model Serving for Performance and Energy Implications" compared split servers with servers that run both stages. It found that the gain is not guaranteed and depends on the request load and on the path that moves the KV cache. We did not measure this ourselves.

Pick it when the 99th percentile of the inter-token latency matters and long prompts cause it. Do not pick it to serve more users on the same GPUs. Before you keep it, compare it with the same GPUs run as plain servers, at your real load.

## Set it up

Each server gets a KV connector and a role in `--kv-transfer-config`. The NIXL connector is the common choice. It needs the NIXL library, which the vLLM wheel does not install. Install it in the same environment as vLLM first. The vLLM requirements at 0.31.0 pin version 1.4.1:

```bash
uv pip install nixl==1.4.1
```

The prefill server produces the cache, and the decode server consumes it. On one host with two GPUs, give each server its own GPU, its own port, and its own NIXL side channel port:

```bash
CUDA_VISIBLE_DEVICES=0 VLLM_NIXL_SIDE_CHANNEL_PORT=5600 \
vllm serve Qwen/Qwen3-8B --port 8100 \
  --kv-transfer-config '{"kv_connector": "NixlConnector", "kv_role": "kv_producer"}'
```

```bash
CUDA_VISIBLE_DEVICES=1 VLLM_NIXL_SIDE_CHANNEL_PORT=5601 \
vllm serve Qwen/Qwen3-8B --port 8200 \
  --kv-transfer-config '{"kv_connector": "NixlConnector", "kv_role": "kv_consumer"}'
```

Each server writes `Creating v1 connector with name: NixlConnector` and `Initializing NIXL wrapper` in its startup log. If the log shows `NIXL is not available`, the library is missing from the environment.

Then put a router in front. For each request, the router sends the request to the prefill server first and reads the KV transfer parameters from its response. It then sends the request to the decode server with those parameters, so that the decode server can load the cache. The vLLM repository has example scripts and a proxy for this setup. Its own CI tests it on pairs of L4 GPUs.

If a cache transfer fails, the default policy fails the request. The `kv_load_failure_policy` field set to `recompute` computes the prompt again on the decode server instead.

Not measured on our hardware. We have not run disaggregated serving with vLLM on two L4s.

```figure
id: fig-6-3
kind: flow
title: prefill and decode on two servers
claim: A prefill server computes the prompt, and a KV connector copies its cache to a decode server that writes the tokens.
caption: Teal arrows move the KV cache. The dotted arrow is the token stream. From the vLLM documentation at v0.31.0.
```

## Size the two sides

The ratio of prefill to decode servers depends on your prompt and answer lengths. Long prompts with short answers need more prefill capacity. Short prompts with long answers need more decode capacity. Measure the first token and the stream on each side, and move one server at a time.

```takeaways
- Split prefill and decode to protect the stream from long prompts, not to raise throughput.
- Each server needs a KV connector and a role, and a router sends each request to both.
- Set the failure policy, because the default fails the request.
- Compare it with plain servers on the same GPUs, at your real load, before you keep it.
```

Sources: vLLM documentation at v0.31.0 (docs/features/disagg_prefill.md, docs/features/nixl_connector_usage.md), the vLLM source at v0.31.0 (vllm/config/kv_transfer.py, vllm/distributed/kv_transfer/), the vLLM CI configuration at v0.31.0 (.buildkite), Revisiting Disaggregated Large Language Model Serving for Performance and Energy Implications (arXiv 2601.08833), requirements/kv_connectors.txt at v0.31.0, the vLLM source at v0.31.0 (vllm/distributed/kv_transfer/kv_connector/factory.py, vllm/distributed/kv_transfer/kv_connector/v1/nixl/base_worker.py).
