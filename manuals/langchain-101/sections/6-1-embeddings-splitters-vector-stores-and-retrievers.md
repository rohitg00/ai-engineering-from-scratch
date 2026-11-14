# Embeddings, splitters, vector stores, and retrievers

> The retrieval interfaces live in `langchain-core`, the splitters in `langchain-text-splitters`, and each store in a partner package, and an agent reaches a retriever through a tool.

You copy a retrieval example from 2024. It imports `RetrievalQA` from `langchain.chains` and a vector store from `langchain_community.vectorstores`. The first import fails at the pin, and the second one warns that its package is sunset.

When you finish this section, you can say which package holds each piece of a retrieval pipeline at the pin. You can also build the pipeline offline, and give it to an agent as a tool.

## Where each piece lives

**Retriever:** an object with `invoke(query)` that returns a list of `Document` objects. Its base class is `BaseRetriever` in `langchain-core`.

The 0.x namespace held loaders, splitters, stores, and chains in one package. At the pin they are spread over five places:

| Piece | Package at the pin | What is there |
|---|---|---|
| `Embeddings`, `VectorStore`, `BaseRetriever`, `Document` | `langchain-core` 1.8.0 | the base classes, `InMemoryVectorStore`, `DeterministicFakeEmbedding`, `create_retriever_tool`, and the indexing API |
| `init_embeddings` | `langchain` 1.5.0 | a model string such as `openai:text-embedding-3-small` to an embeddings object |
| text splitters | `langchain-text-splitters` 1.1.3 | `RecursiveCharacterTextSplitter`, `CharacterTextSplitter`, and splitters for Markdown, HTML, code, and JSON |
| a real store or embedding model | a partner package | such as `langchain-chroma`, `langchain-qdrant`, `langchain-openai`, and `langchain-ollama` |
| `MultiQueryRetriever`, `RetrievalQA`, `CacheBackedEmbeddings` | `langchain-classic` 1.0.8 | the old chains and retrievers, kept for migration |

The base classes are in core {{code libs/core/langchain_core/retrievers.py}}. `InMemoryVectorStore` keeps vectors in a dict and scores them with cosine similarity in NumPy {{code libs/core/langchain_core/vectorstores/in_memory.py}}. `langchain.embeddings` exports only `Embeddings` and `init_embeddings`, and its docstring says that the other embeddings modules moved to `langchain-classic` {{code libs/langchain_v1/langchain/embeddings/__init__.py}}. The v1 release notes list the old retrievers among the moves {{docs oss/python/releases/langchain-v1}}.

`langchain-community` 0.4.2 is its last release, and its repository is archived. Most loaders and stores of the 0.x years came from there. The Chroma and Qdrant packages live in the main repository, under `libs/partners`, and each has its own version. For any other store, look for a partner package before you install the community one.

LangChain Academy still teaches retrieval with a community loader. Its retrieval lesson loads a PDF with `PyPDFLoader` from `langchain-community` and stores the chunks in `InMemoryVectorStore` from core {{academy}}. Both work at the pin. Only the loader comes from the sunset package.

The documentation has no retrieval page in the LangChain tab. The Retrieval entry of the navigation opens a Deep Agents page {{docs oss/python/deepagents/retrieval}}. That page names two styles: a fixed retrieve-then-answer step, and an agent that decides when to search. The semantic search tutorial builds the pipeline of this section step by step {{docs oss/python/langchain/knowledge-base}}.

## The pipeline in the capture kit

[Figure](#fig-6-1) shows the pipeline of the kit. It runs at index time once, and the agent uses it at query time on each tool call.

```figure
id: fig-6-1
kind: flow
title: index time and query time of the retrieval capture
claim: Three files become seven chunks and seven vectors once, then each search_docs call asks a retriever that searches the same in-memory store.
caption: Read the top row from left to right for index time, then the bottom row for one tool call. The package of each piece is under its box. From capture/out/39-retrieval.txt and capture/s_integrations.py.
```

### The splitter

**Text splitter:** an object that cuts a document into chunks of at most `chunk_size` characters, with `chunk_overlap` characters repeated between two chunks.

`RecursiveCharacterTextSplitter` tries to cut at paragraph breaks first, then at line breaks, then at spaces. The kit cuts three short files with a size of 80 and an overlap of 20:

```listing
title: the first two chunks of checkpoints.md
source: capture/out/39-retrieval.txt
lang: json
note: Two of the seven chunks. The overlap is the words keeps it in a.
---
  {
    "source": "checkpoints.md",
    "chars": 77,
    "text": "A checkpointer saves graph state after each step. InMemorySaver keeps it in a"
  },
  {
    "source": "checkpoints.md",
    "chars": 75,
    "text": "keeps it in a dict. SqliteSaver writes it to a file, so a thread survives a"
  },
```

The splitter cuts at a space, so a chunk ends in the middle of a sentence. The first chunk stops at `in a`, and the next chunk repeats those words. Each chunk keeps the `source` metadata of its file, because the kit passed it to `create_documents`.

### The embedding model

**Embedding model:** an object with `embed_query` and `embed_documents` that turns text into a vector of numbers.

The kit uses `DeterministicFakeEmbedding` from core. It seeds a random vector with a hash of the whole text, so the same text gives the same vector on every run {{code libs/core/langchain_core/embeddings/fake.py}}. Its docstring says to use it only in tests.

```listing
title: the fake embedding is deterministic
source: capture/out/39-retrieval.txt
lang: json
---
{
  "dims": 16,
  "first 4": [
    0.232256,
    -0.62581,
    -0.560658,
    -0.015838
  ],
  "repeat equal": true,
  "other text equal": false
}
```

The fake has no idea of meaning. Two texts that mean the same thing get unrelated vectors. So the kit can show the API and the shapes, and it cannot show search quality.

### The vector store

`add_documents` with explicit ids stores the seven chunks as `doc-0` to `doc-6`. `similarity_search_with_score` returns pairs of a document and a score. A query that is the exact text of a chunk scores 1.0:

```listing
title: a search with the exact text of the first chunk
source: capture/out/39-retrieval.txt
lang: json
note: The query line, then the first hit. The second hit is cut.
---
query 'A checkpointer saves graph state after each step. InMemorySaver keeps it in a':
[
  {
    "id": "doc-0",
    "source": "checkpoints.md",
    "score": 1.0,
…
```

A query with other words, such as `Where does long-term memory live?`, returned `doc-2` with 0.317695 and `doc-4` with a negative score. With a real embedding model, the hits about the store would rank first. Here the scores carry no meaning, and the kit says so in the file.

`InMemoryVectorStore` takes a Python function as its `filter`. The kit kept only the chunks of `stores.md` and got `doc-4` and `doc-3`. A partner store takes its own filter syntax, so a filter does not move from one store to another. `delete(["doc-0"])` removed the first chunk, and `get_by_ids` then returned only `doc-1`. `max_marginal_relevance_search` returned `doc-5` and `doc-4`.

## A retriever as a tool

**Vector store retriever:** the retriever that `as_retriever()` returns. It runs one search on the store with the `search_kwargs` you gave it.

`create_agent` has no retrieval parameter. You give the agent a tool, and the tool calls the retriever. The kit wraps the retriever in a plain `@tool`:

```listing
title: the retriever and the tool
source: capture/s_integrations.py
lang: python
---
    retriever = store.as_retriever(search_kwargs={"k": 1})

    @tool
    def search_docs(query: str) -> str:
        """Search the local corpus."""
        return "\n".join(f"[{d.metadata['source']}] {d.page_content}" for d in retriever.invoke(query))
```

The scripted model calls `search_docs` once, and the tool returns one chunk with its source in brackets:

```listing
title: the tool call and its result
source: capture/out/39-retrieval.txt
lang: json
note: The ToolMessage only. The model call before it and the answer after it are cut.
---
    "type": "ToolMessage",
    "content": "[checkpoints.md] A checkpointer saves graph state after each step. InMemorySaver keeps it in a",
    "name": "search_docs",
    "id": "<uuid-2>",
    "tool_call_id": "call_1",
    "status": "success"
```

Put the source into the text of the result. The model sees only the content of the `ToolMessage`, so it can cite a file only when the tool writes the name into that text. Core also has `create_retriever_tool`, which builds the same kind of tool from a retriever, a name, and a description {{code libs/core/langchain_core/tools/retriever.py}}. With `response_format="content_and_artifact"`, it also keeps the documents as the artifact of the message.

Index time and query time do different work. The kit embeds every chunk once, before the agent runs. Each tool call embeds only the query. A store that persists, such as a partner store with a server, keeps the index time work across restarts. `InMemoryVectorStore` loses it when the process ends.

```takeaways
- Import the retrieval base classes from langchain_core and the splitters from langchain_text_splitters.
- Look for a partner package for your store before you install langchain-community.
- Give an agent a retriever through a tool, with the source written into the result text.
- Test a retrieval tool with DeterministicFakeEmbedding, and judge search quality only with a real model.
- Embed the corpus once at index time, outside the agent run.
```

Sources: capture/s_integrations.py, capture/out/39-retrieval.txt; libs/core/langchain_core/retrievers.py, libs/core/langchain_core/vectorstores/in_memory.py, libs/core/langchain_core/vectorstores/base.py, libs/core/langchain_core/embeddings/fake.py, libs/core/langchain_core/tools/retriever.py, libs/langchain_v1/langchain/embeddings/__init__.py, and libs/partners at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (oss/python/releases/langchain-v1, oss/python/deepagents/retrieval, oss/python/langchain/knowledge-base); the LangChain Academy repository lca-lc-foundations, bonus_rag, read 2026-11-14; the archived langchain-community repository, read 2026-11-14.
