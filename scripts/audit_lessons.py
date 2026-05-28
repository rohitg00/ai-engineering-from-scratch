#!/usr/bin/env python3
"""すべてのレッスンディレクトリに対する不変条件チェック。

使い方:
    python scripts/audit_lessons.py [--phase N] [--json] [--strict]

終了コード:
    0 — 問題なし
    1 — issueあり
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

LESSON_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")
PHASE_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")
MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s#]+)(?:#[^)]*)?\)")
H1_RE = re.compile(r"^#\s+\S", re.MULTILINE)

CANONICAL_QUIZ_KEYS = {"stage", "question", "options", "correct", "explanation"}
LEGACY_QUIZ_KEYS = {"q", "choices", "answer"}
CODE_IGNORED_NAMES = {"README.md", "AGENTS.md", ".gitkeep", ".DS_Store"}
MIN_DOC_BYTES = 200
MAX_OPTIONS = 6
MIN_OPTIONS = 2


@dataclass
class Issue:
    rule: str
    lesson: str
    file: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "rule": self.rule,
            "lesson": self.lesson,
            "file": self.file,
            "message": self.message,
        }


@dataclass
class Audit:
    lessons_checked: int = 0
    issues: list[Issue] = field(default_factory=list)

    def add(self, rule: str, lesson: Path, file: Path | None, message: str) -> None:
        rel_lesson = lesson.relative_to(ROOT).as_posix()
        rel_file = file.relative_to(ROOT).as_posix() if file else rel_lesson
        self.issues.append(Issue(rule, rel_lesson, rel_file, message))


def iter_lesson_dirs(phase_filter: int | None) -> Iterable[Path]:
    if not PHASES_DIR.is_dir():
        return
    for phase in sorted(PHASES_DIR.iterdir()):
        if not phase.is_dir():
            continue
        if not PHASE_DIR_RE.match(phase.name):
            continue
        if phase_filter is not None:
            try:
                phase_num = int(phase.name.split("-", 1)[0])
            except ValueError:
                continue
            if phase_num != phase_filter:
                continue
        for lesson in sorted(phase.iterdir()):
            if lesson.is_dir():
                yield lesson


def check_lesson_dir_pattern(audit: Audit, lesson: Path) -> bool:
    if not LESSON_DIR_RE.match(lesson.name):
        audit.add(
            "L001",
            lesson,
            None,
            f"lesson dir名がNN-slugパターンに一致しません: {lesson.name!r}",
        )
        return False
    return True


def check_docs_en_md(audit: Audit, lesson: Path) -> str | None:
    doc = lesson / "docs" / "en.md"
    if not doc.is_file():
        audit.add("L002", lesson, doc, "docs/en.md がありません")
        return None
    try:
        text = doc.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        audit.add("L002", lesson, doc, "docs/en.md が有効なUTF-8ではありません")
        return None
    if len(text.encode("utf-8")) < MIN_DOC_BYTES:
        audit.add(
            "L003",
            lesson,
            doc,
            f"docs/en.md が {MIN_DOC_BYTES} bytes 未満です（got {len(text)}）",
        )
    if not H1_RE.search(text):
        audit.add("L004", lesson, doc, "docs/en.md にトップレベルH1がありません")
    return text


def check_code_main(audit: Audit, lesson: Path) -> None:
    code_dir = lesson / "code"
    if not code_dir.is_dir():
        return
    for path in code_dir.rglob("*"):
        if path.is_file() and path.name not in CODE_IGNORED_NAMES:
            return
    audit.add("L005", lesson, code_dir, "code/ が空です（source/config fileなし）")


def check_quiz(audit: Audit, lesson: Path) -> None:
    quiz = lesson / "quiz.json"
    if not quiz.is_file():
        return
    try:
        raw = quiz.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        audit.add("L006", lesson, quiz, f"quiz.json が有効なJSONではありません: {exc}")
        return
    if isinstance(data, list):
        questions = data
    elif isinstance(data, dict):
        questions = data.get("questions")
    else:
        questions = None
    if not isinstance(questions, list) or not questions:
        audit.add(
            "L006",
            lesson,
            quiz,
            "quiz.json は非空array、または非空 questions[] を持つdictである必要があります",
        )
        return
    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            audit.add("L006", lesson, quiz, f"question[{idx}] がobjectではありません")
            continue
        legacy = LEGACY_QUIZ_KEYS & q.keys()
        if legacy:
            audit.add(
                "L007",
                lesson,
                quiz,
                f"question[{idx}] がlegacy schema keys {sorted(legacy)} を使用しています "
                f"（canonical: {sorted(CANONICAL_QUIZ_KEYS)}）",
            )
            continue
        missing = CANONICAL_QUIZ_KEYS - q.keys()
        if missing:
            audit.add(
                "L006",
                lesson,
                quiz,
                f"question[{idx}] にkeys {sorted(missing)} がありません",
            )
            continue
        options = q.get("options")
        if not isinstance(options, list) or not (MIN_OPTIONS <= len(options) <= MAX_OPTIONS):
            audit.add(
                "L008",
                lesson,
                quiz,
                f"question[{idx}] のoptions lengthは {MIN_OPTIONS}..{MAX_OPTIONS} である必要があります "
                f"（got {len(options) if isinstance(options, list) else type(options).__name__}）",
            )
            continue
        correct = q.get("correct")
        if not isinstance(correct, int) or not (0 <= correct < len(options)):
            audit.add(
                "L009",
                lesson,
                quiz,
                f"question[{idx}] correct={correct!r} は options[0..{len(options) - 1}] の有効なindexではありません",
            )


def check_internal_links(audit: Audit, lesson: Path, text: str) -> None:
    doc = lesson / "docs" / "en.md"
    seen: set[str] = set()
    for match in MD_LINK_RE.finditer(text):
        href = match.group(1).strip()
        if href in seen:
            continue
        seen.add(href)
        if href.startswith(("http://", "https://", "mailto:", "data:")):
            continue
        if href.startswith("/"):
            target = ROOT / href.lstrip("/")
        else:
            target = (doc.parent / href).resolve()
        if not target.exists():
            audit.add("L010", lesson, doc, f"internal linkが解決できません: {href!r}")


def audit_lesson(audit: Audit, lesson: Path) -> None:
    audit.lessons_checked += 1
    if not check_lesson_dir_pattern(audit, lesson):
        return
    text = check_docs_en_md(audit, lesson)
    check_code_main(audit, lesson)
    check_quiz(audit, lesson)
    if text is not None:
        check_internal_links(audit, lesson, text)


def render_report(audit: Audit) -> str:
    by_rule: dict[str, int] = {}
    for issue in audit.issues:
        by_rule[issue.rule] = by_rule.get(issue.rule, 0) + 1
    lines = [
        f"audit_lessons.py — {audit.lessons_checked} レッスンをチェック、"
        f"{len(audit.issues)} 件のissue",
    ]
    if audit.issues:
        lines.append("")
        for issue in audit.issues:
            lines.append(f"  [{issue.rule}] {issue.file}: {issue.message}")
        lines.append("")
        lines.append("ルール別サマリー:")
        for rule in sorted(by_rule):
            lines.append(f"  {rule}: {by_rule[rule]}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", type=int, default=None, help="指定したフェーズ番号だけに限定")
    parser.add_argument("--json", action="store_true", help="JSONレポートをstdoutへ出力")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="警告をエラーとして扱う（現在はdefaultと同等、予約済み）",
    )
    args = parser.parse_args(argv)

    audit = Audit()
    for lesson in iter_lesson_dirs(args.phase):
        audit_lesson(audit, lesson)

    if args.json:
        json.dump(
            {
                "lessons_checked": audit.lessons_checked,
                "issues": [issue.to_dict() for issue in audit.issues],
            },
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
    else:
        sys.stdout.write(render_report(audit) + "\n")

    return 1 if audit.issues else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
