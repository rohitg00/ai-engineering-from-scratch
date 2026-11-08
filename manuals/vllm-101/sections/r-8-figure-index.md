# Index of figures

> Every figure of this manual, in order, by the one claim it makes.

Each row links to its figure. Measured numbers in a figure come from [our runs on the GPUs](manuals/vllm-101/capture/gpu), and each section links the files it uses. The colours follow the palette of the front matter:

- blue is the vLLM server: the API server process and the engine core
- violet is the model and its forward pass: kernels, attention backends, CUDA graphs
- green is the KV cache: blocks, the block pool, cached prefixes
- plum is model compute: prefill and decode steps
- olive is the client and the network: HTTP, the OpenAI API, the benchmark client
- indigo is streams and messages between processes, and streamed tokens
- amber is lifecycle: request states and scheduler steps
- teal is durable state: weights on disk, host memory, offloaded KV
- rose is failure: out of memory, preemption, aborts, crashes
- grey is outside vLLM: the operating system, other programs, the GPU driver

```figure-index
```

Sources: the figure blocks of front.md and of every file under sections/; manual.json (palette)
