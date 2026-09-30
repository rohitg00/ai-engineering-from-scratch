"""Snippet extraction with exact source offsets.

Lesson: projects/research-report-agent/stages/02-extract-snippets/docs/en.md
Every snippet keeps (start, end) so its text equals document.text[start:end],
which is what makes a citation checkable later. Stdlib only.
"""

import re
from dataclasses import dataclass

from report_agent.search import tokenize

SENTENCE_END_RE = re.compile(r"[.!?](?=\s+[A-Za-z0-9\"(]|\s*$)")


@dataclass(frozen=True)
class Snippet:
    id: str
    doc_id: str
    start: int
    end: int
    text: str
    score: float


def split_sentences(text):
    spans = []
    cursor = 0
    for match in SENTENCE_END_RE.finditer(text):
        end = match.end()
        start = cursor
        while start < end and text[start].isspace():
            start += 1
        if start < end:
            spans.append((start, end))
        cursor = end
    start = cursor
    while start < len(text) and text[start].isspace():
        start += 1
    if start < len(text):
        end = len(text)
        while end > start and text[end - 1].isspace():
            end -= 1
        spans.append((start, end))
    return spans


CONTEXT_DEPENDENT_STARTS = frozenset(
    {"it", "its", "this", "that", "these", "those", "they", "their", "he", "she"}
)


def score_sentence(sentence, query_tokens, idf, min_words=6):
    words = sentence.split()
    if len(words) < min_words:
        return 0.0
    sentence_tokens = set(tokenize(sentence))
    score = sum(
        idf.get(token, 0.0) for token in set(query_tokens) if token in sentence_tokens
    )
    if words[0].lower().strip(",") in CONTEXT_DEPENDENT_STARTS:
        score *= 0.5
    return score


def extract_snippets(
    query, index, k_docs=4, per_doc=3, start_id=1, min_score=0.0, doc_ids=None
):
    query_tokens = tokenize(query)
    by_id = {doc.id: doc for doc in index.documents}
    candidates = []
    ranked = (
        list(doc_ids)
        if doc_ids is not None
        else [doc_id for doc_id, _ in index.search(query, k=k_docs)]
    )
    for doc_id in ranked:
        doc = by_id[doc_id]
        scored = []
        for start, end in split_sentences(doc.text):
            value = score_sentence(doc.text[start:end], query_tokens, index.idf)
            if value > min_score:
                scored.append((value, start, end))
        scored.sort(key=lambda item: (-item[0], item[1]))
        for value, start, end in scored[:per_doc]:
            candidates.append((value, doc_id, start, end, doc.text[start:end]))
    candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [
        Snippet(
            id=f"S{start_id + offset}",
            doc_id=doc_id,
            start=start,
            end=end,
            text=text,
            score=round(value, 4),
        )
        for offset, (value, doc_id, start, end, text) in enumerate(candidates)
    ]
