"""Chunking strategies, compared on a fixture corpus.

Five strategies, one recall@k harness, no third-party retrieval libs.

References (lesson-internal):
- ./docs/en.md
- Phase 11 lesson 06 (RAG fundamentals)
- Phase 19 lesson 65 (hybrid retrieval that ranks these chunks)
- Phase 19 lesson 68 (eval harness that scores the chunker)

Run: python3 code/main.py
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class Chunk:
    doc_id: str
    strategy: str
    start: int
    end: int
    text: str

    def overlaps(self, gold_start: int, gold_end: int) -> bool:
        return not (self.end <= gold_start or self.start >= gold_end)


# ---------------------------------------------------------------------------
# strategy 1  --  fixed window
# ---------------------------------------------------------------------------

def fixed_window(doc_id: str, text: str, size: int = 400, overlap: int = 80) -> list[Chunk]:
    if size <= 0:
        raise ValueError("size must be positive")
    if overlap < 0 or overlap >= size:
        raise ValueError("overlap must be non-negative and smaller than size")
    out: list[Chunk] = []
    step = size - overlap
    i = 0
    n = len(text)
    while i < n:
        end = min(i + size, n)
        out.append(Chunk(doc_id, "fixed", i, end, text[i:end]))
        if end == n:
            break
        i += step
    return out


# ---------------------------------------------------------------------------
# strategy 2  --  sentence packer
# ---------------------------------------------------------------------------

_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def split_sentences(text: str) -> list[tuple[int, int, str]]:
    out: list[tuple[int, int, str]] = []
    cursor = 0
    for m in _SENTENCE_BOUNDARY.finditer(text):
        end = m.start()
        if end > cursor:
            out.append((cursor, end, text[cursor:end]))
        cursor = m.end()
    if cursor < len(text):
        out.append((cursor, len(text), text[cursor:]))
    return out


def sentence_chunks(doc_id: str, text: str, target: int = 500) -> list[Chunk]:
    sents = split_sentences(text)
    out: list[Chunk] = []
    cur_start = None
    cur_end = 0
    cur_buf: list[str] = []
    cur_len = 0
    for s_start, s_end, s_text in sents:
        if cur_start is None:
            cur_start = s_start
        sep = " " if cur_buf else ""
        added = len(sep) + len(s_text)
        if cur_len + added > target and cur_buf:
            out.append(Chunk(doc_id, "sentence", cur_start, cur_end, " ".join(cur_buf)))
            cur_start = s_start
            cur_buf = [s_text]
            cur_len = len(s_text)
            cur_end = s_end
            continue
        cur_buf.append(s_text)
        cur_len += added
        cur_end = s_end
    if cur_buf and cur_start is not None:
        out.append(Chunk(doc_id, "sentence", cur_start, cur_end, " ".join(cur_buf)))
    return out


# ---------------------------------------------------------------------------
# strategy 3  --  recursive split
# ---------------------------------------------------------------------------

DEFAULT_SEPARATORS = ("\n\n", "\n", ". ", " ")


def _recursive_split(text: str, base_offset: int, separators: tuple[str, ...],
                     target: int) -> list[tuple[int, int, str]]:
    if len(text) <= target or not separators:
        if not text:
            return []
        return [(base_offset, base_offset + len(text), text)]
    sep = separators[0]
    rest = separators[1:]
    if sep not in text:
        return _recursive_split(text, base_offset, rest, target)
    pieces: list[tuple[int, int, str]] = []
    cursor = 0
    parts = text.split(sep)
    for idx, part in enumerate(parts):
        start = cursor
        cursor += len(part)
        if idx < len(parts) - 1:
            cursor += len(sep)
        if not part:
            continue
        if len(part) <= target:
            pieces.append((base_offset + start, base_offset + start + len(part), part))
        else:
            pieces.extend(_recursive_split(part, base_offset + start, rest, target))
    # pack contiguous small pieces up to the target.
    packed: list[tuple[int, int, str]] = []
    for p_start, p_end, p_text in pieces:
        if packed and (p_end - packed[-1][0]) <= target:
            prev_start, _, prev_text = packed[-1]
            packed[-1] = (prev_start, p_end, prev_text + sep + p_text)
        else:
            packed.append((p_start, p_end, p_text))
    return packed


def recursive_split(doc_id: str, text: str, target: int = 500,
                    separators: tuple[str, ...] = DEFAULT_SEPARATORS) -> list[Chunk]:
    spans = _recursive_split(text, 0, separators, target)
    return [Chunk(doc_id, "recursive", s, e, t) for s, e, t in spans if t.strip()]


# ---------------------------------------------------------------------------
# deterministic mock embedding -- hash-based, normalized
# ---------------------------------------------------------------------------

def _token_hashes(text: str, dim: int) -> list[float]:
    vec = [0.0] * dim
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        h = 0
        for ch in tok:
            h = (h * 1315423911) ^ ord(ch)
            h &= 0xFFFFFFFF
        vec[h % dim] += 1.0
        vec[(h >> 7) % dim] += 0.5
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def mock_embed(text: str, dim: int = 96) -> list[float]:
    return _token_hashes(text, dim)


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


# ---------------------------------------------------------------------------
# strategy 4  --  semantic clustering
# ---------------------------------------------------------------------------

def semantic_chunks(doc_id: str, text: str, similarity_threshold: float = 0.55,
                    max_chars: int = 900) -> list[Chunk]:
    sents = split_sentences(text)
    if not sents:
        return []
    chunks: list[Chunk] = []
    cur_sents: list[tuple[int, int, str]] = []
    cur_vec: list[float] | None = None
    cur_n = 0

    def flush() -> None:
        if not cur_sents:
            return
        start = cur_sents[0][0]
        end = cur_sents[-1][1]
        body = " ".join(s[2] for s in cur_sents)
        chunks.append(Chunk(doc_id, "semantic", start, end, body))

    for s_start, s_end, s_text in sents:
        v = mock_embed(s_text)
        cur_chars = sum(s[1] - s[0] for s in cur_sents)
        if cur_vec is None:
            cur_vec = v
            cur_sents.append((s_start, s_end, s_text))
            cur_n = 1
            continue
        sim = cosine(cur_vec, v)
        if sim < similarity_threshold or cur_chars + (s_end - s_start) > max_chars:
            flush()
            cur_sents = [(s_start, s_end, s_text)]
            cur_vec = v
            cur_n = 1
        else:
            cur_sents.append((s_start, s_end, s_text))
            cur_n += 1
            cur_vec = [(cur_vec[i] * cur_n + v[i]) / (cur_n + 1) for i in range(len(cur_vec))]
            norm = math.sqrt(sum(x * x for x in cur_vec)) or 1.0
            cur_vec = [x / norm for x in cur_vec]
    flush()
    return chunks


# ---------------------------------------------------------------------------
# strategy 5  --  structural markdown
# ---------------------------------------------------------------------------

_HEADER = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


def structural_markdown(doc_id: str, text: str) -> list[Chunk]:
    matches = list(_HEADER.finditer(text))
    if not matches:
        return [Chunk(doc_id, "structural", 0, len(text), text)]
    out: list[Chunk] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            out.append(Chunk(doc_id, "structural", start, end, body))
    return out


# ---------------------------------------------------------------------------
# dense index used for ranking
# ---------------------------------------------------------------------------

@dataclass
class DenseIndex:
    vectors: list[tuple[Chunk, list[float]]] = field(default_factory=list)

    def add(self, chunk: Chunk) -> None:
        self.vectors.append((chunk, mock_embed(chunk.text)))

    def search(self, query: str, k: int) -> list[Chunk]:
        qv = mock_embed(query)
        scored = [(c, cosine(qv, v)) for c, v in self.vectors]
        scored.sort(key=lambda x: -x[1])
        return [c for c, _ in scored[:k]]


# ---------------------------------------------------------------------------
# fixture corpus + gold answer spans
# ---------------------------------------------------------------------------

PROSE_DOC = (
    "The retry budget is the safety valve. It exists so that a downstream outage "
    "does not turn into a cascading failure. The budget is consumed every time a "
    "client retries after a non-fatal error. When the budget hits zero, the client "
    "stops retrying for a configured cooldown window.\n\n"
    "Aborts work differently. An abort signals to the server that the operation "
    "should be cancelled and its partial state cleaned up. A multipart upload abort "
    "instructs the storage layer to drop the partial parts and release the reserved "
    "key. The abort threshold is configured per bucket at three failed parts.\n\n"
    "Authorization sits one layer above. Every retry and every abort flows through "
    "the central permission check before the storage call goes out. The check "
    "evaluates a policy whose inputs are the principal, the resource, and the action. "
    "The same check runs for human users and for service accounts."
)

PROSE_QUERIES = [
    ("what is the abort threshold per bucket", "abort threshold is configured per bucket at three failed parts"),
    ("when does the retry budget reset", "stops retrying for a configured cooldown window"),
    ("how is authorization performed for service accounts", "The same check runs for human users and for service accounts"),
]

MARKDOWN_DOC = (
    "# Storage Service Configuration\n\n"
    "This document describes the storage service knobs.\n\n"
    "## Retry Budget\n\n"
    "Each client carries a retry budget. The default is 64 retries per minute. When the "
    "budget reaches zero the client stops retrying.\n\n"
    "## Abort Threshold\n\n"
    "A multipart upload is aborted after three consecutive failed parts. The threshold is "
    "per bucket and is configured in budgets.yaml.\n\n"
    "## Authorization\n\n"
    "All operations are authorized through the central permission check before any storage "
    "call is issued."
)

MARKDOWN_QUERIES = [
    ("default retry budget value", "The default is 64 retries per minute"),
    ("how many failed parts before abort", "aborted after three consecutive failed parts"),
    ("where is the abort threshold configured", "configured in budgets.yaml"),
]

MIXED_DOC = (
    "# Operations Runbook\n\n"
    "Incident response begins with paging the on-call. The on-call confirms the "
    "alert is real and acknowledges in the incident tool within five minutes.\n\n"
    "## Triage\n\n"
    "The runbook directs the responder to the dashboard. The first widget shows "
    "p99 latency across the public endpoints. The second widget shows the error "
    "rate broken down by service.\n\n"
    "## Mitigation\n\n"
    "If the error rate exceeds five percent the responder rolls back the most recent "
    "deploy. The rollback command is one line and is documented in the deploy guide. "
    "If rollback fails the responder pages the platform team.\n\n"
    "## Postmortem\n\n"
    "Every incident with customer impact requires a postmortem within five business "
    "days. The postmortem lists timeline, root cause, contributing factors, and "
    "corrective actions with owners and dates."
)

MIXED_QUERIES = [
    ("when does the on-call acknowledge", "acknowledges in the incident tool within five minutes"),
    ("what error rate triggers rollback", "If the error rate exceeds five percent"),
    ("when is a postmortem due", "within five business days"),
]


def _locate(doc: str, span_text: str) -> tuple[int, int]:
    start = doc.index(span_text)
    return start, start + len(span_text)


def build_fixture() -> list[dict]:
    return [
        {
            "doc_id": "prose",
            "text": PROSE_DOC,
            "queries": [(q, _locate(PROSE_DOC, span)) for q, span in PROSE_QUERIES],
        },
        {
            "doc_id": "markdown",
            "text": MARKDOWN_DOC,
            "queries": [(q, _locate(MARKDOWN_DOC, span)) for q, span in MARKDOWN_QUERIES],
        },
        {
            "doc_id": "mixed",
            "text": MIXED_DOC,
            "queries": [(q, _locate(MIXED_DOC, span)) for q, span in MIXED_QUERIES],
        },
    ]


# ---------------------------------------------------------------------------
# eval -- recall@k per strategy
# ---------------------------------------------------------------------------

ChunkFn = Callable[[str, str], list[Chunk]]


def eval_recall(chunker: ChunkFn, fixture: list[dict], ks: tuple[int, ...] = (1, 3, 5)) -> dict[int, float]:
    totals = {k: 0 for k in ks}
    hits = {k: 0 for k in ks}
    for doc in fixture:
        chunks = chunker(doc["doc_id"], doc["text"])
        idx = DenseIndex()
        for c in chunks:
            idx.add(c)
        for query, (g_start, g_end) in doc["queries"]:
            for k in ks:
                totals[k] += 1
                top = idx.search(query, k)
                if any(c.overlaps(g_start, g_end) for c in top):
                    hits[k] += 1
    return {k: hits[k] / totals[k] if totals[k] else 0.0 for k in ks}


STRATEGIES: dict[str, ChunkFn] = {
    "fixed":      lambda d, t: fixed_window(d, t, size=400, overlap=80),
    "sentence":   lambda d, t: sentence_chunks(d, t, target=500),
    "recursive":  lambda d, t: recursive_split(d, t, target=500),
    "semantic":   lambda d, t: semantic_chunks(d, t, similarity_threshold=0.55, max_chars=900),
    "structural": lambda d, t: structural_markdown(d, t),
}


def main() -> None:
    fixture = build_fixture()
    ks = (1, 3, 5)
    print(f"{'strategy':<12} | " + " | ".join(f"recall@{k}" for k in ks))
    print("-" * 44)
    for name, fn in STRATEGIES.items():
        recall = eval_recall(fn, fixture, ks)
        row = " | ".join(f"  {recall[k]:.2f}  " for k in ks)
        print(f"{name:<12} | {row}")
    print()
    print("chunk counts per strategy (across all fixture docs):")
    for name, fn in STRATEGIES.items():
        n = sum(len(fn(d["doc_id"], d["text"])) for d in fixture)
        print(f"  {name:<12} {n} chunks")


if __name__ == "__main__":
    main()
