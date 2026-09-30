"""Corpus loading for the Research Report Agent.

Lesson: projects/research-report-agent/stages/01-search-the-corpus/docs/en.md
Reads markdown documents with a small key: value header block.
Stdlib only.
"""

from dataclasses import dataclass
from pathlib import Path

HEADER_KEYS = ("title", "source_url", "published")


@dataclass(frozen=True)
class Document:
    id: str
    title: str
    source_url: str
    published: str
    text: str


def parse_document(doc_id, raw):
    """Parse one markdown file into a Document.

    The file starts with `key: value` lines (title, source_url, published),
    then a blank line, then the body. Raise ValueError if any header key is
    missing. Document.text is the stripped body without the header.
    """
    raise NotImplementedError(
        "Stage 1: implement parse_document in report_agent/corpus.py"
    )


def load_corpus(path):
    """Load every *.md file under `path`, sorted by file name.

    The document id is the file stem, for example `04-user-space-kernel`.
    Raise FileNotFoundError if the directory does not exist.
    """
    raise NotImplementedError(
        "Stage 1: implement load_corpus in report_agent/corpus.py"
    )
