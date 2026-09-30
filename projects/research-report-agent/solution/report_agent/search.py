"""BM25 keyword search over the corpus.

Lesson: projects/research-report-agent/stages/01-search-the-corpus/docs/en.md
Scoring follows Robertson and Zaragoza, "The Probabilistic Relevance Framework:
BM25 and Beyond" (2009). Stdlib only.
"""

import functools
import atexit
import json
import math
import subprocess
import tempfile
from pathlib import Path
import re

TOKEN_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = frozenset(
    "a an and are as at be by can do does for from has have how if in into is it its "
    "not of on or so such that the their them then there these this to was what when "
    "where which while who why will with you your".split()
)


def tokenize(text):
    return [token for token in TOKEN_RE.findall(text.lower()) if token not in STOPWORDS]


@functools.lru_cache(maxsize=1)
def engine_binary():
    source = Path(__file__).resolve().parents[1] / "search" / "main.rs"
    directory = tempfile.TemporaryDirectory(prefix="rra-private-build-")
    atexit.register(directory.cleanup)
    binary = Path(directory.name) / "search"
    result = subprocess.run(
        ["rustc", "--edition", "2021", "-O", str(source), "-o", str(binary)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode:
        directory.cleanup()
        raise RuntimeError("Rust search build failed: " + result.stderr)
    return binary


class BM25Index:
    def __init__(self, documents, k1=1.5, b=0.75):
        if not math.isfinite(k1) or k1 <= 0 or not math.isfinite(b) or not 0 <= b <= 1:
            raise ValueError("require finite k1 > 0 and 0 <= b <= 1")
        self.documents = list(documents)
        self.k1, self.b = k1, b
        self._corpus = tempfile.TemporaryDirectory(prefix="rra-corpus-")
        for position, doc in enumerate(self.documents):
            # File names are generated locally; arbitrary caller ids never become paths.
            Path(self._corpus.name, f"{position:06d}.md").write_text(
                f"title: {doc.title}\nsource_url: {doc.source_url}\npublished: {doc.published}\n\n{doc.text}\n",
                encoding="utf-8",
            )
        self._ids = {f"{i:06d}": doc.id for i, doc in enumerate(self.documents)}
        self.idf = self._request({"cmd": "idf"})["idf"]

    def _request(self, payload):
        payload.update(k1=self.k1, b=self.b)
        result = subprocess.run(
            [str(engine_binary()), self._corpus.name],
            input=json.dumps(payload) + "\n",
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode:
            raise RuntimeError("Rust search failed: " + result.stderr)
        response = json.loads(result.stdout)
        if "error" in response:
            raise ValueError(response["error"])
        return response

    def score(self, query_tokens, position):
        return self._request(
            {"cmd": "score", "query": " ".join(query_tokens), "position": position}
        )["score"]

    def search(self, query, k=5):
        if not isinstance(k, int) or isinstance(k, bool) or not 0 <= k <= 10000:
            raise ValueError("k must be an integer between 0 and 10000")
        hits = self._request({"query": query, "k": len(self.documents)})["results"]
        # Restore caller ids before tie-breaking: generated file names are an IPC detail.
        results = [(self._ids[hit["doc_id"]], hit["score"]) for hit in hits]
        return sorted(results, key=lambda item: (-item[1], item[0]))[:k]
