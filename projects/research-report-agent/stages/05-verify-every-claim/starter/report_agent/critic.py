"""Critic: check every sentence against the snippet it cites, under a budget.

Lesson: projects/research-report-agent/stages/05-verify-every-claim/docs/en.md
Support is lexical: content overlap plus strict rules for names, numbers and
negation. The harness, not the writer, decides the terminal state.
"""

import re
from dataclasses import dataclass, replace

from report_agent.citations import cites_of, report_sentences, strip_cites
from report_agent.search import tokenize

NEGATIONS = frozenset({"not", "no", "never", "cannot", "without", "nothing"})
WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9./-]*")
TERMINAL_STATES = ("completed", "needs_review", "failed")


class BudgetExceeded(RuntimeError):
    pass


@dataclass(frozen=True)
class Verdict:
    sentence: str
    cites: tuple
    score: float
    supported: bool
    reason: str


class Budget:
    def __init__(self, max_steps=50, max_tokens=20000):
        """Store the limits and start the used counters at zero."""
        raise NotImplementedError(
            "Stage 5: implement Budget.__init__ in report_agent/critic.py"
        )

    def charge(self, step, tokens=0):
        """Count one step and `tokens` tokens, or raise BudgetExceeded first
        if either limit would be passed.
        """
        raise NotImplementedError(
            "Stage 5: implement Budget.charge in report_agent/critic.py"
        )

    def to_dict(self):
        return {
            "max_steps": self.max_steps,
            "used_steps": self.used_steps,
            "max_tokens": self.max_tokens,
            "used_tokens": self.used_tokens,
        }


def estimate_tokens(text):
    return max(1, len(text) // 4)


def strict_terms(sentence):
    """Return lowercase words the source must contain: words with digits, words
    with a capital after the first letter, and capitalized words after the
    first position.
    """
    raise NotImplementedError(
        "Stage 5: implement strict_terms in report_agent/critic.py"
    )


def support_score(sentence, snippet_text):
    """Return (score, reason) for how well `snippet_text` supports `sentence`.

    0.0 when a strict term is missing from the source or the negation words
    differ. Otherwise the share of the claim's content tokens found in the
    source, with reason 'overlap'.
    """
    raise NotImplementedError(
        "Stage 5: implement support_score in report_agent/critic.py"
    )


def snippet_text(snippet):
    return snippet if isinstance(snippet, str) else snippet.text


def review(markdown, snippets, threshold=0.6):
    """Return one Verdict per sentence.

    Uncited and dangling sentences are unsupported. Otherwise use the best
    support_score over the cited snippets; supported means score >= threshold.
    Reasons: 'supported', 'uncited', 'dangling:...', 'low overlap 0.42', or
    the support_score reason.
    """
    raise NotImplementedError("Stage 5: implement review in report_agent/critic.py")


def decide_state(verdicts, budget_exceeded=False):
    """Return 'failed' if the budget ran out or nothing is supported,
    'completed' if everything is supported, otherwise 'needs_review'.
    """
    raise NotImplementedError(
        "Stage 5: implement decide_state in report_agent/critic.py"
    )


def apply_verdicts(report, verdicts):
    """Return a copy of the report without unsupported sentences, empty
    sections, or snippets no remaining sentence cites.
    """
    raise NotImplementedError(
        "Stage 5: implement apply_verdicts in report_agent/critic.py"
    )
