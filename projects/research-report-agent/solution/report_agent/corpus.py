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
    header = {}
    lines = raw.splitlines()
    index = 0
    while index < len(lines) and lines[index].strip():
        key, sep, value = lines[index].partition(":")
        if not sep:
            break
        header[key.strip().lower()] = value.strip()
        index += 1
    missing = [key for key in HEADER_KEYS if key not in header]
    if missing:
        raise ValueError(f"{doc_id}: missing header keys {missing}")
    body = "\n".join(lines[index:]).strip()
    return Document(
        id=doc_id,
        title=header["title"],
        source_url=header["source_url"],
        published=header["published"],
        text=body,
    )


def load_corpus(path):
    root = Path(path)
    if not root.is_dir():
        raise FileNotFoundError(f"corpus directory not found: {root}")
    return [
        parse_document(file.stem, file.read_text(encoding="utf-8"))
        for file in sorted(root.glob("*.md"))
    ]
