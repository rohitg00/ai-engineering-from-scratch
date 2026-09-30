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
    """Return (start, end) spans of sentences in `text`.

    A sentence ends at . ! or ? followed by whitespace and a letter, digit,
    quote or bracket, or by the end of the text. Spans exclude surrounding
    whitespace. Keep a trailing fragment without a period.
    """
    raise NotImplementedError(
        "Stage 2: implement split_sentences in report_agent/snippets.py"
    )


CONTEXT_DEPENDENT_STARTS = frozenset(
    {"it", "its", "this", "that", "these", "those", "they", "their", "he", "she"}
)


def score_sentence(sentence, query_tokens, idf, min_words=6):
    """Score one sentence against the query.

    Return 0.0 for sentences shorter than `min_words` words. Otherwise sum
    idf of query tokens that appear in the sentence, and halve the score when
    the sentence starts with a context-dependent word such as It or This.
    """
    raise NotImplementedError(
        "Stage 2: implement score_sentence in report_agent/snippets.py"
    )


def extract_snippets(
    query, index, k_docs=4, per_doc=3, start_id=1, min_score=0.0, doc_ids=None
):
    """Return Snippet objects for the best sentences, best first.

    Search the top `k_docs` documents (or only `doc_ids` when given), keep
    up to `per_doc` sentences per document with score > min_score, sort all
    candidates by score, and number them S{start_id}, S{start_id+1}, ...
    Snippet.text must equal document.text[start:end].
    """
    raise NotImplementedError(
        "Stage 2: implement extract_snippets in report_agent/snippets.py"
    )
