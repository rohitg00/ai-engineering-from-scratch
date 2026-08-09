#!/usr/bin/env python3
"""Ensure every certification assessment item links to lesson remediation.

The script preserves existing references, adds an internal lesson path when an
item has only external sources, then distributes uncovered route lessons across
questions in matching blueprint domains. It is deterministic and idempotent.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TRACKS = ROOT / "certifications" / "claude" / "tracks"
LESSON_PREFIX = "certifications/claude/lessons/"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def lesson_candidates(track: dict) -> dict[str, list[str]]:
    by_domain: dict[str, list[str]] = {}
    for lesson in track.get("lessons", []):
        path = lesson.get("path")
        if not isinstance(path, str):
            continue
        for domain in lesson.get("domains", []):
            by_domain.setdefault(domain, []).append(path)
    for domain, paths in by_domain.items():
        paths.sort(key=lambda path: (
            path.endswith("certification-strategy"),
            "capstone" in path,
            path,
        ))
    return by_domain


def assessment_paths(track: dict) -> list[Path]:
    paths = []
    for declaration in track.get("assessments", []):
        relative = declaration.get("path")
        if isinstance(relative, str):
            paths.append(ROOT / relative)
    return paths


def internal_references(question: dict) -> list[str]:
    return [
        reference for reference in question.get("references", [])
        if isinstance(reference, str) and reference.startswith(LESSON_PREFIX)
    ]


def update_track(track_path: Path, *, write: bool) -> tuple[int, int]:
    track = load(track_path)
    candidates = lesson_candidates(track)
    documents = [(path, load(path)) for path in assessment_paths(track)]
    added = 0

    for _, assessment in documents:
        for question in assessment.get("questions", []):
            if internal_references(question):
                continue
            domain_paths = candidates.get(question.get("domain"), [])
            if not domain_paths:
                continue
            question.setdefault("references", []).append(domain_paths[0])
            added += 1

    covered = {
        reference
        for _, assessment in documents
        for question in assessment.get("questions", [])
        for reference in internal_references(question)
    }
    route_lessons = [
        lesson.get("path") for lesson in track.get("lessons", [])
        if isinstance(lesson.get("path"), str)
    ]
    for lesson_path in route_lessons:
        if lesson_path in covered:
            continue
        lesson = next(item for item in track["lessons"] if item.get("path") == lesson_path)
        target = None
        for domain in lesson.get("domains", []):
            for _, assessment in documents:
                target = next(
                    (question for question in assessment.get("questions", []) if question.get("domain") == domain),
                    None,
                )
                if target:
                    break
            if target:
                break
        if target is None:
            continue
        target.setdefault("references", []).append(lesson_path)
        covered.add(lesson_path)
        added += 1

    changed_files = 0
    for path, assessment in documents:
        before = path.read_text(encoding="utf-8")
        after = json.dumps(assessment, indent=2, ensure_ascii=False) + "\n"
        if before != after:
            if write:
                path.write_text(after, encoding="utf-8")
            changed_files += 1
    return added, changed_files


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if remediation references need regeneration")
    args = parser.parse_args()
    total_added = 0
    total_files = 0
    for track_path in sorted(TRACKS.glob("*.json")):
        added, changed = update_track(track_path, write=not args.check)
        total_added += added
        total_files += changed
    verb = "need" if args.check else "added"
    print(f"{verb} {total_added} remediation reference(s) across {total_files} assessment file(s)")
    return 1 if args.check and total_files else 0


if __name__ == "__main__":
    raise SystemExit(main())
