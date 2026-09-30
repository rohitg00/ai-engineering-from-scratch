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
        self.max_steps = max_steps
        self.max_tokens = max_tokens
        self.used_steps = 0
        self.used_tokens = 0

    def charge(self, step, tokens=0):
        if self.used_steps + 1 > self.max_steps:
            raise BudgetExceeded(f"step budget exhausted at {step!r}")
        if self.used_tokens + tokens > self.max_tokens:
            raise BudgetExceeded(f"token budget exhausted at {step!r}")
        self.used_steps += 1
        self.used_tokens += tokens

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
    terms = set()
    for position, word in enumerate(WORD_RE.findall(sentence)):
        cleaned = word.strip(".").lower()
        if not cleaned:
            continue
        has_digit = any(char.isdigit() for char in word)
        inner_capital = any(char.isupper() for char in word[1:])
        proper_mid_sentence = word[0].isupper() and position > 0
        if has_digit or inner_capital or proper_mid_sentence:
            terms.add(cleaned)
    return terms


def support_score(sentence, snippet_text):
    claim = strip_cites(sentence)
    claim_tokens = set(tokenize(claim))
    source_tokens = set(tokenize(snippet_text))
    source_lower = snippet_text.lower()
    missing = [term for term in strict_terms(claim) if term not in source_lower]
    if missing:
        return 0.0, f"names or numbers not in source: {', '.join(sorted(missing))}"
    claim_neg = set(re.findall(r"[a-z]+", claim.lower())) & NEGATIONS
    source_neg = set(re.findall(r"[a-z]+", source_lower)) & NEGATIONS
    if claim_neg != source_neg:
        return 0.0, "negation differs from source"
    if not claim_tokens:
        return 0.0, "no content words"
    overlap = len(claim_tokens & source_tokens) / len(claim_tokens)
    return round(overlap, 4), "overlap"


def snippet_text(snippet):
    return snippet if isinstance(snippet, str) else snippet.text


def review(markdown, snippets, threshold=0.6):
    verdicts = []
    for sentence in report_sentences(markdown):
        cites = tuple(cites_of(sentence))
        if not cites:
            verdicts.append(Verdict(sentence, cites, 0.0, False, "uncited"))
            continue
        dangling = [cite for cite in cites if cite not in snippets]
        if dangling:
            verdicts.append(
                Verdict(sentence, cites, 0.0, False, f"dangling:{','.join(dangling)}")
            )
            continue
        best_score, best_reason = -1.0, ""
        for cite in cites:
            score, reason = support_score(sentence, snippet_text(snippets[cite]))
            if score > best_score:
                best_score, best_reason = score, reason
        supported = best_score >= threshold
        if supported:
            reason = "supported"
        elif best_reason == "overlap":
            reason = f"low overlap {best_score:.2f}"
        else:
            reason = best_reason
        verdicts.append(Verdict(sentence, cites, best_score, supported, reason))
    return verdicts


def decide_state(verdicts, budget_exceeded=False):
    if budget_exceeded:
        return "failed"
    if not verdicts or not any(verdict.supported for verdict in verdicts):
        return "failed"
    if all(verdict.supported for verdict in verdicts):
        return "completed"
    return "needs_review"


def apply_verdicts(report, verdicts):
    keep = {verdict.sentence for verdict in verdicts if verdict.supported}
    sections = []
    for section in report.sections:
        sentences = [
            sentence for sentence in section.sentences if sentence.render() in keep
        ]
        if sentences:
            sections.append(replace(section, sentences=sentences))
    used = {
        cite
        for section in sections
        for sentence in section.sentences
        for cite in sentence.cites
    }
    return replace(
        report,
        sections=sections,
        snippets={key: value for key, value in report.snippets.items() if key in used},
    )
