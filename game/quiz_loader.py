"""Loads quiz.json for a lesson. Every lesson has one after scripts/backfill_quizzes.py
has been run, so this needs no runtime generation fallback."""
from __future__ import annotations

import json

from game.catalog import Lesson


def load_quiz(lesson: Lesson) -> list[dict]:
    if not lesson.quiz_path.exists():
        return []
    data = json.loads(lesson.quiz_path.read_text(encoding="utf-8"))
    # The curriculum's hand-written quiz.json files use two schemas: a bare list of
    # questions, or a {"questions": [...]} wrapper. Normalize to a bare list.
    if isinstance(data, dict):
        return data.get("questions", [])
    return data
