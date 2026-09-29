"""BM25 keyword search over the corpus.

Lesson: projects/research-report-agent/stages/01-search-the-corpus/docs/en.md
Scoring follows Robertson and Zaragoza, "The Probabilistic Relevance Framework:
BM25 and Beyond" (2009). Stdlib only.
"""

import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = frozenset(
    "a an and are as at be by can do does for from has have how if in into is it its "
    "not of on or so such that the their them then there these this to was what when "
    "where which while who why will with you your".split()
)


def tokenize(text):
    """Lowercase `text`, keep runs of letters and digits, drop STOPWORDS."""
    raise NotImplementedError("Stage 1: implement tokenize in report_agent/search.py")


def engine_binary():
    """Return the compiled search Path from a private rra-private-build- directory."""
    raise NotImplementedError("Stage 1: implement engine_binary in report_agent/search.py")


class BM25Index:
    def __init__(self, documents, k1=1.5, b=0.75):
        """Compile search/main.rs and use its JSON idf response.

        Keep caller documents available for snippet extraction. Store a temporary
        corpus safely, invoke the binary with argument arrays and a timeout, and
        set self.idf from Rust. Rust owns BM25 scoring, not this adapter.
        """
        raise NotImplementedError("Stage 1: implement the Rust process adapter")

    def score(self, query_tokens, position):
        """Request a document score from the Rust process."""
        raise NotImplementedError("Stage 1: implement the score request")

    def search(self, query, k=5):
        """Request ranking from Rust; return (caller doc id, score) pairs."""
        raise NotImplementedError("Stage 1: implement the search request")
