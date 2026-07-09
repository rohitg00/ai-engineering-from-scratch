"""Stdlib sqlite3 persistence for quiz attempts, per-lesson progress, and player stats."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "game.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    lesson_path TEXT NOT NULL,
    phase_id INTEGER NOT NULL,
    question_index INTEGER NOT NULL,
    selected INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson_path TEXT PRIMARY KEY,
    phase_id INTEGER NOT NULL,
    best_score INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    attempts_count INTEGER NOT NULL DEFAULT 0,
    last_played TEXT,
    mastered INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0
);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR IGNORE INTO player_stats (id, current_streak, best_streak, total_score) VALUES (1, 0, 0, 0)")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_answer(session_id: str, lesson_path: str, phase_id: int, question_index: int, selected: int, is_correct: bool) -> dict:
    """Persists one answered question, updates the live streak/score, returns the score delta."""
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO attempts (session_id, lesson_path, phase_id, question_index, selected, is_correct, ts) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, lesson_path, phase_id, question_index, selected, int(is_correct), now()),
        )
        stats = conn.execute("SELECT * FROM player_stats WHERE id = 1").fetchone()
        if is_correct:
            new_streak = stats["current_streak"] + 1
            points = 10 + (2 * max(0, new_streak - 3))
        else:
            new_streak = 0
            points = 0
        best_streak = max(stats["best_streak"], new_streak)
        total_score = stats["total_score"] + points
        conn.execute(
            "UPDATE player_stats SET current_streak = ?, best_streak = ?, total_score = ? WHERE id = 1",
            (new_streak, best_streak, total_score),
        )
        return {"points": points, "current_streak": new_streak, "best_streak": best_streak, "total_score": total_score}


def finish_lesson(session_id: str, lesson_path: str, phase_id: int, score: int, total_questions: int) -> None:
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM lesson_progress WHERE lesson_path = ?", (lesson_path,)).fetchone()
        if existing:
            best_score = max(existing["best_score"], score)
            attempts_count = existing["attempts_count"] + 1
        else:
            best_score = score
            attempts_count = 1
        mastered = 1 if best_score == total_questions else 0
        conn.execute(
            "INSERT INTO lesson_progress (lesson_path, phase_id, best_score, total_questions, attempts_count, last_played, mastered) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(lesson_path) DO UPDATE SET best_score=excluded.best_score, total_questions=excluded.total_questions, "
            "attempts_count=excluded.attempts_count, last_played=excluded.last_played, mastered=excluded.mastered",
            (lesson_path, phase_id, best_score, total_questions, attempts_count, now(), mastered),
        )


def get_player_stats() -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM player_stats WHERE id = 1").fetchone()
        return dict(row) if row else {"current_streak": 0, "best_streak": 0, "total_score": 0}


def get_all_progress() -> dict[str, dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM lesson_progress").fetchall()
        return {r["lesson_path"]: dict(r) for r in rows}


def get_lesson_progress(lesson_path: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM lesson_progress WHERE lesson_path = ?", (lesson_path,)).fetchone()
        return dict(row) if row else None


def reset_all() -> None:
    """Wipes all attempts, lesson progress, and player stats. Irreversible."""
    with get_conn() as conn:
        conn.execute("DELETE FROM attempts")
        conn.execute("DELETE FROM lesson_progress")
        conn.execute("DELETE FROM player_stats")
        conn.execute("INSERT INTO player_stats (id, current_streak, best_streak, total_score) VALUES (1, 0, 0, 0)")
