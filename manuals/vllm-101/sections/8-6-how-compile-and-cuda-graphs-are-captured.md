# How compile and CUDA graphs are captured

> This page explains torch.compile, piecewise and full graphs, and the capture sizes.

vLLM spends the last part of every start on compiling and capturing. When you finish this section, you can say what each optimization level turns on, and why a full CUDA graph cannot cover every batch.

## Two separate tools

**torch.compile** traces the model's Python code into a graph and generates fused kernels. Fusion joins small operations, such as a norm and a quantize step, into one kernel. The compiled code goes to a cache under `~/.cache/vllm/torch_compile_cache`. A second start with the same settings skips most of the work. The server finishes all compiles before it serves the first request.

**A CUDA graph** records a sequence of kernel launches with fixed shapes and replays it with one CPU call. A decode step for a small batch is hundreds of short kernels, and a graph removes the CPU cost of launching each one.

## The graph modes

A graph needs fixed shapes, and attention does not always have them. A batch can mix prompts of different lengths. vLLM handles this with modes:

| Mode | What it records |
|---|---|
| `NONE` | nothing |
| `PIECEWISE` | everything except attention, in pieces around each attention call |
| `FULL_DECODE_ONLY` | the whole step, only for batches of single-token decodes |
| `FULL_AND_PIECEWISE` | the whole step where the attention backend allows it, and pieces otherwise |

The default is `FULL_AND_PIECEWISE`. At run time, a dispatcher picks a mode for each batch from its token count, its request count, and whether it is uniform. If the attention backend cannot replay a full graph for a batch, the dispatcher uses the piecewise one.

On the L4 and the GB10, FlashAttention 2 supports full graphs only for uniform batches, such as pure decode steps. A mixed batch with a new prompt runs piecewise.

## The optimization levels

`-O0` to `-O3` set compile and graphs together:

| Level | Compile | Graphs | Fusions |
|---|---|---|---|
| `-O0` | off | off | off |
| `-O1` | on | piecewise | norm and activation quantize |
| `-O2`, the default | on | full and piecewise | more, such as all-reduce with norm |
| `-O3` | the same as `-O2` at 0.31.0 | | |

A flag that you set yourself wins over the level. `--enforce-eager` turns off compile and graphs in one switch. Since 0.31.0 it also turns off the kernel warmup at startup, which `-O0` keeps.

## Capture sizes

vLLM captures graphs for a list of batch sizes. A batch larger than the largest size runs without a full graph. `--max-cudagraph-capture-size` sets the largest size, and `--cudagraph-capture-sizes` sets the list. More sizes cost startup time and GPU memory, which comes out of the KV pool.

`vllm bench startup` measures the start with a cold and a warm compile cache, so you can see what each choice costs.

```takeaways
- torch.compile fuses kernels, and CUDA graphs remove launch cost. They are separate tools.
- The default mode records full graphs where the attention backend allows it, and pieces elsewhere.
- -O2 is the default, -O3 equals -O2 at 0.31.0, and --enforce-eager also skips the warmup.
```

Sources: the vLLM source at v0.31.0 (vllm/config/compilation.py, vllm/config/model.py, vllm/v1/attention/backends/flash_attn.py, vllm/benchmarks/startup.py), vLLM documentation at v0.31.0 (docs/design/optimization_levels.md, docs/design/torch_compile.md, docs/design/cuda_graphs.md), the release notes for v0.31.0.
