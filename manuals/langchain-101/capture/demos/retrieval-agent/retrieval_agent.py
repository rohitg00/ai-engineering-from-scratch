import json
import re
import sys
import time
from pathlib import Path

from langchain.agents import create_agent
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import create_retriever_tool
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen3:4b-instruct-2507-q4_K_M"
ROOT = Path(sys.argv[2] if len(sys.argv) > 2 else "../../../../..").resolve()
ROWS = Path(sys.argv[3] if len(sys.argv) > 3 else "run.jsonl")

CORPUS = [
    "phases/11-llm-engineering/04-embeddings/docs/en.md",
    "phases/11-llm-engineering/06-rag/docs/en.md",
    "phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md",
    "phases/11-llm-engineering/17-agent-framework-tradeoffs/docs/en.md",
    "phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md",
    "phases/15-autonomous-systems/12-durable-execution/docs/en.md",
]

QUESTIONS = [
    ("reducer", "In LangGraph, what happens when two nodes update the messages field in the same step and the field has no reducer?", ["phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md"]),
    ("matryoshka", "How much storage does Matryoshka truncation from 1536 to 256 dimensions save, and what does it cost in accuracy?", ["phases/11-llm-engineering/04-embeddings/docs/en.md"]),
    ("decay", "After roughly how many minutes of continuous operation does agent reliability start to decay?", ["phases/15-autonomous-systems/12-durable-execution/docs/en.md"]),
    ("thread", "Which key identifies the conversation that a checkpoint belongs to?", ["phases/11-llm-engineering/16-langgraph-state-machines/docs/en.md", "phases/14-agent-engineering/13-langgraph-stateful-graphs/docs/en.md", "phases/15-autonomous-systems/12-durable-execution/docs/en.md"]),
    ("outside", "Which GPU should I buy to train a 70B model from scratch?", []),
]


class NomicEmbeddings(Embeddings):
    def __init__(self, model="nomic-embed-text"):
        self.inner = OllamaEmbeddings(model=model)

    def embed_documents(self, texts):
        return self.inner.embed_documents([f"search_document: {t}" for t in texts])

    def embed_query(self, text):
        return self.inner.embed_query(f"search_query: {text}")


def load():
    docs = []
    for rel in CORPUS:
        text = (ROOT / rel).read_text(encoding="utf-8")
        title = next((line[2:].strip() for line in text.splitlines() if line.startswith("# ")), rel)
        docs.append(Document(page_content=text, metadata={"source": rel, "title": title}))
    return docs


def build_store():
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150, add_start_index=True)
    chunks = splitter.split_documents(load())
    started = time.perf_counter()
    store = InMemoryVectorStore(NomicEmbeddings())
    store.add_documents(chunks)
    return store, chunks, time.perf_counter() - started


SYSTEM_PROMPT = """You answer questions about a set of engineering lessons.

Rules:
- Call search_lessons before you answer. Search again with other words if the results do not answer the question.
- Answer only from the text that search_lessons returns.
- After each claim, cite the source path in square brackets, exactly as the tool shows it.
- If the lessons do not hold the answer, say that the lessons do not cover it, and cite nothing.
"""


def model():
    return ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384, num_predict=1024)


def short(text, n=200):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 2] + " …"


def main():
    store, chunks, embed_s = build_store()
    sizes = [len(c.page_content) for c in chunks]
    print(f"model {MODEL}, embeddings nomic-embed-text, temperature 0, seed 42")
    print(f"corpus: {len(CORPUS)} lesson files, {sum(len(d.page_content) for d in load())} characters")
    print(f"chunks: {len(chunks)}, chunk_size 1000, overlap 150, largest {max(sizes)}, smallest {min(sizes)}")
    print(f"embedded {len(chunks)} chunks in {embed_s:.1f} s")
    retriever = store.as_retriever(search_kwargs={"k": 4})
    search = create_retriever_tool(
        retriever,
        "search_lessons",
        "Search the engineering lessons. Returns the four best passages, each with its source path.",
        document_prompt=PromptTemplate.from_template("[{source}]\n{page_content}"),
        response_format="content_and_artifact",
    )
    agent = create_agent(model(), tools=[search], system_prompt=SYSTEM_PROMPT)
    out = open(ROWS, "w")
    out.write(json.dumps({"model": MODEL, "corpus": CORPUS, "chunks": len(chunks), "chunk_chars": sizes, "embed_s": round(embed_s, 2)}) + "\n")
    for key, question, expected in QUESTIONS:
        print(f"\n== {key}: {question}")
        hits = store.similarity_search_with_score(question, k=4)
        for doc, score in hits:
            print(f"  top-4      {score:.3f}  {doc.metadata['source']} @ {doc.metadata['start_index']}")
        started = time.perf_counter()
        result = agent.invoke({"messages": [{"role": "user", "content": question}]}, {"recursion_limit": 12})
        seconds = time.perf_counter() - started
        messages = result["messages"]
        searches = []
        for m in messages:
            if m.type == "ai":
                for tc in m.tool_calls:
                    print(f"  search     {short(tc['args'].get('query'), 150)}")
            if m.type == "tool":
                got = [d.metadata["source"] for d in (m.artifact or [])]
                searches.append(got)
                print(f"  returned   {', '.join(Path(s).parts[1] + '/' + Path(s).parts[2] for s in got)}")
        answer = messages[-1].content
        cited = sorted(set(re.findall(r"\[(phases/[^\]]+)\]", answer)))
        returned = sorted({s for group in searches for s in group})
        usage = [m.usage_metadata for m in messages if m.type == "ai" and m.usage_metadata]
        print(f"  answer     {short(answer, 600)}")
        print(f"  cited      {', '.join(cited) if cited else 'nothing'}")
        good = any(c in expected for c in cited) if expected else not cited
        print(f"  check      cited an expected source: {good}; every citation was returned by a search: {set(cited) <= set(returned)}")
        print(f"  model calls {len(usage)}, prompt tokens {sum(u['input_tokens'] for u in usage)}, {seconds:.1f} s")
        out.write(json.dumps({"question": key, "text": question, "expected_sources": expected, "cited_expected": good, "top4": [[d.metadata["source"], d.metadata["start_index"], round(float(s), 4)] for d, s in hits], "searches": searches, "answer": answer, "cited": cited, "model_calls": len(usage), "prompt_tokens": [u["input_tokens"] for u in usage], "seconds": round(seconds, 2)}) + "\n")
        out.flush()
    out.close()


if __name__ == "__main__":
    main()
