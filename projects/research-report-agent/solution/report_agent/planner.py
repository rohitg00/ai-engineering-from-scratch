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
        return self.sub_question + " " + " ".join(self.keywords)


@dataclass
class Plan:
    question: str
    facets: list
    source: str = "rules"
    notes: list = field(default_factory=list)


def subject_of(question):
    words = re.sub(r"[?!.]+$", "", question.strip()).split()
    while words and words[0].lower() in LEADING_WORDS:
        words.pop(0)
    return " ".join(words) or question.strip()


def rule_plan(question, max_facets=4):
    subject = subject_of(question)
    base = tuple(tokenize(question))
    facets = []
    for position, (label, template, extra) in enumerate(
        FACET_TEMPLATES[:max_facets], start=1
    ):
        keywords = tuple(dict.fromkeys(base + extra))
        facets.append(
            Facet(
                id=f"F{position}",
                sub_question=template.format(subject=subject),
                keywords=keywords,
                label=label,
            )
        )
    return facets


def build_planner_prompt(question, max_facets=4):
    return (
        "You plan research for a cited report.\n"
        f"Split the question into at most {max_facets} facets.\n"
        'Reply with JSON only: {"facets": [{"sub_question": "...", "keywords": ["..."]}]}\n'
        f"Question: {question}"
    )


def parse_model_facets(raw, max_facets):
    data = json.loads(raw)
    items = data.get("facets") if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError("model reply has no facets list")
    facets = []
    for position, item in enumerate(items[:max_facets], start=1):
        sub_question = item.get("sub_question") if isinstance(item, dict) else None
        keywords = item.get("keywords") if isinstance(item, dict) else None
        if not isinstance(sub_question, str) or not sub_question.strip():
            raise ValueError(f"facet {position} has no sub_question")
        if not isinstance(keywords, list) or not all(
            isinstance(word, str) for word in keywords
        ):
            raise ValueError(f"facet {position} keywords must be a list of strings")
        label = item.get("label") if isinstance(item.get("label"), str) else ""
        facets.append(
            Facet(
                id=f"F{position}",
                sub_question=sub_question.strip(),
                keywords=tuple(keywords),
                label=label,
            )
        )
    return facets


def plan_research(question, model=None, max_facets=4):
    if not question or not question.strip():
        raise ValueError("question must not be empty")
    if model is None:
        return Plan(question=question, facets=rule_plan(question, max_facets))
    try:
        raw = model.complete(build_planner_prompt(question, max_facets), purpose="plan")
        return Plan(
            question=question,
            facets=parse_model_facets(raw, max_facets),
            source="model",
        )
    except (KeyError, ValueError, TypeError, AttributeError) as error:
        return Plan(
            question=question,
            facets=rule_plan(question, max_facets),
            source="rules-fallback",
            notes=[f"model plan rejected: {error}"],
        )
