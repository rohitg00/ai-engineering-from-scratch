# Run vLLM in production

> vLLM releases every two weeks, so pin the image and plan for cold starts and upgrades.

Your server must survive restarts and upgrades. When you finish this section, you can deploy a server that starts fast and upgrades safely.

## Pin the image

Pin an exact version, such as `vllm/vllm-openai:v0.31.0`, never `latest`. A new minor release comes about every two weeks, and each one changes defaults or removes flags. Between 0.30 and 0.32, for example:

- Release 0.31 made `--enforce-eager` also skip the kernel warmup.
- Release 0.31 renamed a Mamba prefix-cache flag and removed the slow tokenizer mode.
- Release 0.32 dropped Python 3.10 and changed the default CORS origins from every origin to none.

The last change breaks any browser client that calls the server directly. After an upgrade to 0.32, set `--allowed-origins` to the origins you trust.

## Plan for the cold start

A start has three slow parts: the weight load, the compile, and the CUDA graph capture. On our DGX Spark, the model load alone took 330 seconds for 57 GiB.

- **Weights.** Keep them on a local disk. A network mount or a fresh download makes every start slower.
- **Compile.** vLLM caches compiled code under `~/.cache/vllm`. Keep that folder on a persistent volume, so a restart reuses it.
- **Preload.** Release 0.31 added `vllm preload`, which loads and warms a model before the server needs it.

`vllm bench startup` measures a cold and a warm start. Run it once for each new image.

Not measured on our hardware. We have not timed a warm start with a kept compile cache.

## Check health before traffic

Use `/health` for the liveness probe. For readiness, send one short real request, which proves that the engine can generate. Give both probes a start delay longer than your measured cold start.

## Shut down cleanly

Send `SIGTERM` to the server process, not a forced kill. Before the shutdown, remove the pod from the load balancer so that no new requests arrive. Give the pod a grace period at least as long as your longest request. A forced kill drops every running request.

## Change settings in this order

Change one setting at a time, and measure after each change:

1. The memory: the maximum length and the memory fraction.
2. The concurrency: `--max-num-seqs` and the token budget.
3. The data types: an FP8 KV cache, then FP8 weights.
4. The speed features: speculative decoding and the compile level.

Each later step depends on the ones before it. A speed feature measured on a server that runs out of memory measures the memory, not the feature.

## Read the security advisories

The vLLM project published dozens of security advisories in the weeks around 0.31 and 0.32. Several were rated high. Many came through multimodal inputs, and some through the KV transfer connectors. Do not expose the server to the internet without a gateway in front of it. Use `--api-key`, as [the server options page](#s-set-the-server-options-every-deployment-needs) shows, and read the advisories before you pick a release.

```takeaways
- Pin an exact image, and read the breaking changes before every upgrade.
- Keep weights and the compile cache on local, persistent storage.
- Use /health for liveness, a real request for readiness, and SIGTERM after you drain traffic.
- Read the security advisories before you pick a release.
```

Sources: the release notes for v0.30.0, v0.31.0, and v0.32.0, the GitHub security advisories of vllm-project/vllm (2026-09-21 to 2026-10-21), vLLM documentation at v0.31.0 (docs/design/torch_compile.md, docs/serving/online_serving/openai_compatible_server.md), the vLLM source at v0.31.0 (vllm/benchmarks/startup.py), capture/gpu/out-gb10/server-load-vllm.log.
