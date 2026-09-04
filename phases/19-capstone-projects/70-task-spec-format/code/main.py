"""Task spec format: JSONL schema, validator, post-process, fixture loader.

Conceptual references:
- ./docs/en.md (this lesson)
- Phase 19 Track B foundations

Stdlib only. Run: python3 code/main.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Iterable

REQUIRED_FIELDS = ("task_id", "category", "prompt", "targets", "metric_name", "post_process")
OPTIONAL_FIELDS = ("few_shot_examples", "metadata")
ALLOWED_FIELDS = set(REQUIRED_FIELDS) | set(OPTIONAL_FIELDS)

CATEGORIES = ("arithmetic", "mcq", "code_exec", "classification", "summary")
METRICS = ("exact_match", "f1", "bleu_4", "rouge_l", "accuracy", "code_exec")
POST_PROCESS = (
    "none",
    "strip_whitespace",
    "lower",
    "extract_letter",
    "extract_code_block",
    "extract_first_line",
)

LEGAL_CATEGORY_METRIC = {
    "arithmetic": {"exact_match", "f1"},
    "mcq": {"exact_match", "accuracy"},
    "code_exec": {"code_exec"},
    "classification": {"exact_match", "accuracy", "f1"},
    "summary": {"exact_match", "f1", "bleu_4", "rouge_l"},
}

FEW_SHOT_MAX = 8
TASK_ID_RE = re.compile(r"^[A-Za-z0-9_\-]+$")
MCQ_TARGET_RE = re.compile(r"^[A-E]$")


@dataclass
class ValidationError:
    line_number: int
    task_id: str
    rule: str
    field_name: str
    detail: str

    def to_dict(self) -> dict:
        return {
            "line_number": self.line_number,
            "task_id": self.task_id,
            "rule": self.rule,
            "field": self.field_name,
            "detail": self.detail,
        }


@dataclass
class TaskSpec:
    task_id: str
    category: str
    prompt: str
    targets: list[str]
    metric_name: str
    post_process: str
    few_shot_examples: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "category": self.category,
            "prompt": self.prompt,
            "targets": list(self.targets),
            "metric_name": self.metric_name,
            "post_process": self.post_process,
            "few_shot_examples": list(self.few_shot_examples),
            "metadata": dict(self.metadata),
        }


def _check_required(record: dict) -> tuple[str, str] | None:
    for f in REQUIRED_FIELDS:
        if f not in record:
            return ("missing_required", f)
    return None


def _check_unknown_fields(record: dict) -> tuple[str, str] | None:
    for k in record.keys():
        if k not in ALLOWED_FIELDS:
            return ("unknown_field", k)
    return None


def _check_types(record: dict) -> tuple[str, str, str] | None:
    if not isinstance(record["task_id"], str):
        return ("bad_type", "task_id", "must be string")
    if not TASK_ID_RE.match(record["task_id"]):
        return ("bad_value", "task_id", "must match [A-Za-z0-9_-]+")
    if record["category"] not in CATEGORIES:
        return ("bad_value", "category", f"must be one of {sorted(CATEGORIES)}")
    if not isinstance(record["prompt"], str) or not record["prompt"]:
        return ("bad_type", "prompt", "must be non-empty string")
    if record["prompt"] != record["prompt"].rstrip():
        return ("bad_value", "prompt", "trailing whitespace not allowed")
    if not isinstance(record["targets"], list) or not record["targets"]:
        return ("bad_type", "targets", "must be non-empty list")
    for t in record["targets"]:
        if not isinstance(t, str):
            return ("bad_type", "targets", "all elements must be strings")
    if record["metric_name"] not in METRICS:
        return ("bad_value", "metric_name", f"must be one of {sorted(METRICS)}")
    if record["post_process"] not in POST_PROCESS:
        return ("bad_value", "post_process", f"must be one of {sorted(POST_PROCESS)}")
    if "few_shot_examples" in record:
        if not isinstance(record["few_shot_examples"], list):
            return ("bad_type", "few_shot_examples", "must be list")
        if len(record["few_shot_examples"]) > FEW_SHOT_MAX:
            return ("bad_value", "few_shot_examples", f"max {FEW_SHOT_MAX} entries")
        for ex in record["few_shot_examples"]:
            if not isinstance(ex, dict):
                return ("bad_type", "few_shot_examples", "entries must be objects")
            if "prompt" not in ex or "completion" not in ex:
                return ("bad_type", "few_shot_examples", "needs prompt and completion")
            if not isinstance(ex["prompt"], str) or not isinstance(ex["completion"], str):
                return ("bad_type", "few_shot_examples", "prompt/completion must be strings")
    if "metadata" in record and not isinstance(record["metadata"], dict):
        return ("bad_type", "metadata", "must be object")
    return None


def _check_category_metric(record: dict) -> tuple[str, str, str] | None:
    cat = record["category"]
    metric = record["metric_name"]
    if metric not in LEGAL_CATEGORY_METRIC[cat]:
        return (
            "illegal_pair",
            "metric_name",
            f"{metric} not allowed for category {cat}",
        )
    if cat == "mcq":
        if len(record["targets"]) != 1:
            return ("bad_value", "targets", "mcq needs exactly one target")
        if not MCQ_TARGET_RE.match(record["targets"][0]):
            return ("bad_value", "targets", "mcq target must be a letter A-E")
    return None


def _embedded_few_shot(prompt: str) -> bool:
    lowered = prompt.lower()
    markers = ("question:", "q:", "example:")
    hits = sum(lowered.count(m) for m in markers)
    return hits > 1


def validate_task(record: dict, line_number: int = 0) -> list[ValidationError]:
    errors: list[ValidationError] = []
    tid = record.get("task_id", "?") if isinstance(record, dict) else "?"
    if not isinstance(record, dict):
        errors.append(ValidationError(line_number, "?", "bad_type", "_root", "not an object"))
        return errors
    missing = _check_required(record)
    if missing:
        errors.append(ValidationError(line_number, str(tid), missing[0], missing[1], "required field"))
        return errors
    unknown = _check_unknown_fields(record)
    if unknown:
        errors.append(ValidationError(line_number, str(tid), unknown[0], unknown[1], "not in allowed fields"))
        return errors
    typ = _check_types(record)
    if typ:
        errors.append(ValidationError(line_number, str(tid), typ[0], typ[1], typ[2]))
        return errors
    pair = _check_category_metric(record)
    if pair:
        errors.append(ValidationError(line_number, str(tid), pair[0], pair[1], pair[2]))
        return errors
    if _embedded_few_shot(record["prompt"]) and not record.get("few_shot_examples"):
        errors.append(ValidationError(line_number, str(tid), "embedded_few_shot", "prompt",
                                       "few-shot in prompt body without few_shot_examples list"))
    return errors


def validate_file(path: str) -> tuple[list[TaskSpec], list[ValidationError]]:
    validated: list[TaskSpec] = []
    errors: list[ValidationError] = []
    seen_ids: set[str] = set()
    with open(path, "r", encoding="utf-8") as fp:
        for i, raw in enumerate(fp, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(ValidationError(i, "?", "bad_json", "_line", str(exc)))
                continue
            line_errors = validate_task(record, line_number=i)
            if line_errors:
                errors.extend(line_errors)
                continue
            tid = record["task_id"]
            if tid in seen_ids:
                errors.append(ValidationError(i, tid, "duplicate_task_id", "task_id", "already seen"))
                continue
            seen_ids.add(tid)
            validated.append(TaskSpec(
                task_id=tid,
                category=record["category"],
                prompt=record["prompt"],
                targets=list(record["targets"]),
                metric_name=record["metric_name"],
                post_process=record["post_process"],
                few_shot_examples=list(record.get("few_shot_examples", [])),
                metadata=dict(record.get("metadata", {})),
            ))
    return validated, errors


def render_prompt(task: TaskSpec) -> str:
    parts: list[str] = []
    for ex in task.few_shot_examples:
        parts.append(f"{ex['prompt']} {ex['completion']}")
    parts.append(task.prompt)
    return "\n\n".join(parts)


CODE_BLOCK_RE = re.compile(r"```(?:[a-zA-Z0-9_]*)\n(.*?)```", re.DOTALL)
LETTER_RE = re.compile(r"(?:^|[^A-Za-z])([A-E])(?:[^A-Za-z]|$)")
LETTER_FALLBACK_RE = re.compile(r"[A-E]")


def post_process(text: str, rule: str) -> str:
    if rule == "none":
        return text
    if rule == "strip_whitespace":
        return text.strip()
    if rule == "lower":
        return text.lower()
    if rule == "extract_letter":
        m = LETTER_RE.search(text)
        if m:
            return m.group(1)
        m2 = LETTER_FALLBACK_RE.search(text)
        return m2.group(0) if m2 else ""
    if rule == "extract_code_block":
        m = CODE_BLOCK_RE.search(text)
        return m.group(1) if m else text
    if rule == "extract_first_line":
        for line in text.splitlines():
            if line.strip():
                return line.strip()
        return ""
    raise ValueError(f"unknown post_process rule: {rule}")


def fixture_tasks() -> list[dict]:
    return [
        {
            "task_id": "arith_001",
            "category": "arithmetic",
            "prompt": "Compute the result.\nQuestion: 17 + 24\nAnswer:",
            "targets": ["41"],
            "metric_name": "exact_match",
            "post_process": "strip_whitespace",
            "few_shot_examples": [{"prompt": "Question: 2 + 2\nAnswer:", "completion": "4"}],
            "metadata": {"difficulty": "easy"},
        },
        {
            "task_id": "arith_002",
            "category": "arithmetic",
            "prompt": "Compute the result.\nQuestion: 144 / 12\nAnswer:",
            "targets": ["12"],
            "metric_name": "exact_match",
            "post_process": "strip_whitespace",
            "metadata": {"difficulty": "easy"},
        },
        {
            "task_id": "mcq_001",
            "category": "mcq",
            "prompt": "Which planet is closest to the sun?\nA) Earth\nB) Mercury\nC) Venus\nD) Mars\nAnswer:",
            "targets": ["B"],
            "metric_name": "exact_match",
            "post_process": "extract_letter",
            "metadata": {"topic": "astronomy"},
        },
        {
            "task_id": "mcq_002",
            "category": "mcq",
            "prompt": "Which of these is a prime number?\nA) 4\nB) 6\nC) 7\nD) 9\nAnswer:",
            "targets": ["C"],
            "metric_name": "exact_match",
            "post_process": "extract_letter",
            "metadata": {"topic": "math"},
        },
        {
            "task_id": "code_001",
            "category": "code_exec",
            "prompt": "Write a Python function `add(a, b)` that returns the sum.\nReturn only a single fenced code block.",
            "targets": ["add(1, 2) == 3", "add(-5, 5) == 0", "add(100, 1) == 101"],
            "metric_name": "code_exec",
            "post_process": "extract_code_block",
            "metadata": {"language": "python"},
        },
        {
            "task_id": "code_002",
            "category": "code_exec",
            "prompt": "Write a Python function `is_even(n)` that returns True iff n is even.\nReturn only a single fenced code block.",
            "targets": ["is_even(2) == True", "is_even(3) == False", "is_even(0) == True"],
            "metric_name": "code_exec",
            "post_process": "extract_code_block",
            "metadata": {"language": "python"},
        },
        {
            "task_id": "cls_001",
            "category": "classification",
            "prompt": "Classify the sentiment as positive or negative.\nText: I loved the film, it was wonderful.\nLabel:",
            "targets": ["positive"],
            "metric_name": "exact_match",
            "post_process": "lower",
            "metadata": {"task": "sentiment"},
        },
        {
            "task_id": "cls_002",
            "category": "classification",
            "prompt": "Classify the sentiment as positive or negative.\nText: I hated every minute, it was a waste.\nLabel:",
            "targets": ["negative"],
            "metric_name": "exact_match",
            "post_process": "lower",
            "metadata": {"task": "sentiment"},
        },
        {
            "task_id": "sum_001",
            "category": "summary",
            "prompt": "Summarise in one sentence.\nText: The cat sat on the mat and watched the rain fall.\nSummary:",
            "targets": ["A cat watched the rain from the mat."],
            "metric_name": "rouge_l",
            "post_process": "extract_first_line",
            "metadata": {"length": "short"},
        },
        {
            "task_id": "sum_002",
            "category": "summary",
            "prompt": "Summarise in one sentence.\nText: The runner crossed the finish line first and raised both arms in triumph.\nSummary:",
            "targets": ["The runner won the race with arms raised."],
            "metric_name": "bleu_4",
            "post_process": "extract_first_line",
            "metadata": {"length": "short"},
        },
    ]


def bad_fixture_tasks() -> list[dict]:
    return [
        {"category": "arithmetic", "prompt": "x", "targets": ["1"], "metric_name": "exact_match", "post_process": "none"},
        {"task_id": "bad space", "category": "arithmetic", "prompt": "x", "targets": ["1"], "metric_name": "exact_match", "post_process": "none"},
        {"task_id": "wrong_cat", "category": "logic", "prompt": "x", "targets": ["1"], "metric_name": "exact_match", "post_process": "none"},
        {"task_id": "bad_pair", "category": "mcq", "prompt": "x", "targets": ["A"], "metric_name": "bleu_4", "post_process": "extract_letter"},
        {"task_id": "no_target", "category": "arithmetic", "prompt": "x", "targets": [], "metric_name": "exact_match", "post_process": "none"},
        {"task_id": "trail_ws", "category": "arithmetic", "prompt": "x   ", "targets": ["1"], "metric_name": "exact_match", "post_process": "none"},
        {"task_id": "extra_field", "category": "arithmetic", "prompt": "x", "targets": ["1"], "metric_name": "exact_match", "post_process": "none", "rogue": True},
        {"task_id": "bad_metric", "category": "arithmetic", "prompt": "x", "targets": ["1"], "metric_name": "perplexity", "post_process": "none"},
        {"task_id": "mcq_multi", "category": "mcq", "prompt": "x", "targets": ["A", "B"], "metric_name": "exact_match", "post_process": "extract_letter"},
        {"task_id": "bad_pp", "category": "arithmetic", "prompt": "x", "targets": ["1"], "metric_name": "exact_match", "post_process": "fancy"},
    ]


def write_jsonl(path: str, records: Iterable[dict]) -> None:
    with open(path, "w", encoding="utf-8") as fp:
        for r in records:
            fp.write(json.dumps(r))
            fp.write("\n")


def load_fixtures(out_dir: str) -> tuple[str, str]:
    good = os.path.join(out_dir, "tasks.jsonl")
    bad = os.path.join(out_dir, "tasks_bad.jsonl")
    write_jsonl(good, fixture_tasks())
    write_jsonl(bad, bad_fixture_tasks())
    return good, bad


def demo() -> int:
    import tempfile
    out_dir = tempfile.mkdtemp(prefix="aie_l70_")
    good, bad = load_fixtures(out_dir)
    ok_tasks, ok_errors = validate_file(good)
    print(f"good fixture: validated={len(ok_tasks)} errors={len(ok_errors)}")
    bad_tasks, bad_errors = validate_file(bad)
    print(f"bad fixture: validated={len(bad_tasks)} errors={len(bad_errors)}")
    for err in bad_errors[:5]:
        print(f"  {err.to_dict()}")
    if ok_tasks:
        sample = ok_tasks[0]
        rendered = render_prompt(sample)
        pp = post_process("  4  \n", "strip_whitespace")
        print(f"sample render len={len(rendered)} pp={pp!r}")
    if ok_errors:
        return 1
    if len(bad_errors) != len(bad_fixture_tasks()):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(demo())
