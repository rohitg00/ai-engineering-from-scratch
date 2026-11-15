# A retrieval agent over a local corpus

> A retrieval agent has two parts that fail apart: the retriever finds the right passage or not, and the model calls the retriever or not, so test each one.

Your team wants answers from its own documents, with the file named after each claim. You build a vector store and give the agent a search tool. The first answers look fine. Then someone asks a question that a document answers word for word, and the agent says the documents do not cover it.

When you finish this section, you can build a retrieval agent on a local embedding model and record the source of each answer. You can also say if a wrong answer came from the retriever or from the model.

## What the demo builds

The corpus is six lesson files of this repository, on embeddings, RAG, LangGraph, agent frameworks, and durable execution. They hold about 89,600 characters. The repository is MIT licensed, so the demo reads the files where they are, and records their SHA-256.

The demo applies these sections:

- [Embeddings, splitters, vector stores, and retrievers](#s-embeddings-splitters-vector-stores-and-retrievers): the splitter, the store, and `create_retriever_tool`.
- [Tools, ToolRuntime, and tool errors](#s-tools-toolruntime-and-tool-errors): the model sees only the content of a `ToolMessage`, so the source path goes into that text.
- [The system prompt](#s-the-system-prompt): the rule to cite each claim, and to say when the lessons do not cover a question.

## The pipeline

`nomic-embed-text` expects a task prefix on each text: `search_document:` for a passage and `search_query:` for a question. `OllamaEmbeddings` sends each text as it gets it {{code langchain_ollama/embeddings.py}}, so the demo wraps it:

```listing
title: the embedding wrapper
source: capture/demos/retrieval-agent/retrieval_agent.py
lang: python
---
class NomicEmbeddings(Embeddings):
    def __init__(self, model="nomic-embed-text"):
        self.inner = OllamaEmbeddings(model=model)

    def embed_documents(self, texts):
        return self.inner.embed_documents([f"search_document: {t}" for t in texts])

    def embed_query(self, text):
        return self.inner.embed_query(f"search_query: {text}")
```

The splitter cuts the files into chunks of at most 1,000 characters with 150 of overlap. `add_start_index=True` keeps the offset of each chunk, so a hit names a place in a file. The store is `InMemoryVectorStore`, rebuilt on every run.

The tool comes from `create_retriever_tool`. Its document prompt writes the path in square brackets in front of each passage. With `content_and_artifact`, the documents also stay on the message as its artifact, so the script can check each citation against what the search returned:

```listing
title: the retriever as a tool
source: capture/demos/retrieval-agent/retrieval_agent.py
lang: python
---
    retriever = store.as_retriever(search_kwargs={"k": 4})
    search = create_retriever_tool(
        retriever,
        "search_lessons",
        "Search the engineering lessons. Returns the four best passages, each with its source path.",
        document_prompt=PromptTemplate.from_template("[{source}]\n{page_content}"),
        response_format="content_and_artifact",
    )
    agent = create_agent(model(), tools=[search], system_prompt=SYSTEM_PROMPT)
```

Before each agent run, the script searches the store itself and prints the top four hits. That line shows the retriever alone, whatever the model then does.

## The recorded run

The demo asks five questions. Four have an answer in one lesson file, and one, about which GPU to buy, has none. It runs once with Qwen3 4B and once with Qwen3 8B.

The split gave 122 chunks, and embedding them took 2.2 s. For the question about Matryoshka embeddings, the first hit was the right file. Qwen3 8B searched, answered, and cited that file:

```listing
title: one question, Qwen3 8B
source: capture/lab/retrieval-agent/run-8b.log
lang: text
---
== matryoshka: How much storage does Matryoshka truncation from 1536 to 256 dimensions save, and what does it cost in accuracy?
  top-4      0.791  phases/11-llm-engineering/04-embeddings/docs/en.md @ 12305
  top-4      0.664  phases/11-llm-engineering/06-rag/docs/en.md @ 4675
  top-4      0.658  phases/11-llm-engineering/04-embeddings/docs/en.md @ 21476
  top-4      0.654  phases/11-llm-engineering/04-embeddings/docs/en.md @ 12982
  search     Matryoshka truncation from 1536 to 256 dimensions
  returned   11-llm-engineering/04-embeddings, 11-llm-engineering/06-rag, 11-llm-engineering/04-embeddings, 11-llm-engineering/04-embeddings
  answer     Requesting 256 dimensions instead of 1536 cuts storage by 6x with roughly 3-5% accuracy loss on MTEB benchmarks [phases/11-llm-engineering/04-embeddings/docs/en.md].
  cited      phases/11-llm-engineering/04-embeddings/docs/en.md
  check      cited an expected source: True; every citation was returned by a search: True
  model calls 2, prompt tokens 1802, 10.3 s
```

Qwen3 4B got the same top four hits, because the retriever does not depend on the chat model. It never called the tool:

```listing
title: the same question, Qwen3 4B
source: capture/lab/retrieval-agent/run-4b.log
lang: text
note: The top four hits are cut. They are the same as in the run of Qwen3 8B.
---
== matryoshka: How much storage does Matryoshka truncation from 1536 to 256 dimensions save, and what does it cost in accuracy?
…
  answer     The lessons do not cover the topic of Matryoshka truncation, storage savings, or accuracy costs. Therefore, the lessons do not cover it [none].
  cited      nothing
  check      cited an expected source: False; every citation was returned by a search: True
  model calls 1, prompt tokens 291, 0.9 s
```

## What the run shows

**We measured** one run of each model on the Mac, Apple M1 Max, 10 cores, 64 GiB, with Ollama 0.31.1 and five questions per model.

| Question | Top hit is the right file | Qwen3 4B | Qwen3 8B |
|---|---|---|---|
| a field with no reducer | yes | no search, said not covered | no search, said not covered |
| Matryoshka truncation | yes | no search, said not covered | searched, cited the right file |
| reliability decay | yes | no search, said not covered | searched, cited the right file |
| the key of a checkpoint | yes | no search, said not covered | searched, cited the right file |
| which GPU to buy | not in the corpus | said not covered | said not covered |

The retriever put the right file first for all four questions that the corpus answers. The failures are all model results. Qwen3 4B answered every question from its own reading of the prompt and never called `search_lessons`. Qwen3 8B skipped the search once, on the reducer question. Every citation that either model wrote was a file that a search had returned in that run.

So when an answer says the documents do not cover a question, check the trace for a tool call before you tune the retriever. A run with no search is a model problem. A run with a search and the wrong passages is a retriever problem.

```takeaways
- Put the source path into the text of each passage, because the model sees only that text.
- Keep the documents as the artifact, and check each citation against them.
- Log the top hits of the retriever beside each answer, so you can test it alone.
- Check for a tool call before you tune chunks or embeddings.
- Add the task prefixes that your embedding model expects.
```

Sources: capture/demos/retrieval-agent/retrieval_agent.py, capture/demos/retrieval-agent/run.sh, capture/demos/retrieval-agent/README.md; capture/lab/retrieval-agent/run-4b.log, capture/lab/retrieval-agent/run-8b.log, capture/lab/retrieval-agent/run-4b.jsonl, capture/lab/retrieval-agent/run-8b.jsonl, capture/lab/retrieval-agent/corpus.txt, capture/lab/summary/demos-mac.json; libs/core/langchain_core/tools/retriever.py at langchain-core 1.8.0; langchain_ollama/embeddings.py at langchain-ollama 1.1.0.
