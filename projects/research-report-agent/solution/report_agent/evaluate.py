"""Score reports on checked-in public evaluation fixtures.

Lesson: projects/research-report-agent/stages/07-score-the-report/docs/en.md
Metrics follow the spirit of citation support with
simple, inspectable definitions. Stdlib only.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from report_agent.critic import support_score
from report_agent.pipeline import run_pipeline

WEIGHTS = {"citation_precision": 0.4, "source_recall": 0.3, "fact_coverage": 0.3}


@dataclass
class QuestionScore:
    id: str
    question: str
    citation_precision: float
    source_recall: float
    fact_coverage: float
    terminal_state: str


@dataclass
class Scorecard:
    questions: list = field(default_factory=list)

    def mean(self, metric):
        if not self.questions:
            return 0.0
        return round(
            sum(getattr(q, metric) for q in self.questions) / len(self.questions), 4
        )

    def score(self):
        return round(
            100 * sum(weight * self.mean(metric) for metric, weight in WEIGHTS.items()),
            1,
        )


def citation_precision(report, threshold=0.8):
    checked = 0
    supported = 0
    for section in report.sections:
        for sentence in section.sentences:
            checked += 1
            best = max(
                support_score(sentence.render(), report.snippets[cite].text)[0]
                for cite in sentence.cites
            )
            supported += best >= threshold
    return round(supported / checked, 4) if checked else 0.0


def source_recall(report, expected_docs):
    if not expected_docs:
        return 1.0
    cited = {snippet.doc_id for snippet in report.snippets.values()}
    return round(len(cited & set(expected_docs)) / len(set(expected_docs)), 4)


def fact_coverage(report, key_facts):
    if not key_facts:
        return 1.0
    sentences = [
        s.text.lower() for section in report.sections for s in section.sentences
    ]
    hits = sum(
        1
        for terms in key_facts
        if any(all(term.lower() in text for term in terms) for text in sentences)
    )
    return round(hits / len(key_facts), 4)


def evaluate(questions_path, corpus_dir, model=None):
    questions = json.loads(Path(questions_path).read_text(encoding="utf-8"))[
        "questions"
    ]
    card = Scorecard()
    for item in questions:
        report, trace, _ = run_pipeline(item["question"], corpus_dir, model=model)
        card.questions.append(
            QuestionScore(
                id=item["id"],
                question=item["question"],
                citation_precision=citation_precision(report),
                source_recall=source_recall(report, item.get("expected_docs", [])),
                fact_coverage=fact_coverage(report, item.get("key_facts", [])),
                terminal_state=trace["terminal_state"],
            )
        )
    return card


def format_scorecard(card):
    lines = [f"{'id':<6}{'precision':>11}{'recall':>9}{'facts':>8}  state", "-" * 46]
    for q in card.questions:
        lines.append(
            f"{q.id:<6}{q.citation_precision:>11.2f}{q.source_recall:>9.2f}{q.fact_coverage:>8.2f}  {q.terminal_state}"
        )
    lines.append("-" * 46)
    lines.append(
        f"{'mean':<6}{card.mean('citation_precision'):>11.2f}{card.mean('source_recall'):>9.2f}"
        f"{card.mean('fact_coverage'):>8.2f}"
    )
    lines.append(f"score {card.score()} / 100")
    return "\n".join(lines)
