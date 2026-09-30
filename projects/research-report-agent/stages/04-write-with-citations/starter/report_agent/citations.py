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
    """Return the citation ids at the end of a sentence, for example ['S2', 'S7']."""
    raise NotImplementedError(
        "Stage 4: implement cites_of in report_agent/citations.py"
    )


def strip_cites(sentence):
    """Return the sentence text without citation markers and final punctuation."""
    raise NotImplementedError(
        "Stage 4: implement strip_cites in report_agent/citations.py"
    )


def report_sentences(markdown):
    """Split report markdown into sentences, skipping blank lines and headings."""
    raise NotImplementedError(
        "Stage 4: implement report_sentences in report_agent/citations.py"
    )


def validate_citations(markdown, snippet_ids):
    """Return a CitationError for every uncited sentence ('uncited') and every
    unknown citation ('dangling:S9'). An empty list means the report is valid.
    """
    raise NotImplementedError(
        "Stage 4: implement validate_citations in report_agent/citations.py"
    )
