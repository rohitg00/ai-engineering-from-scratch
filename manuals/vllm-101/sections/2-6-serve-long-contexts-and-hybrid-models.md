# Serve long contexts and hybrid models

> A long context and a hybrid model each change how vLLM counts memory, and both can fail at startup for a reason the error hides.

You want a context longer than the default, or you serve a model that mixes attention layers with sliding-window or state-space layers. When you finish this section, you can set the maximum length on purpose and read what the cache does for each kind of layer.

We did not run a long-context or a hybrid model for this manual. This page comes from the vLLM documentation, the source at 0.31.0, and the release notes.

## Set the maximum length on purpose

If you do not set `--max-model-len`, vLLM takes the length from the model config. For `Qwen/Qwen3-8B` that is 40,960 tokens. At 144 KiB per token, one request at that length needs 5.6 GiB of KV cache. On a 24 GB GPU, the 16.4 GB of weights can leave room for less than one such request, and then the start fails.

Set `--max-model-len` to the longest prompt plus answer that your users send. The pool size stays the same. A shorter limit only stops one request from claiming the whole pool, and it lets the start check pass.

## Check the length after an upgrade

Some models extend their context with a scaling method such as YaRN. In release 0.30.0, vLLM changed its YaRN handling to match the Hugging Face Transformers library. For some models, the length that vLLM derives from the config became shorter. The release notes give one model that went from 131,072 to 32,768 tokens.

After an upgrade, read the derived length in the startup log. If it changed, set `--max-model-len` yourself, or check that the model still supports the longer length.

## Know how a hybrid model uses the cache

A hybrid model has more than one kind of layer. vLLM puts each kind in its own KV cache group. The table gives the rules for each group.

| Layer kind | What it keeps | When a cached prefix is a hit |
|---|---|---|
| Full attention | keys and values for every token | every block of the prefix is still in the cache |
| Sliding window | keys and values for the last window of tokens | the blocks inside the last window are still in the cache |
| State space, such as Mamba | one state for each request, not one entry for each token | a saved state must exist for that point in the prompt, and the rules for saving it changed between releases |

The group design lets one pool serve all the kinds. It also means that the prefix-cache hit rate of a hybrid model differs from the hit rate of a full-attention model with the same prompts.

## Avoid the removed and renamed flags

Hybrid support changes fast. Three changes between 0.29 and 0.32 matter:

- The `all` mode for the Mamba cache was deprecated in 0.30, and it made vLLM use the older model runner. Release 0.32 removed it.
- Release 0.31 renamed `--enable-mamba-fine-grained-prefix-cache` to `--enable-mamba-shared-prefix-checkpoint`.
- After the removal of the `all` mode, an open issue reports that `--mamba-block-size` has no effect.

If a hybrid model starts slower or uses more memory after an upgrade, check these flags first. `--disable-hybrid-kv-cache-manager` turns the groups off, as a test of whether the groups cause the problem.

## Check the setup

Start the server and read the pool line. It gives the maximum concurrency at your maximum length:

```bash
grep "GPU KV cache size" server.log
```

The pool line prints only when the start succeeds. If the start stops with the error about the KV cache and the maximum length, lower `--max-model-len` until the pool line prints. Then read its concurrency, and compare it with the users you plan to serve at full length.

```takeaways
- Set the maximum model length to your longest request, not to the model limit.
- Read the derived length after every upgrade.
- Expect a different prefix-cache hit rate on a hybrid model, and test it on your prompts.
```

Sources: vLLM documentation at v0.31.0 (docs/design/hybrid_kv_cache_manager.md, docs/configuration/optimization.md), the vLLM source at v0.31.0 (vllm/config/scheduler.py, vllm/config/cache.py), the release notes for v0.30.0, v0.31.0, and v0.32.0, vLLM issue 60838, the model config of Qwen/Qwen3-8B.
