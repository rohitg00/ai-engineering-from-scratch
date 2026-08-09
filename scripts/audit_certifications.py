#!/usr/bin/env python3
"""Validate Claude certification curriculum sources and assessments.

Usage:
    python3 scripts/audit_certifications.py
    python3 scripts/audit_certifications.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
CERT_ROOT = ROOT / "certifications" / "claude"
CERT_README_PATH = CERT_ROOT / "README.md"
GETTING_STARTED_PATH = CERT_ROOT / "GETTING_STARTED.md"
PROGRAM_PATH = CERT_ROOT / "program.json"
TRACKS_DIR = CERT_ROOT / "tracks"
LESSONS_DIR = CERT_ROOT / "lessons"
PREREQUISITES_PATH = CERT_ROOT / "prerequisites.json"
CERT_SKILL_PATH = ROOT / "skills" / "claude-certification" / "SKILL.md"
CLAUDE_CERT_SKILL_PATH = ROOT / ".claude" / "skills" / "claude-certification" / "SKILL.md"
CERT_SKILL_OPENAI_PATH = CERT_SKILL_PATH.parent / "agents" / "openai.yaml"
CLAUDE_CERT_SKILL_OPENAI_PATH = CLAUDE_CERT_SKILL_PATH.parent / "agents" / "openai.yaml"
ROOT_README_PATH = ROOT / "README.md"
BOOK_WORKFLOW_PATH = ROOT / ".github" / "workflows" / "build-book.yml"
BOOK_SCRIPT_PATH = ROOT / "scripts" / "build_book.py"
FIGURE_RUNTIME_PATH = ROOT / "site" / "figures-claude-certifications.js"
PUBLIC_CERT_PAGES = (
    ROOT / "site" / "certifications.html",
    ROOT / "site" / "certification.html",
    ROOT / "site" / "assessment.html",
)

LESSON_NAME_RE = re.compile(r"^[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FIELD_RE = re.compile(r"^\*\*(?P<name>[^*]+):\*\*\s*(?P<value>.+)$", re.MULTILINE)
H1_RE = re.compile(r"^#\s+\S", re.MULTILINE)
LEARNING_OBJECTIVES_RE = re.compile(r"^##\s+Learning Objectives\s*$", re.MULTILINE)
FIGURE_FENCE_RE = re.compile(r"```figure\s*\n\s*([a-z0-9-]+)", re.MULTILINE)
CODE_EXTENSIONS = {".py": "Python", ".ts": "TypeScript", ".rs": "Rust", ".jl": "Julia"}
QUIZ_KEYS = {"stage", "question", "options", "correct", "explanation"}
STAGES = Counter({"pre": 1, "check": 3, "post": 2})
DISALLOWED_DASHES = {"\u2013": "en dash", "\u2014": "em dash"}
OFFICIAL_EXAM_FACTS = {
    "claude-ccao-f": {"items": 60, "timeLimitMinutes": 120, "feeUsd": 99},
    "claude-ccdv-f": {"items": 53, "timeLimitMinutes": 120, "feeUsd": 125},
    "claude-ccar-f": {"items": 60, "timeLimitMinutes": 120, "feeUsd": 125},
    "claude-ccar-p": {"items": 63, "timeLimitMinutes": 120, "feeUsd": 175},
}
COMMON_OFFICIAL_EXAM_FACTS = {
    "passingScaledScore": 720,
    "scoreScale": "100-1000",
    "validityMonths": 12,
    "guideVersion": "1.0",
    "effective": "July 2026",
}
PARITY_HEADINGS = (
    "Interactive Lab",
    "Practice Lab",
    "Shipped Artifact",
    "Verify It",
    "Capstone Connection",
)
EXPECTED_FIGURES = {
    "00": "00-certification-route-map",
    "01": "01-claude-model-fit",
    "02": "02-responsible-ai-risk",
    "03": "03-prompt-contract",
    "04": "04-context-cache",
    "05": "05-document-vision-pipeline",
    "06": "06-data-analysis-confidence",
    "07": "07-human-review-threshold",
    "08": "08-messages-lifecycle",
    "09": "09-structured-output-recovery",
    "10": "10-tool-loop-budget",
    "11": "11-mcp-permission-boundary",
    "12": "12-agent-hook-lifecycle",
    "13": "13-secrets-threat-model",
    "14": "14-eval-observability-loop",
    "15": "15-team-agent-loop",
    "16": "16-multi-agent-topology",
    "17": "17-session-context-budget",
    "18": "18-tool-discovery-contract",
    "19": "19-memory-rule-precedence",
    "20": "20-batch-review-confidence",
    "21": "21-provenance-escalation",
    "22": "22-sla-value-tradeoff",
    "23": "23-architecture-tradeoff",
    "24": "24-rag-ranking",
    "25": "25-identity-permission-path",
    "26": "26-latency-cost-slo",
    "27": "27-governance-approval-flow",
    "28": "28-adr-lifecycle",
    "29": "29-associate-capstone-readiness",
    "30": "30-developer-capstone-readiness",
    "31": "31-architect-foundation-readiness",
    "32": "32-architect-professional-readiness",
}


@dataclass(frozen=True)
class Finding:
    rule: str
    path: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"rule": self.rule, "path": self.path, "message": self.message}


class Audit:
    def __init__(self) -> None:
        self.findings: list[Finding] = []
        self.lessons_checked = 0
        self.assessments_checked = 0
        self.questions_checked = 0

    def add(self, rule: str, path: Path, message: str) -> None:
        try:
            relative = path.relative_to(ROOT).as_posix()
        except ValueError:
            relative = path.as_posix()
        self.findings.append(Finding(rule, relative, message))


def load_json(audit: Audit, path: Path) -> Any | None:
    if not path.is_file():
        audit.add("C001", path, "missing JSON file")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        audit.add("C002", path, f"invalid JSON: {exc}")
        return None


def require_string(audit: Audit, path: Path, value: Any, field: str) -> str | None:
    if not isinstance(value, str) or not value.strip():
        audit.add("C003", path, f"{field} must be a non-empty string")
        return None
    return value


def check_id(audit: Audit, path: Path, value: Any, field: str) -> str | None:
    text = require_string(audit, path, value, field)
    if text is not None and not ID_RE.fullmatch(text):
        audit.add("C004", path, f"{field} must use lowercase kebab-case: {text!r}")
    return text


def check_fenced_code_languages(audit: Audit, path: Path, text: str) -> None:
    in_fence = False
    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped.startswith("```"):
            continue
        if in_fence:
            in_fence = False
            continue
        language = stripped[3:].strip()
        if not language:
            audit.add("C021", path, f"code fence at line {line_number} has no language tag")
        in_fence = True
    if in_fence:
        audit.add("C022", path, "unclosed fenced code block")


def check_prose_style(audit: Audit, path: Path, text: str) -> None:
    for character, label in DISALLOWED_DASHES.items():
        if character in text:
            audit.add("C023", path, f"contains a disallowed {label}; use punctuation or a hyphen")


def normalized_correct(question: dict[str, Any]) -> tuple[int, ...] | None:
    raw = question.get("correct")
    if isinstance(raw, int) and not isinstance(raw, bool):
        return (raw,)
    if isinstance(raw, list) and raw and all(isinstance(item, int) and not isinstance(item, bool) for item in raw):
        return tuple(sorted(raw))
    return None


def check_answer_quality(audit: Audit, path: Path, questions: list[Any]) -> None:
    """Reject answer-key and length patterns that make a bank guessable."""
    answer_sets: dict[int, Counter[tuple[int, ...]]] = defaultdict(Counter)
    length_strategy_hits = Counter()
    single_count = 0
    unique_longest_correct = 0
    valid_count = 0
    for question in questions:
        if not isinstance(question, dict):
            continue
        options = question.get("options")
        correct = normalized_correct(question)
        if not isinstance(options, list) or len(options) != 4 or correct is None:
            continue
        if any(index < 0 or index >= len(options) for index in correct):
            continue
        answer_sets[len(correct)][correct] += 1
        valid_count += 1
        correct_set = set(correct)
        incorrect = [index for index in range(len(options)) if index not in correct_set]
        for metric, lengths in (
            ("characters", [len(str(option)) for option in options]),
            ("words", [len(re.findall(r"\w+", str(option))) for option in options]),
        ):
            correct_lengths = [lengths[index] for index in correct]
            incorrect_lengths = [lengths[index] for index in incorrect]
            if max(correct_lengths) < min(incorrect_lengths):
                length_strategy_hits[(metric, "shortest")] += 1
            if min(correct_lengths) > max(incorrect_lengths):
                length_strategy_hits[(metric, "longest")] += 1
        if len(correct) == 1:
            single_count += 1
            lengths = [len(re.findall(r"\w+", str(option))) for option in options]
            correct_length = lengths[correct[0]]
            if lengths.count(correct_length) == 1 and correct_length == max(lengths):
                unique_longest_correct += 1

    for correct_count, observed in sorted(answer_sets.items()):
        possible = list(combinations(range(4), correct_count))
        frequencies = [observed.get(answer_set, 0) for answer_set in possible]
        if frequencies and max(frequencies) - min(frequencies) > 1:
            audit.add(
                "C066",
                path,
                f"answer positions for {correct_count}-answer items are imbalanced: {dict(observed)}",
            )

    fixed_guess_hits = sum(max(counter.values(), default=0) for counter in answer_sets.values())
    if valid_count and fixed_guess_hits / valid_count > 0.5:
        audit.add(
            "C067",
            path,
            f"a fixed answer-position strategy gets {fixed_guess_hits}/{valid_count} items correct",
        )
    if single_count and unique_longest_correct / single_count > 0.5:
        audit.add(
            "C068",
            path,
            f"the correct option is uniquely longest in {unique_longest_correct}/{single_count} single-answer items",
        )
    excessive_length_strategies = [
        f"{direction} by {metric} gets {hits}/{valid_count}"
        for (metric, direction), hits in sorted(length_strategy_hits.items())
        if valid_count and hits / valid_count > 0.35
    ]
    if excessive_length_strategies:
        audit.add(
            "C069",
            path,
            "answer length is predictive: " + "; ".join(excessive_length_strategies),
        )


def language_field(text: str) -> str | None:
    fields = {match.group("name").strip(): match.group("value").strip() for match in FIELD_RE.finditer(text)}
    return fields.get("Languages")


def code_languages(lesson_dir: Path) -> set[str]:
    code_dir = lesson_dir / "code"
    result: set[str] = set()
    if not code_dir.is_dir():
        return result
    for extension, name in CODE_EXTENSIONS.items():
        if (code_dir / f"main{extension}").is_file():
            result.add(name)
    return result


def check_code_and_tests(audit: Audit, lesson_dir: Path, doc_text: str) -> None:
    expected = code_languages(lesson_dir)
    declared = language_field(doc_text)
    if declared is None:
        audit.add("C024", lesson_dir / "docs" / "en.md", "missing **Languages:** field")
    else:
        normalized = declared.strip().lower()
        if not expected and normalized not in {"none", "n/a", "-", "no code"}:
            audit.add("C025", lesson_dir / "docs" / "en.md", f"Languages declares {declared!r}, but no code/main.* exists")
        if expected:
            declared_set = {item.strip() for item in declared.split(",") if item.strip()}
            if declared_set != expected:
                audit.add("C025", lesson_dir / "docs" / "en.md", f"Languages {sorted(declared_set)} do not match code mains {sorted(expected)}")

    if not expected:
        audit.add(
            "C028",
            lesson_dir / "code",
            "full-parity certification lessons need a runnable scenario, simulator, or artifact validator in code/main.*",
        )
        return
    code_dir = lesson_dir / "code"
    for extension in CODE_EXTENSIONS:
        main = code_dir / f"main{extension}"
        if not main.is_file():
            continue
        source = main.read_text(encoding="utf-8")
        if "docs/en.md" not in source:
            audit.add("C026", main, "main file header must cite this lesson's docs/en.md")
    if "Python" in expected:
        tests_dir = code_dir / "tests"
        test_files = sorted(tests_dir.glob("test*.py")) if tests_dir.is_dir() else []
        test_count = 0
        for test_file in test_files:
            test_count += len(re.findall(r"^\s*def\s+test_[a-zA-Z0-9_]+\s*\(", test_file.read_text(encoding="utf-8"), re.MULTILINE))
        if test_count < 5:
            audit.add("C027", tests_dir, f"Python lesson needs at least 5 test methods; found {test_count}")


def check_lesson_quiz(audit: Audit, lesson_dir: Path) -> None:
    path = lesson_dir / "quiz.json"
    data = load_json(audit, path)
    if data is None:
        return
    if not isinstance(data, dict):
        audit.add("C030", path, "quiz must be an object with lesson, title, and questions")
        return
    if data.get("lesson") != lesson_dir.name:
        audit.add("C031", path, f"lesson must equal directory slug {lesson_dir.name!r}")
    require_string(audit, path, data.get("title"), "title")
    questions = data.get("questions")
    if not isinstance(questions, list) or len(questions) != 6:
        audit.add("C032", path, f"questions must contain exactly 6 items; found {len(questions) if isinstance(questions, list) else 'non-list'}")
        return
    stages: Counter[str] = Counter()
    prompts: set[str] = set()
    for index, question in enumerate(questions):
        location = f"question[{index}]"
        if not isinstance(question, dict):
            audit.add("C033", path, f"{location} must be an object")
            continue
        missing = QUIZ_KEYS - question.keys()
        if missing:
            audit.add("C033", path, f"{location} missing keys {sorted(missing)}")
            continue
        stage = question.get("stage")
        if stage not in STAGES:
            audit.add("C034", path, f"{location} has unknown stage {stage!r}")
        else:
            stages[stage] += 1
        prompt = question.get("question")
        if not isinstance(prompt, str) or not prompt.strip():
            audit.add("C035", path, f"{location} question must be non-empty")
        elif prompt in prompts:
            audit.add("C036", path, f"{location} duplicates another question")
        else:
            prompts.add(prompt)
        options = question.get("options")
        correct = question.get("correct")
        if not isinstance(options, list) or len(options) != 4 or not all(isinstance(item, str) and item.strip() for item in options):
            audit.add("C037", path, f"{location} must have exactly 4 non-empty options")
        elif len(set(options)) != len(options):
            audit.add("C037", path, f"{location} options must be unique")
        elif not isinstance(correct, int) or isinstance(correct, bool) or not 0 <= correct < len(options):
            audit.add("C038", path, f"{location} correct must be a valid zero-based option index")
        if not isinstance(question.get("explanation"), str) or len(question["explanation"].strip()) < 20:
            audit.add("C039", path, f"{location} explanation is missing or too short")
    if stages != STAGES:
        audit.add("C034", path, f"quiz stage distribution must be {dict(STAGES)}; found {dict(stages)}")
    check_answer_quality(audit, path, questions)


def check_lesson(audit: Audit, lesson_dir: Path) -> None:
    audit.lessons_checked += 1
    if not LESSON_NAME_RE.fullmatch(lesson_dir.name):
        audit.add("C020", lesson_dir, "lesson directory must use NN-kebab-case")
    doc_path = lesson_dir / "docs" / "en.md"
    if not doc_path.is_file():
        audit.add("C020", doc_path, "missing docs/en.md")
        check_lesson_quiz(audit, lesson_dir)
        return
    text = doc_path.read_text(encoding="utf-8")
    if len(text.split()) < 800:
        audit.add("C020", doc_path, f"lesson is too thin for certification preparation: {len(text.split())} words, minimum 800")
    if not H1_RE.search(text):
        audit.add("C020", doc_path, "missing top-level heading")
    if not LEARNING_OBJECTIVES_RE.search(text):
        audit.add("C020", doc_path, "missing Learning Objectives section")
    for heading in PARITY_HEADINGS:
        if not re.search(rf"^##\s+{re.escape(heading)}\s*$", text, re.MULTILINE):
            audit.add("C029", doc_path, f"missing full-parity section '## {heading}'")
    expected_figure = EXPECTED_FIGURES.get(lesson_dir.name[:2])
    figure_ids = set(FIGURE_FENCE_RE.findall(text))
    if expected_figure and expected_figure not in figure_ids:
        audit.add("C029", doc_path, f"Interactive Lab must embed figure {expected_figure!r}")
    if expected_figure and FIGURE_RUNTIME_PATH.is_file():
        runtime = FIGURE_RUNTIME_PATH.read_text(encoding="utf-8")
        if f"'{expected_figure}'" not in runtime:
            audit.add("C029", FIGURE_RUNTIME_PATH, f"missing registered figure {expected_figure!r}")
    outputs_dir = lesson_dir / "outputs"
    output_files = sorted(path for path in outputs_dir.rglob("*") if path.is_file()) if outputs_dir.is_dir() else []
    if not output_files:
        audit.add("C029", outputs_dir, "lesson must ship at least one reusable output artifact")
    for required in ("Type", "Languages", "Prerequisites", "Time"):
        if not re.search(rf"^\*\*{re.escape(required)}:\*\*\s*\S", text, re.MULTILINE):
            audit.add("C024", doc_path, f"missing **{required}:** field")
    check_fenced_code_languages(audit, doc_path, text)
    check_prose_style(audit, doc_path, text)
    check_code_and_tests(audit, lesson_dir, text)
    check_lesson_quiz(audit, lesson_dir)


def check_assessment_question(
    audit: Audit,
    path: Path,
    question: Any,
    index: int,
    domain_ids: set[str],
    domain_objectives: dict[str, set[str]],
    seen_ids: set[str],
    seen_prompts: set[str],
) -> str | None:
    location = f"question[{index}]"
    if not isinstance(question, dict):
        audit.add("C050", path, f"{location} must be an object")
        return None
    question_id = check_id(audit, path, question.get("id"), f"{location}.id")
    if question_id:
        if question_id in seen_ids:
            audit.add("C051", path, f"duplicate question id {question_id!r}")
        seen_ids.add(question_id)
    domain = question.get("domain")
    if domain not in domain_ids:
        audit.add("C052", path, f"{location} references unknown domain {domain!r}")
        domain = None
    objective = require_string(audit, path, question.get("objective"), f"{location}.objective")
    if domain and objective and objective not in domain_objectives.get(domain, set()):
        audit.add("C065", path, f"{location}.objective is not declared by domain {domain!r}: {objective!r}")
    prompt = require_string(audit, path, question.get("prompt"), f"{location}.prompt")
    if prompt:
        if prompt in seen_prompts:
            audit.add("C053", path, f"{location} duplicates another prompt")
        seen_prompts.add(prompt)
    question_type = question.get("type")
    if question_type not in {"single", "multiple"}:
        audit.add("C054", path, f"{location}.type must be single or multiple")
    options = question.get("options")
    correct = question.get("correct")
    if not isinstance(options, list) or len(options) != 4 or not all(isinstance(item, str) and item.strip() for item in options):
        audit.add("C055", path, f"{location}.options must contain exactly 4 non-empty strings")
    elif len(set(options)) != len(options):
        audit.add("C055", path, f"{location}.options must be unique")
    if not isinstance(correct, list) or not correct or not all(isinstance(item, int) and not isinstance(item, bool) for item in correct):
        audit.add("C056", path, f"{location}.correct must be a non-empty array of integer indices")
    elif isinstance(options, list):
        if len(correct) != len(set(correct)):
            audit.add("C056", path, f"{location}.correct contains duplicate indices")
        if any(item < 0 or item >= len(options) for item in correct):
            audit.add("C056", path, f"{location}.correct contains an out-of-range index")
        if question_type == "single" and len(correct) != 1:
            audit.add("C057", path, f"{location} single question must have exactly one correct index")
        if question_type == "multiple" and len(correct) < 2:
            audit.add("C057", path, f"{location} multiple question must have at least two correct indices")
        if question_type == "multiple" and len(correct) >= len(options):
            audit.add("C057", path, f"{location} multiple question cannot mark every option correct")
    if not isinstance(question.get("explanation"), str) or len(question["explanation"].split()) < 20:
        audit.add("C058", path, f"{location}.explanation must provide a substantive rationale")
    references = question.get("references")
    if not isinstance(references, list) or not references or not all(isinstance(item, str) and item.strip() for item in references):
        audit.add("C059", path, f"{location}.references must contain at least one source or lesson reference")
    else:
        internal = [item for item in references if item.startswith("certifications/claude/lessons/")]
        if not internal:
            audit.add("C059", path, f"{location}.references must include an internal lesson remediation path")
        for reference in internal:
            if not (ROOT / reference).is_dir():
                audit.add("C059", path, f"{location}.references contains missing lesson path {reference!r}")
    return domain


def check_assessment(audit: Audit, path: Path, declaration: dict[str, Any], track: dict[str, Any]) -> None:
    audit.assessments_checked += 1
    data = load_json(audit, path)
    if data is None or not isinstance(data, dict):
        return
    if data.get("id") != declaration.get("id"):
        audit.add("C060", path, "assessment id does not match track declaration")
    if data.get("track") != track.get("id"):
        audit.add("C060", path, "assessment track does not match owning track")
    if data.get("kind") != declaration.get("kind") or data.get("kind") not in {"diagnostic", "mock"}:
        audit.add("C060", path, "assessment kind is invalid or does not match declaration")
    if data.get("timeLimitMinutes") != declaration.get("timeLimitMinutes"):
        audit.add("C060", path, "timeLimitMinutes does not match track declaration")
    if not isinstance(data.get("version"), int) or isinstance(data.get("version"), bool) or data.get("version") < 1:
        audit.add("C060", path, "assessment version must be a positive integer")
    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        audit.add("C061", path, "assessment questions must be a non-empty array")
        return
    audit.questions_checked += len(questions)
    if data.get("kind") == "mock" and len(questions) != track.get("exam", {}).get("items"):
        audit.add("C062", path, f"full mock must match official item count {track.get('exam', {}).get('items')}; found {len(questions)}")
    domain_ids = {domain.get("id") for domain in track.get("domains", []) if isinstance(domain, dict)}
    domain_objectives = {
        domain.get("id"): {
            objective for objective in domain.get("objectives", []) if isinstance(objective, str)
        }
        for domain in track.get("domains", [])
        if isinstance(domain, dict) and isinstance(domain.get("id"), str)
    }
    seen_ids: set[str] = set()
    seen_prompts: set[str] = set()
    distribution: Counter[str] = Counter()
    for index, question in enumerate(questions):
        domain = check_assessment_question(
            audit,
            path,
            question,
            index,
            domain_ids,
            domain_objectives,
            seen_ids,
            seen_prompts,
        )
        if domain:
            distribution[domain] += 1
    missing_domains = domain_ids - distribution.keys()
    if missing_domains:
        audit.add("C063", path, f"assessment does not cover domains {sorted(missing_domains)}")
    if data.get("kind") == "mock":
        total = len(questions)
        for domain in track.get("domains", []):
            target = total * float(domain.get("weight", 0)) / 100
            actual = distribution.get(domain.get("id"), 0)
            if abs(actual - target) > 2.0:
                audit.add("C064", path, f"domain {domain.get('id')} has {actual} questions; blueprint target is about {target:.1f}")
    check_answer_quality(audit, path, questions)


def check_track(audit: Audit, path: Path, track: Any, global_ids: set[str]) -> tuple[dict[str, Any] | None, set[str]]:
    if not isinstance(track, dict):
        audit.add("C010", path, "track must be a JSON object")
        return None, set()
    track_id = check_id(audit, path, track.get("id"), "id")
    if track_id:
        if track_id in global_ids:
            audit.add("C011", path, f"duplicate track id {track_id!r}")
        global_ids.add(track_id)
    for field in ("slug", "examCode", "credential", "shortName", "summary", "audience"):
        require_string(audit, path, track.get(field), field)
    exam = track.get("exam")
    if not isinstance(exam, dict):
        audit.add("C006", path, "exam must be an object")
    else:
        expected_exam = dict(COMMON_OFFICIAL_EXAM_FACTS)
        expected_exam.update(OFFICIAL_EXAM_FACTS.get(track_id or "", {}))
        for field, expected in expected_exam.items():
            if exam.get(field) != expected:
                audit.add("C006", path, f"exam.{field} must equal verified guide value {expected!r}; found {exam.get(field)!r}")
        for field in ("format", "delivery", "officialGuideUrl"):
            require_string(audit, path, exam.get(field), f"exam.{field}")
        guide_url = exam.get("officialGuideUrl")
        if isinstance(guide_url, str) and not guide_url.startswith("https://"):
            audit.add("C006", path, "exam.officialGuideUrl must be an HTTPS URL")
    domains = track.get("domains")
    if not isinstance(domains, list) or not domains:
        audit.add("C012", path, "domains must be a non-empty array")
        return track, set()
    domain_ids: set[str] = set()
    weight_total = 0.0
    for index, domain in enumerate(domains):
        if not isinstance(domain, dict):
            audit.add("C012", path, f"domain[{index}] must be an object")
            continue
        domain_id = check_id(audit, path, domain.get("id"), f"domain[{index}].id")
        if domain_id:
            if domain_id in domain_ids:
                audit.add("C013", path, f"duplicate domain id {domain_id!r}")
            domain_ids.add(domain_id)
        require_string(audit, path, domain.get("name"), f"domain[{index}].name")
        weight = domain.get("weight")
        if not isinstance(weight, (int, float)) or isinstance(weight, bool) or weight <= 0:
            audit.add("C014", path, f"domain[{index}].weight must be positive")
        else:
            weight_total += float(weight)
        objectives = domain.get("objectives")
        if not isinstance(objectives, list) or not objectives or not all(isinstance(item, str) and item.strip() for item in objectives):
            audit.add("C015", path, f"domain[{index}].objectives must be a non-empty string array")
    if abs(weight_total - 100.0) > 0.05:
        audit.add("C014", path, f"domain weights must total 100; found {weight_total:g}")
    lesson_paths: set[str] = set()
    lessons = track.get("lessons")
    if not isinstance(lessons, list) or not lessons:
        audit.add("C016", path, "lessons must be a non-empty array")
    else:
        for index, reference in enumerate(lessons):
            if not isinstance(reference, dict):
                audit.add("C016", path, f"lesson[{index}] must be an object")
                continue
            lesson_path = require_string(audit, path, reference.get("path"), f"lesson[{index}].path")
            if lesson_path:
                if lesson_path in lesson_paths:
                    audit.add("C017", path, f"duplicate lesson path {lesson_path!r}")
                lesson_paths.add(lesson_path)
                if not (ROOT / lesson_path).is_dir():
                    audit.add("C018", path, f"lesson path does not exist: {lesson_path!r}")
            reference_domains = reference.get("domains")
            if not isinstance(reference_domains, list) or not reference_domains:
                audit.add("C019", path, f"lesson[{index}].domains must be non-empty")
            else:
                unknown = set(reference_domains) - domain_ids
                if unknown:
                    audit.add("C019", path, f"lesson[{index}] references unknown domains {sorted(unknown)}")
    deep_dives = track.get("deepDives", [])
    if not isinstance(deep_dives, list):
        audit.add("C016", path, "deepDives must be an array when present")
    else:
        for index, reference in enumerate(deep_dives):
            if not isinstance(reference, dict):
                audit.add("C016", path, f"deepDive[{index}] must be an object")
                continue
            deep_path = require_string(audit, path, reference.get("path"), f"deepDive[{index}].path")
            require_string(audit, path, reference.get("label"), f"deepDive[{index}].label")
            require_string(audit, path, reference.get("reason"), f"deepDive[{index}].reason")
            if deep_path and not (ROOT / deep_path).is_dir():
                audit.add("C018", path, f"deep-dive path does not exist: {deep_path!r}")
    assessments = track.get("assessments")
    if not isinstance(assessments, list) or not assessments:
        audit.add("C040", path, "assessments must be a non-empty array")
    else:
        assessment_ids: set[str] = set()
        assessment_lesson_refs: set[str] = set()
        for index, declaration in enumerate(assessments):
            if not isinstance(declaration, dict):
                audit.add("C040", path, f"assessment[{index}] must be an object")
                continue
            assessment_id = check_id(audit, path, declaration.get("id"), f"assessment[{index}].id")
            if assessment_id:
                if assessment_id in assessment_ids:
                    audit.add("C041", path, f"duplicate assessment id {assessment_id!r}")
                assessment_ids.add(assessment_id)
            assessment_path = require_string(audit, path, declaration.get("path"), f"assessment[{index}].path")
            if assessment_path:
                resolved_assessment = ROOT / assessment_path
                check_assessment(audit, resolved_assessment, declaration, track)
                if resolved_assessment.is_file():
                    try:
                        assessment_data = json.loads(resolved_assessment.read_text(encoding="utf-8"))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        assessment_data = {}
                    for question in assessment_data.get("questions", []):
                        if not isinstance(question, dict):
                            continue
                        assessment_lesson_refs.update(
                            reference for reference in question.get("references", [])
                            if isinstance(reference, str) and reference.startswith("certifications/claude/lessons/")
                        )
        uncovered = lesson_paths - assessment_lesson_refs
        if uncovered:
            audit.add("C059", path, f"route lessons missing assessment remediation coverage: {sorted(uncovered)}")
    return track, lesson_paths


def check_prerequisite_graph(
    audit: Audit,
    program: dict[str, Any],
    tracks_by_id: dict[str, dict[str, Any]],
    actual_lessons: set[str],
) -> None:
    declared_path = program.get("prerequisitesPath")
    expected_path = PREREQUISITES_PATH.relative_to(ROOT).as_posix()
    if declared_path != expected_path:
        audit.add("C070", PROGRAM_PATH, f"prerequisitesPath must equal {expected_path!r}")
    data = load_json(audit, PREREQUISITES_PATH)
    if not isinstance(data, dict) or not isinstance(data.get("lessons"), dict):
        audit.add("C070", PREREQUISITES_PATH, "must contain a lessons dependency object")
        return
    if not isinstance(data.get("version"), int) or isinstance(data.get("version"), bool) or data.get("version") < 1:
        audit.add("C070", PREREQUISITES_PATH, "version must be a positive integer")
    graph = data["lessons"]
    graph_paths = set(graph)
    if graph_paths != actual_lessons:
        audit.add(
            "C070",
            PREREQUISITES_PATH,
            f"lesson keys must match certification directories; missing {sorted(actual_lessons - graph_paths)}, extra {sorted(graph_paths - actual_lessons)}",
        )

    clean_graph: dict[str, list[str]] = {}
    for lesson, dependencies in graph.items():
        if lesson not in actual_lessons:
            continue
        if not isinstance(dependencies, list) or not all(isinstance(item, str) and item for item in dependencies):
            audit.add("C070", PREREQUISITES_PATH, f"{lesson!r} dependencies must be a string array")
            continue
        if len(dependencies) != len(set(dependencies)):
            audit.add("C070", PREREQUISITES_PATH, f"{lesson!r} contains duplicate dependencies")
        for dependency in dependencies:
            if dependency not in actual_lessons:
                audit.add("C070", PREREQUISITES_PATH, f"{lesson!r} references unknown prerequisite {dependency!r}")
            if dependency == lesson:
                audit.add("C070", PREREQUISITES_PATH, f"{lesson!r} cannot depend on itself")
        clean_graph[lesson] = [item for item in dependencies if item in actual_lessons and item != lesson]

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(lesson: str, trail: list[str]) -> None:
        if lesson in visited:
            return
        if lesson in visiting:
            cycle_start = trail.index(lesson) if lesson in trail else 0
            cycle = trail[cycle_start:] + [lesson]
            audit.add("C071", PREREQUISITES_PATH, "dependency cycle: " + " -> ".join(cycle))
            return
        visiting.add(lesson)
        for dependency in clean_graph.get(lesson, []):
            visit(dependency, trail + [lesson])
        visiting.remove(lesson)
        visited.add(lesson)

    for lesson in sorted(clean_graph):
        visit(lesson, [])

    for track_id, track in tracks_by_id.items():
        refs = track.get("lessons", []) if isinstance(track, dict) else []
        ordered = [reference.get("path") for reference in refs if isinstance(reference, dict) and isinstance(reference.get("path"), str)]
        positions = {lesson: index for index, lesson in enumerate(ordered)}
        for lesson in ordered:
            for dependency in clean_graph.get(lesson, []):
                if dependency not in positions:
                    audit.add("C072", TRACKS_DIR / f"{track.get('slug', track_id)}.json", f"{lesson!r} requires missing lesson {dependency!r}")
                elif positions[dependency] >= positions[lesson]:
                    audit.add("C073", TRACKS_DIR / f"{track.get('slug', track_id)}.json", f"{dependency!r} must appear before {lesson!r}")


def check_ai_native_learning_surface(audit: Audit, actual_lessons: set[str]) -> None:
    required_files = (
        GETTING_STARTED_PATH,
        CERT_SKILL_PATH,
        CLAUDE_CERT_SKILL_PATH,
        CERT_SKILL_OPENAI_PATH,
        CLAUDE_CERT_SKILL_OPENAI_PATH,
        ROOT_README_PATH,
        BOOK_WORKFLOW_PATH,
        BOOK_SCRIPT_PATH,
    )
    missing = [path for path in required_files if not path.is_file()]
    for path in missing:
        audit.add("C080", path, "missing AI-native certification learning surface")
    if missing:
        return

    guide = GETTING_STARTED_PATH.read_text(encoding="utf-8")
    skill = CERT_SKILL_PATH.read_text(encoding="utf-8")
    wrapper = CLAUDE_CERT_SKILL_PATH.read_text(encoding="utf-8")
    cert_readme = CERT_README_PATH.read_text(encoding="utf-8") if CERT_README_PATH.is_file() else ""
    root_readme = ROOT_README_PATH.read_text(encoding="utf-8")
    catalog_page = PUBLIC_CERT_PAGES[0].read_text(encoding="utf-8") if PUBLIC_CERT_PAGES[0].is_file() else ""

    guide_tokens = (
        "CCAO-F",
        "CCDV-F",
        "CCAR-F",
        "CCAR-P",
        "tracks/ccao-f.json",
        "tracks/ccdv-f.json",
        "tracks/ccar-f.json",
        "tracks/ccar-p.json",
        "skills/claude-certification/SKILL.md",
        "CLAUDE-CERTIFICATION.md",
        "learning-artifacts/claude/",
        "python3 \"$LESSON/code/main.py\"",
        "python3 -m unittest discover",
        "not affiliated",
        "not included in the repository's EPUB/PDF book workflow",
    )
    for token in guide_tokens:
        if token not in guide:
            audit.add("C080", GETTING_STARTED_PATH, f"AI-native learner guide is missing {token!r}")

    skill_tokens = (
        "program.json",
        "tracks/<exam-code>.json",
        "CLAUDE-CERTIFICATION.md",
        "learning-artifacts/claude/",
        "python3 <lesson-path>/code/main.py",
        "python3 -m unittest discover",
        "Assessment mode",
        "Never invent fake API code",
        "book-generation pipeline",
    )
    for token in skill_tokens:
        if token not in skill:
            audit.add("C080", CERT_SKILL_PATH, f"certification tutor skill is missing {token!r}")

    if wrapper != skill:
        audit.add("C080", CLAUDE_CERT_SKILL_PATH, "Claude Code tutor skill must mirror the portable tutor skill exactly")
    if CLAUDE_CERT_SKILL_OPENAI_PATH.read_text(encoding="utf-8") != CERT_SKILL_OPENAI_PATH.read_text(encoding="utf-8"):
        audit.add("C080", CLAUDE_CERT_SKILL_OPENAI_PATH, "Claude Code tutor metadata must mirror the portable skill metadata")

    readme_tokens = (
        "certifications/claude/GETTING_STARTED.md",
        "skills/claude-certification/SKILL.md",
        "CLAUDE-CERTIFICATION.md",
        "intentionally not converted into the books",
    )
    for token in readme_tokens:
        if token not in root_readme:
            audit.add("C080", ROOT_README_PATH, f"root README is missing certification onboarding text {token!r}")

    for token in ("GETTING_STARTED.md", "../../skills/claude-certification/SKILL.md", "outside the EPUB/PDF book workflow"):
        if token not in cert_readme:
            audit.add("C080", CERT_README_PATH, f"certification README is missing {token!r}")
    for lesson_path in sorted(actual_lessons):
        relative = lesson_path.removeprefix("certifications/claude/") + "/"
        if relative not in cert_readme:
            audit.add("C080", CERT_README_PATH, f"GitHub lesson index is missing {relative!r}")

    if "certifications/claude/GETTING_STARTED.md" not in catalog_page:
        audit.add("C080", PUBLIC_CERT_PAGES[0], "website catalog must link to AI-native GitHub onboarding")

    workflow = BOOK_WORKFLOW_PATH.read_text(encoding="utf-8")
    book_script = BOOK_SCRIPT_PATH.read_text(encoding="utf-8")
    if "certifications/" in workflow:
        audit.add("C081", BOOK_WORKFLOW_PATH, "book workflow must not trigger on certification sources")
    if 'PHASES = ROOT / "phases"' not in book_script:
        audit.add("C081", BOOK_SCRIPT_PATH, "book builder must remain rooted in the core phases directory")
    if 'ROOT / "certifications"' in book_script or "certifications/claude" in book_script:
        audit.add("C081", BOOK_SCRIPT_PATH, "book builder must not ingest certification curriculum")


def run_audit() -> Audit:
    audit = Audit()
    program = load_json(audit, PROGRAM_PATH)
    if not isinstance(program, dict):
        return audit
    check_id(audit, PROGRAM_PATH, program.get("id"), "id")
    for field in ("name", "provider", "publisher", "lastVerified", "guideVersion", "guideEffective", "summary", "disclaimer", "scoringNotice", "sourcePolicy"):
        require_string(audit, PROGRAM_PATH, program.get(field), field)
    disclaimer = str(program.get("disclaimer", "")).lower()
    if "not affiliated" not in disclaimer or "not" not in disclaimer or "anthropic" not in disclaimer:
        audit.add("C007", PROGRAM_PATH, "disclaimer must state that the curriculum is not affiliated with Anthropic")
    for page in PUBLIC_CERT_PAGES:
        if not page.is_file() or "not affiliated" not in page.read_text(encoding="utf-8").lower():
            audit.add("C007", page, "public certification page must display the non-affiliation statement")

    declared_tracks = program.get("tracks")
    if not isinstance(declared_tracks, list) or not declared_tracks:
        audit.add("C005", PROGRAM_PATH, "tracks must be a non-empty array")
        declared_tracks = []
    track_files = sorted(TRACKS_DIR.glob("*.json")) if TRACKS_DIR.is_dir() else []
    global_ids: set[str] = set()
    found_tracks: set[str] = set()
    tracks_by_id: dict[str, dict[str, Any]] = {}
    referenced_lessons: set[str] = set()
    for track_path in track_files:
        track_data = load_json(audit, track_path)
        track, lesson_paths = check_track(audit, track_path, track_data, global_ids)
        referenced_lessons.update(lesson_paths)
        if track and isinstance(track.get("id"), str):
            found_tracks.add(track["id"])
            tracks_by_id[track["id"]] = track
    if set(declared_tracks) != found_tracks:
        audit.add("C005", PROGRAM_PATH, f"declared tracks {sorted(set(declared_tracks))} do not match files {sorted(found_tracks)}")
    readme_text = CERT_README_PATH.read_text(encoding="utf-8") if CERT_README_PATH.is_file() else ""
    readme_counts = {
        code: int(count)
        for code, count in re.findall(r"^\|\s*(CC[A-Z-]+)\s*\|.*\|\s*(\d+)\s+lessons\s*\|$", readme_text, re.MULTILINE)
    }
    for track in tracks_by_id.values():
        exam_code = track.get("examCode")
        actual_count = len(track.get("lessons", []))
        if readme_counts.get(exam_code) != actual_count:
            audit.add("C008", CERT_README_PATH, f"{exam_code} route count must be {actual_count}; found {readme_counts.get(exam_code)!r}")

    lesson_dirs = sorted(path for path in LESSONS_DIR.iterdir() if path.is_dir()) if LESSONS_DIR.is_dir() else []
    for lesson_dir in lesson_dirs:
        check_lesson(audit, lesson_dir)
    actual_lesson_paths = {path.relative_to(ROOT).as_posix() for path in lesson_dirs}
    check_prerequisite_graph(audit, program, tracks_by_id, actual_lesson_paths)
    check_ai_native_learning_surface(audit, actual_lesson_paths)
    orphaned = actual_lesson_paths - referenced_lessons
    if orphaned:
        audit.add("C018", LESSONS_DIR, f"orphan certification lessons are not referenced by any track: {sorted(orphaned)}")
    return audit


def render(audit: Audit) -> str:
    lines = [
        "audit_certifications.py - "
        f"{audit.lessons_checked} lesson(s), {audit.assessments_checked} assessment(s), "
        f"{audit.questions_checked} assessment question(s), {len(audit.findings)} issue(s)"
    ]
    if audit.findings:
        lines.append("")
        for finding in audit.findings:
            lines.append(f"  [{finding.rule}] {finding.path}: {finding.message}")
        counts = Counter(finding.rule for finding in audit.findings)
        lines.append("")
        lines.append("Summary by rule:")
        for rule in sorted(counts):
            lines.append(f"  {rule}: {counts[rule]}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args(argv)
    audit = run_audit()
    if args.json:
        payload = {
            "lessons_checked": audit.lessons_checked,
            "assessments_checked": audit.assessments_checked,
            "questions_checked": audit.questions_checked,
            "issues": [finding.to_dict() for finding in audit.findings],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(render(audit))
    return 1 if audit.findings else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
