#!/usr/bin/env python3
"""カリキュラム全体の機械可読catalogを構築する。

Python 3.10+ が必要（PEP 604 union types、Path.is_relative_to）。

ディスク上のすべての `phases/NN-slug/MM-slug/` レッスンディレクトリを走査し、
repoに実在する内容（phases、lessons、code files、outputs
（skills / prompts / agents）、totals）を単一のJSON文書として出力する。

使い方:
    python3 scripts/build_catalog.py                     # repo rootにcatalog.jsonを書く
    python3 scripts/build_catalog.py --out path/to/catalog.json
    python3 scripts/build_catalog.py --stdout            # stdoutへ書き、repoは変更しない

出力形状（schema_version 1）:
    {
      "schema_version": 1,
      "totals": {"phases": ..., "lessons": ..., "skills": ..., "prompts": ..., "agents": ..., "code_files": ...},
      "phases": [
        {
          "num": 0,
          "slug": "00-setup-and-tooling",
          "title": "Setup and Tooling",
          "lesson_count": 12,
          "lessons": [
            {
              "num": 1,
              "slug": "01-...",
              "title": "...",                  # docs/en.md のH1
              "path": "phases/00-.../01-...",
              "has_docs": true,
              "has_code": true,
              "has_quiz": false,
              "has_notebook": false,
              "code_files": ["main.py", ...],
              "outputs": [
                {"type": "skill", "name": "...", "path": "...", "version": "1.0.0", "description": "...", "tags": [...]}
              ]
            }
          ]
        }
      ]
    }

stdlibのみ。依存なし。install_skills.py と同様のfrontmatter解析ロジックを再利用する。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import parse_frontmatter as _parse_frontmatter  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

PHASE_DIR_RE = re.compile(r"^([0-9]{2})-([a-z0-9][a-z0-9-]*)$")
LESSON_DIR_RE = re.compile(r"^([0-9]{2})-([a-z0-9][a-z0-9-]*)$")
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
ARTIFACT_TYPES = ("skill", "prompt", "agent")
CODE_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".mjs", ".rs", ".jl", ".go", ".swift", ".ipynb"}


def slug_to_title(slug: str) -> str:
    words = slug.split("-")
    fixups = {
        "ai": "AI",
        "ml": "ML",
        "llm": "LLM",
        "llms": "LLMs",
        "nlp": "NLP",
        "rl": "RL",
        "mcp": "MCP",
        "rag": "RAG",
        "api": "API",
        "rlhf": "RLHF",
        "dpo": "DPO",
        "lora": "LoRA",
        "cnn": "CNN",
        "rnn": "RNN",
        "rnns": "RNNs",
        "cnns": "CNNs",
        "gpt": "GPT",
        "tfidf": "TF-IDF",
        "pos": "POS",
        "ner": "NER",
        "asr": "ASR",
        "tts": "TTS",
        "ios": "iOS",
        "lats": "LATS",
        "rewoo": "ReWoo",
        "htn": "HTN",
        "sft": "SFT",
    }
    return " ".join(fixups.get(w, w.capitalize()) for w in words)


def parse_frontmatter(text: str) -> dict[str, object]:
    return _parse_frontmatter(text) or {}


def read_h1(doc_path: Path) -> str | None:
    try:
        text = doc_path.read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError):
        return None
    match = H1_RE.search(text)
    return match.group(1).strip() if match else None


def list_code_files(code_dir: Path) -> list[str]:
    if not code_dir.is_dir():
        return []
    files = []
    for path in sorted(code_dir.rglob("*")):
        if path.is_file() and path.suffix in CODE_SUFFIXES:
            files.append(path.relative_to(code_dir).as_posix())
    return files


def parse_artifact(path: Path) -> dict[str, object] | None:
    stem = path.stem
    artifact_type: str | None = None
    for t in ARTIFACT_TYPES:
        if stem.startswith(f"{t}-"):
            artifact_type = t
            break
    if artifact_type is None:
        return None
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None
    meta = parse_frontmatter(text)
    name = str(meta.get("name", "")).strip() or stem
    tags = meta.get("tags", [])
    if not isinstance(tags, list):
        tags = []
    return {
        "type": artifact_type,
        "name": name,
        "path": path.relative_to(ROOT).as_posix(),
        "version": str(meta.get("version", "")).strip(),
        "description": str(meta.get("description", "")).strip(),
        "tags": list(tags),
    }


def list_outputs(outputs_dir: Path) -> list[dict[str, object]]:
    if not outputs_dir.is_dir():
        return []
    artifacts: list[dict[str, object]] = []
    for path in sorted(outputs_dir.iterdir()):
        if path.suffix != ".md" or not path.is_file():
            continue
        record = parse_artifact(path)
        if record is not None:
            artifacts.append(record)
    return artifacts


def build_lesson_entry(lesson_dir: Path) -> dict[str, object] | None:
    match = LESSON_DIR_RE.match(lesson_dir.name)
    if not match:
        return None
    num = int(match.group(1))
    slug = match.group(2)
    docs_path = lesson_dir / "docs" / "en.md"
    code_dir = lesson_dir / "code"
    outputs_dir = lesson_dir / "outputs"
    notebook_dir = lesson_dir / "notebook"
    quiz_path = lesson_dir / "quiz.json"
    code_files = list_code_files(code_dir)
    outputs = list_outputs(outputs_dir)
    has_docs = docs_path.is_file()
    if not has_docs and not code_files and not outputs and not quiz_path.is_file():
        return None
    title = read_h1(docs_path) or slug_to_title(slug)
    return {
        "num": num,
        "slug": lesson_dir.name,
        "title": title,
        "path": lesson_dir.relative_to(ROOT).as_posix(),
        "has_docs": has_docs,
        "has_code": code_dir.is_dir(),
        "has_quiz": quiz_path.is_file(),
        "has_notebook": notebook_dir.is_dir(),
        "code_files": code_files,
        "outputs": outputs,
    }


def iter_phase_dirs() -> Iterable[Path]:
    if not PHASES_DIR.is_dir():
        return
    for path in sorted(PHASES_DIR.iterdir()):
        if path.is_dir() and PHASE_DIR_RE.match(path.name):
            yield path


def build_phase_entry(phase_dir: Path) -> dict[str, object]:
    match = PHASE_DIR_RE.match(phase_dir.name)
    assert match is not None
    num = int(match.group(1))
    slug = match.group(2)
    lessons: list[dict[str, object]] = []
    for lesson_dir in sorted(phase_dir.iterdir()):
        if lesson_dir.is_dir():
            entry = build_lesson_entry(lesson_dir)
            if entry is not None:
                lessons.append(entry)
    return {
        "num": num,
        "slug": phase_dir.name,
        "title": slug_to_title(slug),
        "lesson_count": len(lessons),
        "lessons": lessons,
    }


def compute_totals(phases: list[dict[str, object]]) -> dict[str, int]:
    totals = {
        "phases": len(phases),
        "lessons": 0,
        "skills": 0,
        "prompts": 0,
        "agents": 0,
        "code_files": 0,
    }
    for phase in phases:
        for lesson in phase["lessons"]:
            totals["lessons"] += 1
            totals["code_files"] += len(lesson["code_files"])
            for artifact in lesson["outputs"]:
                key = f"{artifact['type']}s"
                totals[key] = totals.get(key, 0) + 1
    return totals


def build_catalog() -> dict[str, object]:
    phases = [build_phase_entry(p) for p in iter_phase_dirs()]
    catalog = {
        "schema_version": 1,
        "totals": compute_totals(phases),
        "phases": phases,
    }
    return catalog


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "catalog.json",
        help="出力パス（default: <repo>/catalog.json）",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="ファイルではなくJSONをstdoutへ書く",
    )
    args = parser.parse_args(argv)

    catalog = build_catalog()
    payload = json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"

    if args.stdout:
        sys.stdout.write(payload)
        return 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(payload, encoding="utf-8")
    totals = catalog["totals"]
    sys.stdout.write(
        f"catalog: {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out}\n"
    )
    sys.stdout.write(
        f"  phases={totals['phases']} lessons={totals['lessons']} "
        f"skills={totals['skills']} prompts={totals['prompts']} "
        f"agents={totals['agents']} code_files={totals['code_files']}\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
