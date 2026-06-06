"""Hypothesis generator: temperature ramped sampling, novelty filter, ranked queue.

Conceptual references:
- ./docs/en.md (this lesson)
- Phase 19 Track A lessons 20-29 (agent harness primitives)

Stdlib only. Run: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from typing import Callable


HASH_DIM = 128
TAG_RE = re.compile(
    r"<hypothesis>\s*"
    r"<text>(?P<text>.*?)</text>\s*"
    r"<variables>(?P<variables>.*?)</variables>\s*"
    r"<metric>(?P<metric>.*?)</metric>\s*"
    r"(?:<baseline>(?P<baseline>.*?)</baseline>\s*)?"
    r"</hypothesis>",
    re.DOTALL,
)


@dataclass
class Hypothesis:
    id: int
    text: str
    variables: list[str]
    metric: str
    baseline_ref: str | None
    draft_pass: int
    temperature: float
    novelty_score: float = 0.0
    rank_score: float = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "text": self.text,
            "variables": list(self.variables),
            "metric": self.metric,
            "baseline_ref": self.baseline_ref,
            "draft_pass": self.draft_pass,
            "temperature": round(self.temperature, 3),
            "novelty_score": round(self.novelty_score, 4),
            "rank_score": round(self.rank_score, 4),
        }


class ParserError(ValueError):
    """Raised when a sampler response does not match the hypothesis tag schema."""


def _tokenise(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def hashed_embed(text: str, dim: int = HASH_DIM) -> list[float]:
    """Hashed bag of tokens embedding, L2 normalised. Deterministic stdlib only."""
    vec = [0.0] * dim
    for tok in _tokenise(text):
        h = hashlib.md5(tok.encode("utf-8")).digest()
        idx = int.from_bytes(h[:4], "big") % dim
        sign = 1.0 if (h[4] & 1) == 0 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0.0:
        return vec
    return [v / norm for v in vec]


def cosine_distance(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    dot = max(-1.0, min(1.0, dot))
    return 1.0 - dot


def parse_response(raw: str) -> dict:
    match = TAG_RE.search(raw)
    if match is None:
        raise ParserError("no hypothesis block found")
    text = match.group("text").strip()
    if not text:
        raise ParserError("empty text")
    metric = match.group("metric").strip()
    if not metric:
        raise ParserError("empty metric")
    raw_vars = match.group("variables").strip()
    variables = [v.strip() for v in raw_vars.split(",") if v.strip()]
    if not variables:
        raise ParserError("empty variables")
    baseline = match.group("baseline")
    baseline_ref = baseline.strip() if baseline and baseline.strip() else None
    return {
        "text": text,
        "variables": variables,
        "metric": metric,
        "baseline_ref": baseline_ref,
    }


def temperature_bucket(temperature: float) -> int:
    """Map a continuous temperature to a discrete bucket index."""
    if temperature < 0.35:
        return 0
    if temperature < 0.65:
        return 1
    if temperature < 0.95:
        return 2
    return 3


class MockLLM:
    """Scripted sampler keyed on (prompt_signature, temperature_bucket).

    The seed is folded into the response so identical prompts and buckets with
    different seeds yield distinct drafts. Unknown keys return an unparseable
    fallback so the parser-failure path is reachable from tests.
    """

    def __init__(self, scripts: dict[tuple[str, int], list[str]]) -> None:
        self._scripts = dict(scripts)

    @staticmethod
    def prompt_signature(prompt: str) -> str:
        return hashlib.sha1(prompt.encode("utf-8")).hexdigest()[:10]

    def sample(self, prompt: str, temperature: float, seed: int) -> str:
        key = (self.prompt_signature(prompt), temperature_bucket(temperature))
        bank = self._scripts.get(key)
        if not bank:
            return "<noise>untagged drift</noise>"
        return bank[seed % len(bank)]


@dataclass
class GeneratorConfig:
    n_passes: int = 6
    t_min: float = 0.2
    t_max: float = 1.2
    novelty_threshold: float = 0.25
    target_variable_count: int = 3
    w_novelty: float = 0.4
    w_specificity: float = 0.3
    w_testability: float = 0.3
    base_seed: int = 0

    def schedule(self) -> list[float]:
        if self.n_passes <= 0:
            return []
        if self.n_passes == 1:
            return [self.t_min]
        step = (self.t_max - self.t_min) / (self.n_passes - 1)
        return [self.t_min + i * step for i in range(self.n_passes)]


@dataclass
class GenerationLog:
    pass_index: int
    temperature: float
    seed: int
    accepted_id: int | None
    reject_reason: str | None
    raw_excerpt: str

    def to_dict(self) -> dict:
        return {
            "pass": self.pass_index,
            "temperature": round(self.temperature, 3),
            "seed": self.seed,
            "accepted_id": self.accepted_id,
            "reject_reason": self.reject_reason,
            "raw_excerpt": self.raw_excerpt[:80],
        }


class HypothesisGenerator:
    """Drives the mock LLM over a temperature schedule and ranks the survivors."""

    def __init__(
        self,
        llm: MockLLM,
        config: GeneratorConfig | None = None,
        embedder: Callable[[str], list[float]] = hashed_embed,
    ) -> None:
        self._llm = llm
        self._cfg = config or GeneratorConfig()
        self._embed = embedder

    def _specificity_score(self, h: Hypothesis) -> float:
        target = max(1, self._cfg.target_variable_count)
        return min(1.0, len(h.variables) / target)

    def _testability_score(self, h: Hypothesis) -> float:
        if h.metric and h.baseline_ref:
            return 1.0
        if h.metric:
            return 0.5
        return 0.0

    def _score(self, h: Hypothesis) -> float:
        return (
            self._cfg.w_novelty * h.novelty_score
            + self._cfg.w_specificity * self._specificity_score(h)
            + self._cfg.w_testability * self._testability_score(h)
        )

    def _novelty(self, candidate: list[float], survivors: list[list[float]]) -> float:
        if not survivors:
            return 1.0
        return min(cosine_distance(candidate, s) for s in survivors)

    def run(self, seed_prompt: str) -> tuple[list[Hypothesis], list[GenerationLog]]:
        survivors: list[Hypothesis] = []
        survivor_vecs: list[list[float]] = []
        logs: list[GenerationLog] = []
        next_id = 1
        for pass_index, temperature in enumerate(self._cfg.schedule()):
            seed = self._cfg.base_seed + pass_index
            raw = self._llm.sample(seed_prompt, temperature, seed)
            try:
                parsed = parse_response(raw)
            except ParserError as exc:
                logs.append(GenerationLog(pass_index, temperature, seed, None, f"parse:{exc}", raw))
                continue
            vec = self._embed(parsed["text"])
            novelty = self._novelty(vec, survivor_vecs)
            if novelty < self._cfg.novelty_threshold:
                logs.append(GenerationLog(pass_index, temperature, seed, None, "duplicate", raw))
                continue
            hypothesis = Hypothesis(
                id=next_id,
                text=parsed["text"],
                variables=parsed["variables"],
                metric=parsed["metric"],
                baseline_ref=parsed["baseline_ref"],
                draft_pass=pass_index,
                temperature=temperature,
                novelty_score=novelty,
            )
            hypothesis.rank_score = self._score(hypothesis)
            survivors.append(hypothesis)
            survivor_vecs.append(vec)
            logs.append(GenerationLog(pass_index, temperature, seed, next_id, None, raw))
            next_id += 1
        survivors.sort(key=lambda h: (-h.rank_score, h.id))
        return survivors, logs


def build_demo_scripts() -> dict[tuple[str, int], list[str]]:
    """Scripted responses for the demo seed prompt across temperature buckets."""
    seed_prompt = "Investigate attention sparsity in small transformers"
    sig = MockLLM.prompt_signature(seed_prompt)
    return {
        (sig, 0): [
            "<hypothesis>"
            "<text>Lowering attention head count from 8 to 4 raises validation loss by less than 2 percent on a 12M parameter model.</text>"
            "<variables>head_count, validation_loss</variables>"
            "<metric>validation_loss</metric>"
            "<baseline>head_count_8</baseline>"
            "</hypothesis>",
        ],
        (sig, 1): [
            "<hypothesis>"
            "<text>Top-k sparse attention with k equal to 16 matches dense attention on perplexity at 12M parameters.</text>"
            "<variables>k, perplexity, parameter_count</variables>"
            "<metric>perplexity</metric>"
            "<baseline>dense_attention</baseline>"
            "</hypothesis>",
        ],
        (sig, 2): [
            "<hypothesis>"
            "<text>Routing attention through a learned gate reduces flops by 30 percent without harming downstream accuracy.</text>"
            "<variables>gate_temperature, flops, accuracy</variables>"
            "<metric>downstream_accuracy</metric>"
            "<baseline>dense_attention</baseline>"
            "</hypothesis>",
        ],
        (sig, 3): [
            "<hypothesis>"
            "<text>Block sparse attention with block size 32 lowers wall clock training time by 18 percent on consumer GPUs.</text>"
            "<variables>block_size, training_seconds, hardware</variables>"
            "<metric>training_seconds</metric>"
            "<baseline>dense_attention</baseline>"
            "</hypothesis>",
        ],
    }


def _demo() -> None:
    llm = MockLLM(build_demo_scripts())
    config = GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1)
    generator = HypothesisGenerator(llm, config)
    queue, logs = generator.run("Investigate attention sparsity in small transformers")
    print(json.dumps({
        "queue_size": len(queue),
        "queue": [h.to_dict() for h in queue],
        "logs": [log.to_dict() for log in logs],
    }, indent=2))


if __name__ == "__main__":
    _demo()
