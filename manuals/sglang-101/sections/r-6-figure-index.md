# Index of figures

> Every figure of this manual, in order, by the one claim its caption makes.

Each row links to its figure, and the claim is the `claim:` field of each figure block. Measured numbers in a figure come from our runs [on the Mac](manuals/sglang-101/capture/out) or [on the GPUs](manuals/sglang-101/capture/gpu), and each section links the files it uses. Numbers from a field report name the report. The colours follow the palette of the front matter:

- blue is the SGLang server process: the tokenizer manager, the scheduler, and the detokenizer
- violet is the model and its forward pass: kernels, attention backends, and CUDA graphs
- green is the KV cache: pool slots, radix tree nodes, and cached tokens
- plum is model compute: prefill and decode steps
- olive is the client and the network
- indigo is streams and messages
- amber is a lifecycle state, such as a request state or a scheduler phase
- teal is durable state: host memory, storage tiers, and weights on disk
- rose is a failure: out of memory, retraction, an abort, or a crash
- grey is outside SGLang: the operating system, other programs, and the GPU driver

```figure-index
```

Sources: the figure blocks of front.md and of every file under sections/; manual.json (palette)
