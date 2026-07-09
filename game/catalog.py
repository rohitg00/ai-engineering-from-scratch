"""Builds an in-memory catalog of phases and lessons by walking the phases/ tree.

Reads structured metadata directly out of each lesson's docs/en.md (title, summary,
type, languages) rather than depending on README.md's table formatting or the
Node-built site/data.js, so this stays correct even if those drift.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = REPO_ROOT / "phases"

_TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
_SUMMARY_RE = re.compile(r"^>\s+(.+?)\s*$", re.MULTILINE)
_TYPE_RE = re.compile(r"^\*\*Type:\*\*\s*(.+?)\s*$", re.MULTILINE)
_LANG_RE = re.compile(r"^\*\*Languages?:\*\*\s*(.+?)\s*$", re.MULTILINE)


@dataclass
class Lesson:
    phase_dir: str
    lesson_dir: str
    order: int
    title: str
    summary: str
    type: str
    lang: str
    has_quiz: bool
    code_files: list[str] = field(default_factory=list)

    @property
    def path(self) -> str:
        return f"{self.phase_dir}/{self.lesson_dir}"

    @property
    def quiz_path(self) -> Path:
        return PHASES_DIR / self.phase_dir / self.lesson_dir / "quiz.json"


@dataclass
class Phase:
    id: int
    dir_name: str
    name: str
    lessons: list[Lesson] = field(default_factory=list)


def _prettify(dir_name: str) -> str:
    # "03-deep-learning-core" -> "Deep Learning Core"
    slug = re.sub(r"^\d+-", "", dir_name)
    words = slug.split("-")
    small = {"a", "an", "and", "of", "to", "in", "for", "the", "vs"}
    out = []
    for i, w in enumerate(words):
        out.append(w if (w in small and i != 0) else w.capitalize())
    return " ".join(out)


def _parse_lesson_doc(doc_path: Path) -> dict:
    text = doc_path.read_text(encoding="utf-8", errors="ignore")
    title_m = _TITLE_RE.search(text)
    summary_m = _SUMMARY_RE.search(text)
    type_m = _TYPE_RE.search(text)
    lang_m = _LANG_RE.search(text)
    return {
        "title": title_m.group(1).strip() if title_m else "",
        "summary": summary_m.group(1).strip() if summary_m else "",
        "type": type_m.group(1).strip() if type_m else "Learn",
        "lang": lang_m.group(1).strip() if lang_m else "—",
    }


@lru_cache(maxsize=1)
def build_catalog() -> list[Phase]:
    phases: list[Phase] = []
    for phase_path in sorted(PHASES_DIR.iterdir()):
        if not phase_path.is_dir():
            continue
        m = re.match(r"^(\d+)-", phase_path.name)
        if not m:
            continue
        phase_id = int(m.group(1))
        phase = Phase(id=phase_id, dir_name=phase_path.name, name=_prettify(phase_path.name))

        for lesson_path in sorted(phase_path.iterdir()):
            if not lesson_path.is_dir():
                continue
            lm = re.match(r"^(\d+)-", lesson_path.name)
            if not lm:
                continue
            doc_path = lesson_path / "docs" / "en.md"
            if not doc_path.exists():
                continue
            meta = _parse_lesson_doc(doc_path)
            code_dir = lesson_path / "code"
            code_files = sorted(p.name for p in code_dir.iterdir()) if code_dir.exists() else []
            quiz_path = lesson_path / "quiz.json"
            phase.lessons.append(
                Lesson(
                    phase_dir=phase_path.name,
                    lesson_dir=lesson_path.name,
                    order=int(lm.group(1)),
                    title=meta["title"] or lesson_path.name,
                    summary=meta["summary"],
                    type=meta["type"],
                    lang=meta["lang"],
                    has_quiz=quiz_path.exists(),
                    code_files=code_files,
                )
            )
        if phase.lessons:
            phases.append(phase)
    return phases


def get_phase(phase_dir: str) -> Phase | None:
    return next((p for p in build_catalog() if p.dir_name == phase_dir), None)


def get_lesson(phase_dir: str, lesson_dir: str) -> Lesson | None:
    phase = get_phase(phase_dir)
    if not phase:
        return None
    return next((l for l in phase.lessons if l.lesson_dir == lesson_dir), None)


def all_lessons() -> list[Lesson]:
    return [l for p in build_catalog() for l in p.lessons]
