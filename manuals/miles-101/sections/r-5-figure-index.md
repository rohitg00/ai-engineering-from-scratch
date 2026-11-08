# Index of figures

> Every figure of this manual, in order, by the one claim its caption makes.

Each row links to its figure, and the claim is the `claim:` field of each figure block. Every measured number in a figure comes from our runs on one DGX Spark. The charts read the [summary of those runs](manuals/miles-101/capture/gpu/summary/miles-gb10-lab.json) when the manual is built. The colours follow the palette of the front matter:

- blue is the trainer: the FSDP actor, its weights, and its optimizer
- violet is the rollout engine: the SGLang server that writes the answers
- green is data and rewards: prompts, answers, groups, and scores
- amber is a lifecycle step, such as a phase of a training step or a weight update
- teal is durable state: checkpoints, logs, and the summary files
- rose is a failure: a dead engine, an out-of-memory kill, or a crash
- grey is outside Miles: the host, Docker, and Ray

```figure-index
```

Sources: the figure blocks of front.md and of every file under sections/; manual.json (palette)
