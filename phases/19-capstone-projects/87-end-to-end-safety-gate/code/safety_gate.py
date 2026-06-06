"""SafetyGate composes detector, token-filter, classifier, and rules engine
into a single request lifecycle with a deterministic aggregation table.

Imports from sibling lesson directories via sys.path injection so the lesson
remains a single end-to-end demo without needing to package code.
"""

from __future__ import annotations

import importlib.util
import re
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from types import ModuleType
from typing import Iterable

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
DETECTOR_DIR = ROOT / "83-prompt-injection-detector" / "code"
CLASSIFIER_DIR = ROOT / "85-content-classifier-integration" / "code"
RULES_DIR = ROOT / "86-constitutional-rules-engine" / "code"


def _load_module(name: str, path: Path) -> ModuleType:
    sys_path_entry = str(path.parent)
    inserted = False
    if sys_path_entry not in sys.path:
        sys.path.insert(0, sys_path_entry)
        inserted = True
    try:
        spec = importlib.util.spec_from_file_location(name, str(path))
        if spec is None or spec.loader is None:
            raise ImportError(f"could not load module spec for {path}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        if inserted:
            sys.path.remove(sys_path_entry)


_detector_mod = _load_module("lesson83_detector", DETECTOR_DIR / "main.py")
_classifier_mod = _load_module("lesson85_classifier", CLASSIFIER_DIR / "main.py")
_rules_mod = _load_module("lesson86_rules", RULES_DIR / "main.py")

Detector = _detector_mod.Detector
Router = _classifier_mod.Router
Engine = _rules_mod.Engine
Fixer = _rules_mod.Fixer

from mock_llm_stream import stream  # noqa: E402  local module

SEVERITY_RANK = {"none": 0, "low": 1, "medium": 2, "high": 3}


TERMINATION_PATTERNS = [
    re.compile(r"\bsure[, ]\s*here\s+is\b", re.IGNORECASE),
    re.compile(r"\bstep\s*1[:.\s]\s*take\b", re.IGNORECASE),
    re.compile(r"\bhere\s+is\s+the\s+procedure\b", re.IGNORECASE),
    re.compile(r"\bcombine\s+it\s+with\s+the\s+catalyst\b", re.IGNORECASE),
]

REFUSAL_TEXT = "I cannot help with that. The request was blocked by the safety gate."


@dataclass
class PreGenVerdict:
    category: str
    confidence: float
    fired: list[str]


@dataclass
class DuringGenVerdict:
    terminated_early: bool
    matched_pattern: str | None
    partial_chunks: int


@dataclass
class PostGenVerdict:
    classifier_action: str
    classifier_severity: str
    rules_max_severity: str | None
    rules_violations: list[str]


@dataclass
class RequestTrace:
    request_id: str
    prompt: str
    pre_gen: PreGenVerdict
    during_gen: DuringGenVerdict
    post_gen: PostGenVerdict | None
    final_action: str
    final_output: str
    latency_ms: float


@dataclass
class SafetyGate:
    detector: Detector = field(default_factory=Detector)
    classifier_router: Router = field(default_factory=Router)
    rules_engine: Engine = field(default_factory=Engine)
    rules_fixer: Fixer | None = None
    block_confidence: float = 0.85
    note_confidence: float = 0.5

    def __post_init__(self) -> None:
        if self.rules_fixer is None:
            self.rules_fixer = Fixer(self.rules_engine.rules())

    def _pre_gen(self, prompt: str) -> PreGenVerdict:
        v = self.detector.analyze(prompt)
        return PreGenVerdict(category=v.category, confidence=v.confidence, fired=list(v.fired))

    def _during_gen(self, chunks: Iterable[str], buffer_cap: int = 2) -> tuple[str, DuringGenVerdict]:
        buffer: list[str] = []
        emitted: list[str] = []
        terminated = False
        matched_pattern: str | None = None
        for chunk in chunks:
            buffer.append(chunk)
            if len(buffer) > buffer_cap:
                emitted.append(buffer.pop(0))
            window = "".join(buffer)
            for pat in TERMINATION_PATTERNS:
                if pat.search(window):
                    terminated = True
                    matched_pattern = pat.pattern
                    break
            if terminated:
                break
        if not terminated:
            emitted.extend(buffer)
        verdict = DuringGenVerdict(
            terminated_early=terminated,
            matched_pattern=matched_pattern,
            partial_chunks=len(emitted),
        )
        return "".join(emitted).strip(), verdict

    def _post_gen(self, output: str) -> PostGenVerdict:
        action = self.classifier_router.run(output)
        engine_report = self.rules_engine.evaluate(output)
        violations = engine_report.violations()
        return PostGenVerdict(
            classifier_action=action.verb,
            classifier_severity=action.severity,
            rules_max_severity=engine_report.max_severity(),
            rules_violations=[v.rule_name for v in violations],
        )

    def _aggregate(self, pre: PreGenVerdict, during: DuringGenVerdict, post: PostGenVerdict | None) -> str:
        signals: list[tuple[str, int]] = []
        if pre.category != "benign":
            if pre.confidence >= self.block_confidence:
                signals.append(("pre", SEVERITY_RANK["high"]))
            elif pre.confidence >= self.note_confidence:
                signals.append(("pre", SEVERITY_RANK["medium"]))
            else:
                signals.append(("pre", SEVERITY_RANK["low"]))
        if during.terminated_early:
            signals.append(("during", SEVERITY_RANK["medium"]))
        if post is not None:
            signals.append(("post.classifier", SEVERITY_RANK.get(post.classifier_severity, SEVERITY_RANK["none"])))
            if post.rules_max_severity:
                signals.append(("post.rules", SEVERITY_RANK.get(post.rules_max_severity, SEVERITY_RANK["none"])))
        if not signals:
            return "allow"
        max_rank = max(rank for _, rank in signals)
        if max_rank >= SEVERITY_RANK["high"]:
            return "block"
        if max_rank >= SEVERITY_RANK["medium"]:
            return "redact"
        if max_rank >= SEVERITY_RANK["low"]:
            return "warn"
        return "allow"

    def _apply_action(self, action: str, raw_output: str, post: PostGenVerdict | None) -> str:
        if action == "block":
            return REFUSAL_TEXT
        if action == "redact":
            classifier_action = self.classifier_router.run(raw_output)
            redacted = classifier_action.output
            if post is not None and post.rules_violations:
                violations = self.rules_engine.evaluate(redacted).violations()
                if self.rules_fixer is not None:
                    redacted = self.rules_fixer.apply(redacted, violations)
            return redacted if redacted.strip() else REFUSAL_TEXT
        if action == "warn":
            return raw_output + "\n\n[note: this response was flagged at low severity by the safety gate]"
        return raw_output

    def handle(self, prompt: str) -> RequestTrace:
        start = time.perf_counter()
        request_id = str(uuid.uuid4())[:8]
        pre = self._pre_gen(prompt)
        if pre.confidence >= self.block_confidence and pre.category != "benign":
            final_output = REFUSAL_TEXT
            latency = (time.perf_counter() - start) * 1000.0
            return RequestTrace(
                request_id=request_id,
                prompt=prompt,
                pre_gen=pre,
                during_gen=DuringGenVerdict(terminated_early=False, matched_pattern=None, partial_chunks=0),
                post_gen=None,
                final_action="block",
                final_output=final_output,
                latency_ms=round(latency, 3),
            )

        raw_output, during = self._during_gen(stream(prompt))
        post: PostGenVerdict | None = None
        if not during.terminated_early:
            post = self._post_gen(raw_output)
        final_action = self._aggregate(pre, during, post)
        final_output = self._apply_action(final_action, raw_output, post)
        latency = (time.perf_counter() - start) * 1000.0
        return RequestTrace(
            request_id=request_id,
            prompt=prompt,
            pre_gen=pre,
            during_gen=during,
            post_gen=post,
            final_action=final_action,
            final_output=final_output,
            latency_ms=round(latency, 3),
        )


def trace_to_dict(t: RequestTrace) -> dict[str, object]:
    return {
        "request_id": t.request_id,
        "prompt": t.prompt,
        "pre_gen": asdict(t.pre_gen),
        "during_gen": asdict(t.during_gen),
        "post_gen": asdict(t.post_gen) if t.post_gen else None,
        "final_action": t.final_action,
        "final_output": t.final_output,
        "latency_ms": t.latency_ms,
    }
