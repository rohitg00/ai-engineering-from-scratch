# Retrieval agent over a local corpus

A `create_agent` agent that answers questions from six lesson files of this repository, and cites the file of each claim.

## The corpus

Six `docs/en.md` lesson files from `phases/`, on embeddings, RAG, LangGraph, agent frameworks, and durable execution. They are part of this repository, which is MIT licensed, so the corpus needs no copy. `run.sh` records the SHA-256 of each file in `capture/lab/retrieval-agent/corpus.txt`.

## The pipeline

- `RecursiveCharacterTextSplitter` with `chunk_size=1000`, `chunk_overlap=150`, and `add_start_index=True`.
- `OllamaEmbeddings` with `nomic-embed-text`, wrapped to add the `search_document:` and `search_query:` prefixes that the model expects.
- `InMemoryVectorStore`, rebuilt on every run.
- `create_retriever_tool` with `k=4`, a document prompt that puts the source path in front of each passage, and `response_format="content_and_artifact"`.

Before each agent run, the script also searches the store directly and prints the top four passages. That line shows what the retriever returns, whatever the model then does.

## Files

- `retrieval_agent.py`: the pipeline, the agent, and five questions. One question is outside the corpus.
- `run.sh`: runs the agent once with each model.

## Run

```bash
./run.sh
```

`run.sh` uses `capture/.venv` and Ollama on `127.0.0.1:11434` with `nomic-embed-text`, `qwen3:4b-instruct-2507-q4_K_M`, and `qwen3:8b`. The recorded run is in `capture/lab/retrieval-agent/`.
