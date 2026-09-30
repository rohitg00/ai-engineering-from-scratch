"""Cited writer: compose report sections only from retrieved snippets.

Lesson: projects/research-report-agent/stages/04-write-with-citations/docs/en.md
The writer is extractive, so every sentence is a snippet plus its citation.
A model-backed writer can replace it later without changing the contract.
"""

from dataclasses import dataclass, field

from report_agent.snippets import extract_snippets


@dataclass(frozen=True)
class CitedSentence:
    text: str
    cites: tuple

    def render(self):
        """Return the text without its final punctuation, a space, the markers, and a period."""
        raise NotImplementedError(
            "Stage 4: implement CitedSentence.render in report_agent/writer.py"
        )


@dataclass
class Section:
    facet_id: str
    heading: str
    sentences: list


@dataclass
class Report:
    question: str
    sections: list
    snippets: dict = field(default_factory=dict)

    def sentence_count(self):
        return sum(len(section.sentences) for section in self.sections)


def gather_snippets(plan, index, k_docs=4, per_doc=4, per_facet=3, relative_floor=0.4):
    """Collect snippets for every facet.

    Search the top documents for the whole question once, then extract
    snippets per facet from those documents. Skip spans already used by an
    earlier facet, stop below relative_floor times the best score, keep at
    most per_facet, and renumber ids S1, S2, ... across the whole report.
    """
    raise NotImplementedError(
        "Stage 4: implement gather_snippets in report_agent/writer.py"
    )


def write_report(plan, snippets_by_facet, max_sentences=3):
    """Build a Report: one Section per facet that has snippets, headed by the
    facet label, with up to max_sentences CitedSentences copied from snippet
    text (whitespace collapsed). Record every used snippet in Report.snippets.
    """
    raise NotImplementedError(
        "Stage 4: implement write_report in report_agent/writer.py"
    )


def to_markdown(report):
    """Render '# question', then '## heading' and one paragraph per section."""
    raise NotImplementedError(
        "Stage 4: implement to_markdown in report_agent/writer.py"
    )
