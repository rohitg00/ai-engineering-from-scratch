"""Citation format and validation.

Lesson: projects/research-report-agent/stages/04-write-with-citations/docs/en.md
A cited sentence ends with one or more markers such as [S3] or [S3][S7],
then a period. Stdlib only.
"""

import re
from dataclasses import dataclass

CITE_RE = re.compile(r"\[(S\d+)\]")
TRAILING_CITES_RE = re.compile(r"((?:\s*\[S\d+\])+)\s*[.!?]?\s*$")
SENTENCE_BOUNDARY_RE = re.compile(r"(?<=\][.!?])\s+|(?<=[.!?])\s+(?=[A-Z0-9\[])")


@dataclass(frozen=True)
class CitationError:
    sentence: str
    reason: str


def cites_of(sentence):
    match = TRAILING_CITES_RE.search(sentence)
    return CITE_RE.findall(match.group(1)) if match else []


def strip_cites(sentence):
    text = TRAILING_CITES_RE.sub("", sentence).strip()
    return CITE_RE.sub("", text).strip()


def report_sentences(markdown):
    sentences = []
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        sentences.extend(
            part.strip()
            for part in SENTENCE_BOUNDARY_RE.split(stripped)
            if part.strip()
        )
    return sentences


def validate_citations(markdown, snippet_ids):
    known = set(snippet_ids)
    errors = []
    for sentence in report_sentences(markdown):
        cites = cites_of(sentence)
        if not cites:
            errors.append(CitationError(sentence, "uncited"))
            continue
        for cite in cites:
            if cite not in known:
                errors.append(CitationError(sentence, f"dangling:{cite}"))
    return errors
