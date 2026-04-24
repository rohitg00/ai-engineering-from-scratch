"""Personal AI tutor — Bayesian knowledge tracing + Socratic policy scaffold.

The hard architectural primitive is the learner model: per-concept mastery
probability updated by Bayesian knowledge tracing after each interaction,
feeding into a curriculum-graph walk that chooses the next concept. This
scaffold implements BKT, a curriculum DAG, a Socratic policy decision, and
a simulated two-learner study.

Run:  python main.py
"""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Bayesian knowledge tracing  --  classic four-parameter model
# ---------------------------------------------------------------------------

@dataclass
class BKTParams:
    p_init: float = 0.2     # prior knowledge
    p_learn: float = 0.12   # learning rate per practice
    p_slip: float = 0.10    # correct despite not knowing
    p_guess: float = 0.15   # correct by guessing despite not knowing


def bkt_update(mastery: float, correct: bool, p: BKTParams) -> float:
    if correct:
        num = mastery * (1 - p.p_slip)
        denom = num + (1 - mastery) * p.p_guess
    else:
        num = mastery * p.p_slip
        denom = num + (1 - mastery) * (1 - p.p_guess)
    posterior = num / max(denom, 1e-6)
    # transition: learn from this interaction
    return posterior + (1 - posterior) * p.p_learn


# ---------------------------------------------------------------------------
# curriculum graph  --  DAG of concepts with prerequisite edges
# ---------------------------------------------------------------------------

@dataclass
class Concept:
    name: str
    prereqs: list[str] = field(default_factory=list)


ALGEBRA = [
    Concept("number_line", []),
    Concept("addition_subtraction", ["number_line"]),
    Concept("multiplication_division", ["addition_subtraction"]),
    Concept("negative_numbers", ["addition_subtraction"]),
    Concept("equality", ["addition_subtraction"]),
    Concept("isolating_variable_one_step", ["equality", "addition_subtraction"]),
    Concept("isolating_variable_two_step", ["isolating_variable_one_step", "multiplication_division"]),
    Concept("distributive_property", ["multiplication_division"]),
    Concept("combining_like_terms", ["addition_subtraction", "distributive_property"]),
    Concept("linear_equations", ["isolating_variable_two_step", "combining_like_terms"]),
    Concept("quadratic_basics", ["linear_equations", "multiplication_division"]),
]


def curriculum_map(concepts: list[Concept]) -> dict[str, Concept]:
    return {c.name: c for c in concepts}


# ---------------------------------------------------------------------------
# learner state  --  per-concept mastery plus history
# ---------------------------------------------------------------------------

@dataclass
class LearnerState:
    learner_id: str
    mastery: dict[str, float] = field(default_factory=lambda: defaultdict(lambda: 0.2))
    history: list[tuple[str, bool]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# concept selector  --  pick next concept with (a) prereqs met and (b) low mastery
# ---------------------------------------------------------------------------

def next_concept(state: LearnerState, cmap: dict[str, Concept],
                 master_threshold: float = 0.85) -> str | None:
    for c in cmap.values():
        if state.mastery[c.name] >= master_threshold:
            continue
        if all(state.mastery[pr] >= master_threshold for pr in c.prereqs):
            return c.name
    return None


# ---------------------------------------------------------------------------
# Socratic policy  --  decides scaffold vs next-step vs celebration
# ---------------------------------------------------------------------------

def socratic_policy(state: LearnerState, concept: str, correct: bool) -> str:
    m = state.mastery[concept]
    if correct and m > 0.8:
        return "celebrate_and_advance"
    if correct:
        return "reinforce_and_next_question"
    if m > 0.5:
        return "hint"
    return "scaffold_from_prereq"


# ---------------------------------------------------------------------------
# learner simulator  --  random-walk with difficulty sensitive to mastery
# ---------------------------------------------------------------------------

def simulate_answer(learner_knowledge: float, concept_difficulty: float,
                    rng: random.Random) -> bool:
    """Simulate whether the learner answers correctly."""
    # probability of correct = sigmoid(knowledge - difficulty)
    import math
    p = 1 / (1 + math.exp(-(learner_knowledge - concept_difficulty)))
    return rng.random() < p


# ---------------------------------------------------------------------------
# adaptive and baseline cohorts  --  compare learning gain over N interactions
# ---------------------------------------------------------------------------

def run_adaptive(learner_id: str, inherent_ability: float,
                 cmap: dict[str, Concept], n_turns: int, rng: random.Random) -> LearnerState:
    state = LearnerState(learner_id=learner_id)
    p = BKTParams()
    # last action taken by the tutor, threaded into the next turn so
    # scaffold/hint actually reduce difficulty and celebration nudges mastery
    last_action: str | None = None
    for _ in range(n_turns):
        concept = next_concept(state, cmap)
        if concept is None:
            break
        difficulty = 0.3 + 0.1 * len(cmap[concept].prereqs)
        # apply the previous turn's action to *this* turn
        if last_action == "scaffold_from_prereq":
            difficulty -= 0.15    # easier retry from prereqs
        elif last_action == "hint":
            difficulty -= 0.08    # mild nudge
        elif last_action == "celebrate_and_advance":
            # celebration buoys confidence for one turn
            state.mastery[concept] = min(1.0, state.mastery[concept] + 0.02)
        # effective knowledge = inherent + mastery
        ek = inherent_ability + state.mastery[concept] * 1.5
        correct = simulate_answer(ek, difficulty, rng)
        last_action = socratic_policy(state, concept, correct)
        state.history.append((concept, correct))
        state.mastery[concept] = bkt_update(state.mastery[concept], correct, p)
    return state


def run_baseline(learner_id: str, inherent_ability: float,
                 cmap: dict[str, Concept], n_turns: int, rng: random.Random) -> LearnerState:
    """Non-adaptive: pick concepts round-robin, no BKT."""
    state = LearnerState(learner_id=learner_id)
    p = BKTParams()
    order = list(cmap.keys())
    for i in range(n_turns):
        concept = order[i % len(order)]
        difficulty = 0.3 + 0.1 * len(cmap[concept].prereqs)
        ek = inherent_ability + state.mastery[concept] * 1.5
        correct = simulate_answer(ek, difficulty, rng)
        state.history.append((concept, correct))
        state.mastery[concept] = bkt_update(state.mastery[concept], correct, p)
    return state


def mastery_sum(state: LearnerState, cmap: dict[str, Concept]) -> float:
    return sum(state.mastery[c] for c in cmap)


def main() -> None:
    cmap = curriculum_map(ALGEBRA)
    rng = random.Random(29)

    print("=== 2-week efficacy study (simulated) ===")
    print(f"curriculum: {len(cmap)} concepts")

    adaptive_gains: list[float] = []
    baseline_gains: list[float] = []
    n_learners = 10
    n_turns = 60

    for i in range(n_learners):
        ability = rng.gauss(0.3, 0.4)
        # paired randomness: both arms consume the same latent RNG stream so
        # the delta measures the policy difference, not seed noise
        seed = 100 + i
        r_adapt = random.Random(seed)
        r_base = random.Random()
        r_base.setstate(r_adapt.getstate())
        s1 = run_adaptive(f"adapt_{i}", ability, cmap, n_turns, r_adapt)
        s2 = run_baseline(f"base_{i}", ability, cmap, n_turns, r_base)
        adaptive_gains.append(mastery_sum(s1, cmap))
        baseline_gains.append(mastery_sum(s2, cmap))

    def mean(xs): return sum(xs) / len(xs)
    print(f"adaptive mastery sum  mean={mean(adaptive_gains):.2f}")
    print(f"baseline mastery sum  mean={mean(baseline_gains):.2f}")
    delta = mean(adaptive_gains) - mean(baseline_gains)
    print(f"delta (adaptive - baseline): {delta:+.2f} mastery points over {n_turns} turns")

    print("\n=== sample trajectory (adaptive learner 0) ===")
    state = run_adaptive("demo", 0.3, cmap, 20, random.Random(7))
    seen_concepts = []
    for c, ok in state.history:
        if c not in [x[0] for x in seen_concepts]:
            seen_concepts.append((c, state.mastery[c]))
    for c, m in seen_concepts[:8]:
        print(f"  {c:34s} mastery={m:.2f}")


if __name__ == "__main__":
    main()
