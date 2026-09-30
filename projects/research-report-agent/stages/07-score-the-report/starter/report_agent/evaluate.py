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
        """Return the mean of `metric` over all questions, rounded to 4 places."""
        raise NotImplementedError(
            "Stage 7: implement Scorecard.mean in report_agent/evaluate.py"
        )

    def score(self):
        """Return the weighted score out of 100 using WEIGHTS, rounded to 1 place."""
        raise NotImplementedError(
            "Stage 7: implement Scorecard.score in report_agent/evaluate.py"
        )


def citation_precision(report, threshold=0.8):
    """Share of published sentences whose best support_score over their cites is
    at least `threshold`. 0.0 for an empty report.
    """
    raise NotImplementedError(
        "Stage 7: implement citation_precision in report_agent/evaluate.py"
    )


def source_recall(report, expected_docs):
    """Share of expected documents that the report cites. 1.0 if none expected."""
    raise NotImplementedError(
        "Stage 7: implement source_recall in report_agent/evaluate.py"
    )


def fact_coverage(report, key_facts):
    """Share of key facts (lists of terms) where one sentence contains every term,
    case-insensitive. 1.0 if there are no key facts.
    """
    raise NotImplementedError(
        "Stage 7: implement fact_coverage in report_agent/evaluate.py"
    )


def evaluate(questions_path, corpus_dir, model=None):
    """Run the pipeline for every question in the JSON file and return a Scorecard."""
    raise NotImplementedError("Stage 7: implement evaluate in report_agent/evaluate.py")


def format_scorecard(card):
    """Return a table of per-question metrics, the means, and 'score N / 100'."""
    raise NotImplementedError(
        "Stage 7: implement format_scorecard in report_agent/evaluate.py"
    )
