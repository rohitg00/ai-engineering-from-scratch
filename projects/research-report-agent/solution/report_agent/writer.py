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
        body = self.text.rstrip()
        while body and body[-1] in ".!?":
            body = body[:-1]
        return body + " " + "".join(f"[{cite}]" for cite in self.cites) + "."


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
    by_facet = {}
    seen = set()
    next_id = 1
    top_docs = [doc_id for doc_id, _ in index.search(plan.question, k=k_docs)]
    for facet in plan.facets:
        found = []
        query = plan.question + " " + facet.query()
        candidates = extract_snippets(
            query, index, per_doc=per_doc, start_id=next_id, doc_ids=top_docs
        )
        floor = candidates[0].score * relative_floor if candidates else 0.0
        for snippet in candidates:
            if snippet.score < floor:
                break
            span = (snippet.doc_id, snippet.start, snippet.end)
            if span in seen:
                continue
            seen.add(span)
            found.append(snippet)
            if len(found) == per_facet:
                break
        renumbered = []
        for snippet in found:
            renumbered.append(
                type(snippet)(
                    id=f"S{next_id}",
                    doc_id=snippet.doc_id,
                    start=snippet.start,
                    end=snippet.end,
                    text=snippet.text,
                    score=snippet.score,
                )
            )
            next_id += 1
        by_facet[facet.id] = renumbered
    return by_facet


def write_report(plan, snippets_by_facet, max_sentences=3):
    sections = []
    registry = {}
    for facet in plan.facets:
        chosen = snippets_by_facet.get(facet.id, [])[:max_sentences]
        if not chosen:
            continue
        sentences = []
        for snippet in chosen:
            registry[snippet.id] = snippet
            sentences.append(
                CitedSentence(text=" ".join(snippet.text.split()), cites=(snippet.id,))
            )
        sections.append(
            Section(
                facet_id=facet.id,
                heading=facet.label or facet.sub_question,
                sentences=sentences,
            )
        )
    return Report(question=plan.question, sections=sections, snippets=registry)


def to_markdown(report):
    lines = [f"# {report.question}", ""]
    for section in report.sections:
        lines.append(f"## {section.heading}")
        lines.append("")
        lines.append(" ".join(sentence.render() for sentence in section.sentences))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
