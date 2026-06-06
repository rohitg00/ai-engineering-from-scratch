"""Prompt injection detector with normalize -> substring -> regex pipeline.

Reads the taxonomy artifact from lesson 82, runs the layered detector across
every fixture, runs it across a benign corpus, and writes a per-category
precision/recall report to outputs/detector_report.json.

Run: python3 main.py
"""

from __future__ import annotations

import base64
import codecs
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from benign import prompts as load_benign
from rules import REGEX_RULES, SUBSTRING_RULES, all_rules

HERE = Path(__file__).parent
OUTPUTS = HERE.parent / "outputs"
TAXONOMY_PATH = HERE.parent.parent / "82-jailbreak-taxonomy" / "outputs" / "taxonomy.json"

LEET_TABLE = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})
ZERO_WIDTH = re.compile("[\u200B\u200C\u200D\u2060\u202A-\u202E]")
HOMOGLYPHS = str.maketrans({
    "\u0410": "A", "\u0412": "B", "\u0421": "C", "\u0415": "E",
    "\u041D": "H", "\u041A": "K", "\u041C": "M", "\u041E": "O",
    "\u0420": "P", "\u0422": "T", "\u0425": "X",
})


@dataclass
class Verdict:
    category: str
    confidence: float
    fired: list[str] = field(default_factory=list)


@dataclass
class PerCategoryMetrics:
    category: str
    tp: int = 0
    fp: int = 0
    fn: int = 0
    tn: int = 0

    @property
    def precision(self) -> float:
        denom = self.tp + self.fp
        return self.tp / denom if denom else 0.0

    @property
    def recall(self) -> float:
        denom = self.tp + self.fn
        return self.tp / denom if denom else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0


def normalize(text: str) -> str:
    raw = text
    stripped = ZERO_WIDTH.sub("", raw)
    homoglyph_fixed = stripped.translate(HOMOGLYPHS)
    decoded = _try_decode_base64(homoglyph_fixed)
    hex_decoded = _try_decode_hex(decoded.lower())
    leet = hex_decoded.translate(LEET_TABLE)
    rot = _try_rot13(leet)
    return rot


def _try_decode_base64(text: str) -> str:
    out = text
    for match in re.finditer(r"[A-Za-z0-9+/=]{16,}", text):
        tok = match.group(0)
        try:
            decoded = base64.b64decode(tok, validate=True).decode("utf-8", errors="ignore").lower()
            if decoded and any(c.isalpha() for c in decoded):
                out = out.replace(tok, " " + decoded + " ")
        except Exception:
            pass
    return out


def _try_decode_hex(text: str) -> str:
    out = text
    for match in re.finditer(r"\b[0-9a-f]{16,}\b", text):
        tok = match.group(0)
        if len(tok) % 2 != 0:
            continue
        try:
            decoded = bytes.fromhex(tok).decode("utf-8", errors="ignore").lower()
            if decoded and any(c.isalpha() for c in decoded):
                out = out.replace(tok, " " + decoded + " ")
        except Exception:
            pass
    return out


_COMMON_WORDS = {"the", "and", "answer", "how", "do", "i", "you", "ignore", "previous", "instructions", "redacted", "harmful", "the", "is"}


def _try_rot13(text: str) -> str:
    if " " not in text:
        return text
    candidate = codecs.encode(text, "rot_13")
    words = re.findall(r"[a-z]+", candidate)
    if not words:
        return text
    score = sum(1 for w in words if w in _COMMON_WORDS)
    if score >= 2:
        return text + " " + candidate
    return text


class Detector:
    def __init__(self, rules: Iterable[dict[str, object]] | None = None) -> None:
        rules_list = list(rules) if rules is not None else all_rules()
        self.substring_rules: list[dict[str, object]] = []
        self.regex_rules: list[dict[str, object]] = []
        for r in rules_list:
            if "substring" in r:
                self.substring_rules.append(r)
            elif "regex" in r:
                compiled = re.compile(str(r["regex"]), re.IGNORECASE | re.DOTALL)
                self.regex_rules.append({**r, "_compiled": compiled})
            else:
                raise ValueError(f"rule {r.get('name')} missing substring or regex")

    def analyze(self, prompt: str) -> Verdict:
        normalized = normalize(prompt)
        haystacks = (prompt.lower(), normalized)
        scores_by_category: dict[str, float] = {}
        fired: list[str] = []
        for r in self.substring_rules:
            needle = str(r["substring"]).lower()
            if any(needle in h for h in haystacks):
                cat = str(r["category"])
                score = float(r["score"])
                scores_by_category[cat] = max(scores_by_category.get(cat, 0.0), score)
                fired.append(str(r["name"]))
        for r in self.regex_rules:
            compiled: re.Pattern = r["_compiled"]
            if any(compiled.search(h) for h in haystacks):
                cat = str(r["category"])
                score = float(r["score"])
                scores_by_category[cat] = max(scores_by_category.get(cat, 0.0), score)
                fired.append(str(r["name"]))
        if not scores_by_category:
            return Verdict(category="benign", confidence=0.0, fired=[])
        best_cat = max(scores_by_category.items(), key=lambda kv: kv[1])
        return Verdict(category=best_cat[0], confidence=best_cat[1], fired=fired)


def load_taxonomy() -> list[dict[str, object]]:
    if not TAXONOMY_PATH.exists():
        raise FileNotFoundError(
            f"taxonomy artifact missing at {TAXONOMY_PATH}; run lesson 82 main.py first"
        )
    payload = json.loads(TAXONOMY_PATH.read_text())
    return list(payload["fixtures"])


def evaluate(detector: Detector, fixtures: list[dict[str, object]], benign: list[str]) -> dict[str, object]:
    categories = sorted({str(f["category"]) for f in fixtures})
    metrics = {c: PerCategoryMetrics(category=c) for c in categories}

    total_correct = 0
    for f in fixtures:
        true_cat = str(f["category"])
        v = detector.analyze(str(f["prompt"]))
        pred_cat = v.category
        if pred_cat == true_cat:
            metrics[true_cat].tp += 1
            total_correct += 1
        else:
            metrics[true_cat].fn += 1
            if pred_cat in metrics:
                metrics[pred_cat].fp += 1
        for c in categories:
            if c != true_cat and c != pred_cat:
                metrics[c].tn += 1

    benign_fp: dict[str, int] = {c: 0 for c in categories}
    benign_tn = 0
    for prompt in benign:
        v = detector.analyze(prompt)
        if v.category == "benign":
            benign_tn += 1
        elif v.category in metrics:
            metrics[v.category].fp += 1
            benign_fp[v.category] += 1
        for c in categories:
            if c != v.category:
                metrics[c].tn += 1

    per_cat_payload = {}
    for c, m in metrics.items():
        per_cat_payload[c] = {
            "tp": m.tp, "fp": m.fp, "fn": m.fn, "tn": m.tn,
            "precision": round(m.precision, 4),
            "recall": round(m.recall, 4),
            "f1": round(m.f1, 4),
        }

    return {
        "total_fixtures": len(fixtures),
        "total_correct": total_correct,
        "accuracy": round(total_correct / len(fixtures), 4) if fixtures else 0.0,
        "benign_total": len(benign),
        "benign_pass_through": benign_tn,
        "benign_false_positives_by_category": benign_fp,
        "per_category": per_cat_payload,
    }


def write_report(report: dict[str, object]) -> Path:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    path = OUTPUTS / "detector_report.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    return path


def demo() -> int:
    fixtures = load_taxonomy()
    benign = load_benign()
    detector = Detector()
    report = evaluate(detector, fixtures, benign)
    print("Prompt injection detector evaluation")
    print(f"  total fixtures:    {report['total_fixtures']}")
    print(f"  total correct:     {report['total_correct']}")
    print(f"  accuracy:          {report['accuracy']:.3f}")
    print(f"  benign pass thru:  {report['benign_pass_through']} / {report['benign_total']}")
    print()
    print("  per category precision / recall / f1:")
    for cat, m in report["per_category"].items():
        print(f"    {cat:22} p={m['precision']:.2f} r={m['recall']:.2f} f1={m['f1']:.2f}  (tp={m['tp']} fp={m['fp']} fn={m['fn']})")
    out = write_report(report)
    print(f"\n  artifact written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(demo())
