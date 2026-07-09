"""Deterministic, template-based quiz generation for lessons that have no quiz.json.

No LLM involved. Every question is built purely from metadata already in the repo
(title, phase, type, lang, summary, sibling lesson order, code/ filenames), matching
the exact schema of the hand-written quiz.json files:
  {question, options, correct, explanation, stage}

QuestionGenerator is a Protocol so a future Ollama-backed generator can be dropped in
as a second implementation without changing scripts/backfill_quizzes.py.
"""
from __future__ import annotations

import random
from typing import Protocol

from game.catalog import Lesson, Phase, build_catalog


class QuestionGenerator(Protocol):
    def generate(self, phase: Phase, lesson: Lesson) -> list[dict]:
        ...


def _shuffle_options(correct_text: str, distractors: list[str], rng: random.Random) -> tuple[list[str], int]:
    options = [correct_text] + distractors
    rng.shuffle(options)
    return options, options.index(correct_text)


class TemplateGenerator:
    """Produces 5 MCQs per lesson from structural metadata, no external calls."""

    def generate(self, phase: Phase, lesson: Lesson) -> list[dict]:
        rng = random.Random(f"{phase.dir_name}/{lesson.lesson_dir}")
        catalog = build_catalog()
        questions = [
            self._phase_placement(phase, lesson, catalog, rng),
            self._type_and_lang(lesson, rng),
            self._ordering(phase, lesson, rng),
            self._code_artifact(phase, lesson, catalog, rng),
            self._summary_match(phase, lesson, rng),
        ]
        return [q for q in questions if q is not None]

    def _phase_placement(self, phase: Phase, lesson: Lesson, catalog: list[Phase], rng: random.Random) -> dict:
        other_phases = [p.name for p in catalog if p.id != phase.id]
        distractors = rng.sample(other_phases, k=min(3, len(other_phases)))
        options, correct = _shuffle_options(phase.name, distractors, rng)
        return {
            "question": f"Which phase does the lesson '{lesson.title}' belong to?",
            "options": options,
            "correct": correct,
            "explanation": f"'{lesson.title}' is lesson {lesson.order:02d} in Phase {phase.id} — {phase.name}.",
            "stage": "pre",
        }

    def _type_and_lang(self, lesson: Lesson, rng: random.Random) -> dict:
        correct_text = f"{lesson.type} — {lesson.lang}"
        other_types = [t for t in ("Build", "Learn", "Capstone") if t != lesson.type]
        other_langs = ["Python", "TypeScript", "Rust", "Julia", "—"]
        other_langs = [l for l in other_langs if l != lesson.lang]
        distractors = []
        while len(distractors) < 3:
            t = rng.choice(other_types) if other_types else lesson.type
            l = rng.choice(other_langs) if other_langs else lesson.lang
            candidate = f"{t} — {l}"
            if candidate != correct_text and candidate not in distractors:
                distractors.append(candidate)
        options, correct = _shuffle_options(correct_text, distractors, rng)
        return {
            "question": f"What lesson type and language(s) is '{lesson.title}'?",
            "options": options,
            "correct": correct,
            "explanation": f"'{lesson.title}' is tagged as {lesson.type} in {lesson.lang}.",
            "stage": "pre",
        }

    def _ordering(self, phase: Phase, lesson: Lesson, rng: random.Random) -> dict | None:
        siblings = sorted(phase.lessons, key=lambda l: l.order)
        idx = next((i for i, l in enumerate(siblings) if l.lesson_dir == lesson.lesson_dir), None)
        if idx is None or idx + 1 >= len(siblings):
            return None
        correct_text = siblings[idx + 1].title
        distractor_pool = [l.title for i, l in enumerate(siblings) if i not in (idx, idx + 1)]
        if len(distractor_pool) < 2:
            return None
        distractors = rng.sample(distractor_pool, k=min(3, len(distractor_pool)))
        options, correct = _shuffle_options(correct_text, distractors, rng)
        return {
            "question": f"In {phase.name}, which lesson comes immediately after '{lesson.title}'?",
            "options": options,
            "correct": correct,
            "explanation": f"'{correct_text}' follows '{lesson.title}' as lesson {siblings[idx + 1].order:02d}.",
            "stage": "post",
        }

    def _code_artifact(self, phase: Phase, lesson: Lesson, catalog: list[Phase], rng: random.Random) -> dict | None:
        if not lesson.code_files:
            return None
        correct_text = lesson.code_files[0]
        other_files = [
            f
            for p in catalog
            for l in p.lessons
            for f in l.code_files
            if not (p.dir_name == phase.dir_name and l.lesson_dir == lesson.lesson_dir) and f != correct_text
        ]
        if len(other_files) < 2:
            return None
        distractors = rng.sample(other_files, k=min(3, len(other_files)))
        options, correct = _shuffle_options(correct_text, distractors, rng)
        return {
            "question": f"Which file under code/ implements the lesson '{lesson.title}'?",
            "options": options,
            "correct": correct,
            "explanation": f"'{correct_text}' is the implementation shipped with '{lesson.title}'.",
            "stage": "post",
        }

    def _summary_match(self, phase: Phase, lesson: Lesson, rng: random.Random) -> dict | None:
        if not lesson.summary:
            return None
        distractor_pool = [
            l.summary for l in phase.lessons if l.lesson_dir != lesson.lesson_dir and l.summary
        ]
        if len(distractor_pool) < 2:
            return None
        distractors = rng.sample(distractor_pool, k=min(3, len(distractor_pool)))
        options, correct = _shuffle_options(lesson.summary, distractors, rng)
        return {
            "question": f"Which one-line summary matches the lesson '{lesson.title}'?",
            "options": options,
            "correct": correct,
            "explanation": f"That line is the opening motto of '{lesson.title}'.",
            "stage": "pre",
        }
