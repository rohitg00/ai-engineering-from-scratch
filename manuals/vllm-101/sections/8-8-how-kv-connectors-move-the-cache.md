# How KV connectors move the cache

> This page explains the connector interface and the transfer layers.

Some setups need the KV cache of a request in a place other than the GPU that computed it. When you finish this section, you can name the jobs a KV connector does, and say what disaggregated prefill buys and what it does not.

## Why move the cache

Three setups need it:

- **Disaggregated prefill.** One server computes the prompt, and another server generates the answer. The KV cache must move from the first to the second.
- **Offloading.** Blocks that do not fit on the GPU go to CPU memory or to storage. They come back when a later request needs the same prefix.
- **A shared cache.** Several servers read prefixes from one store, so a prefix computed once serves all of them.

## One interface, many transports

vLLM puts these jobs behind one interface, the KV connector. The scheduler asks the connector which blocks of a request it can load from outside. It then counts those tokens as computed, the same as a prefix-cache hit. The worker asks the connector to load or save the blocks around each forward pass.

At 0.31.0, the repository has connectors for several transports:

| Connector | What it moves the cache with |
|---|---|
| NIXL | the NVIDIA transfer library, over RDMA or the network |
| Mooncake | the Mooncake transfer engine |
| LMCache | the LMCache library, for CPU, disk, and shared stores |
| Offloading | the native offload to CPU memory |
| MultiConnector | two or more connectors together |

Set the connector with `--kv-transfer-config`, which gives the connector name, the role of the server, and the options of the transport. The role says whether the server produces the cache, consumes it, or does both.

## What disaggregation buys

The vLLM documentation says that disaggregated prefill does not raise throughput. It gives two other reasons to use it. You can tune the first token and the stream on separate servers. You can also keep long prompts from stalling the stream of other users, which controls the tail of the inter-token latency.

The price is a transfer for every request, and more machines to run. If a load fails, the default policy is to fail the request. A recompute policy exists as an option.

## Where it goes

The connector interface is one of the most active parts of the code. In October 2026, the open work had three parts. One was KV offloading that does not depend on the tensor-parallel size. Another was a compression layer for the transferred blocks. The last was a fix for blocks released during a remote read. Pin the version when you build on a connector, and read its open issues first.

```takeaways
- A KV connector lets vLLM load and save cache blocks outside the GPU that computed them.
- Disaggregated prefill controls the first token and the stream separately, and it does not raise throughput.
- Pin the version and read the open issues before you build on a connector.
```

Sources: the vLLM source at v0.31.0 (vllm/distributed/kv_transfer/, vllm/config/kv_transfer.py), vLLM documentation at v0.31.0 (docs/features/disagg_prefill.md, docs/features/nixl_connector_usage.md), vLLM issues 61886, 59538, and 61229.
