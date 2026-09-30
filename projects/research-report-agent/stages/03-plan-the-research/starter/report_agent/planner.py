"""Research planning: turn one question into facets to search for.

Lesson: projects/research-report-agent/stages/03-plan-the-research/docs/en.md
A deterministic rule planner is the default. A Model can replace it, and any
bad model output falls back to the rules. Stdlib only.
"""

import json
import re
from dataclasses import dataclass, field

from report_agent.search import tokenize

LEADING_WORDS = frozenset(
    "what how why when which who where do does did is are was were should can could would "
    "the a an".split()
)

FACET_TEMPLATES = (
    ("Overview", "What is {subject}?", ()),
    ("How it works", "How does {subject} work?", ("works", "uses", "runs")),
    (
        "Risks and limits",
        "What are the risks and limits of {subject}?",
        ("risk", "attack", "escape", "weakness", "cost"),
    ),
    (
        "When to use it",
        "When should teams use {subject}?",
        ("use", "teams", "tradeoff", "overhead"),
    ),
)


@dataclass(frozen=True)
class Facet:
    id: str
    sub_question: str
    keywords: tuple
    label: str = ""

    def query(self):
        """Return the search text for this facet: sub_question plus keywords."""
        raise NotImplementedError(
            "Stage 3: implement Facet.query in report_agent/planner.py"
        )


@dataclass
class Plan:
    question: str
    facets: list
    source: str = "rules"
    notes: list = field(default_factory=list)


def subject_of(question):
    """Strip the trailing punctuation and leading question words from `question`."""
    raise NotImplementedError(
        "Stage 3: implement subject_of in report_agent/planner.py"
    )


def rule_plan(question, max_facets=4):
    """Build facets from FACET_TEMPLATES.

    Ids are F1, F2, ... Keywords are the question tokens plus the template
    extras, without duplicates. Labels come from the template.
    """
    raise NotImplementedError("Stage 3: implement rule_plan in report_agent/planner.py")


def build_planner_prompt(question, max_facets=4):
    return (
        "You plan research for a cited report.\n"
        f"Split the question into at most {max_facets} facets.\n"
        'Reply with JSON only: {"facets": [{"sub_question": "...", "keywords": ["..."]}]}\n'
        f"Question: {question}"
    )


def parse_model_facets(raw, max_facets):
    """Parse a model reply into Facets.

    The reply must be JSON with a non-empty `facets` list; each item needs a
    string `sub_question` and a list of string `keywords` (label optional).
    Raise ValueError on anything else.
    """
    raise NotImplementedError(
        "Stage 3: implement parse_model_facets in report_agent/planner.py"
    )


def plan_research(question, model=None, max_facets=4):
    """Plan the research for `question`.

    Raise ValueError for an empty question. Without a model, return a
    rule plan (source 'rules'). With a model, send build_planner_prompt()
    with purpose='plan' and parse the reply (source 'model'). If the call or
    the parse fails, fall back to the rule plan with source 'rules-fallback'
    and record why in notes.
    """
    raise NotImplementedError(
        "Stage 3: implement plan_research in report_agent/planner.py"
    )
