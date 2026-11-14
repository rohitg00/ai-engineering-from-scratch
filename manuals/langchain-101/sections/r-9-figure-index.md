# Index of figures

> Every figure of this manual, in order, by the one claim that its caption makes.

Each row links to its figure, and the claim is the `claim:` field of the figure block. The build numbers the figures of each part in the order they appear, so a figure number is its place in its part. A measured number in a figure comes from [our recorded runs](manuals/langchain-101/capture/lab), and each chart reads one file of [the summary folder](manuals/langchain-101/capture/lab/summary). The colours follow the palette of the front matter:

- violet is your code: the caller, its input, and its config
- blue is LangChain: `create_agent`, middleware, messages, and tools as objects
- indigo is LangGraph: the graph, its nodes, the Pregel loop, and its streams
- plum is the chat model and each model call
- green is tools and the results they return
- olive is a service outside the process, such as a provider, LangSmith, or Ollama
- amber is lifecycle: steps, next nodes, interrupts, and resumes
- teal is durable state: checkpoints, stores, and their rows
- rose is a failure: an exception, an error message, or a repeated side effect
- grey is outside LangChain: Python, packages, the machine, and the operator

```figure-index
```

Sources: the figure blocks of front.md and of every file under sections/; manual.json (palette)
