#!/usr/bin/env python3
"""各レッスンのPythonコードをスモークチェックする。

デフォルトでは、`phases/**/[0-9][0-9]-*/code/` 配下のすべての `.py` を
`py_compile` でバイトコンパイルする。コードは実行しない。実行にはAPIキーや、
このカリキュラムが固定していない重いML依存が必要になるためである。構文チェック
だけでも、コントリビューターが入れがちな回帰（悪いインデント、壊れたf-string、
不用意な編集）を捕捉できる。

実際に実行する場合は `--execute` を付ける。各ファイルは10秒のタイムアウトで
走る。エントリファイルが標準ライブラリ外のimportを `# requires: pkg1, pkg2`
コメントで宣言しているレッスンは、重いレッスン（torch、anthropicなど）で実行が
破綻しないように、"needs <deps>" 理由付きでスキップする。

使い方:
    python3 scripts/lesson_run.py                      # 全カリキュラムの構文チェック
    python3 scripts/lesson_run.py --phase 14           # 1フェーズだけ
    python3 scripts/lesson_run.py --strict             # 失敗があればexit 1
    python3 scripts/lesson_run.py --json               # JSONレポートをstdoutへ
    python3 scripts/lesson_run.py --execute            # 各レッスンを実際に実行

終了コード:
    0 — 問題なし、またはnon-strict実行で失敗を報告済み
    1 — `--strict` かつ少なくとも1レッスンが失敗

stdlibのみ。Python 3.10+ 構文（PEP 604 union）を使用。
"""

from __future__ import annotations

import argparse
import json
import py_compile
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

PHASE_DIR_RE = re.compile(r"^([0-9]{2})-[a-z0-9][a-z0-9-]*$")
LESSON_DIR_RE = re.compile(r"^([0-9]{2})-[a-z0-9][a-z0-9-]*$")
REQUIRES_RE = re.compile(r"^\s*#\s*requires:\s*(.+?)\s*$")

EXECUTE_TIMEOUT_SEC = 10


@dataclass
class LessonResult:
    lesson: str
    files: list[str] = field(default_factory=list)
    status: str = "passed"  # passed | failed | skipped
    reason: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def iter_lesson_dirs(phase_filter: int | None) -> Iterable[Path]:
    if not PHASES_DIR.is_dir():
        return
    for phase in sorted(PHASES_DIR.iterdir()):
        if not phase.is_dir():
            continue
        m = PHASE_DIR_RE.match(phase.name)
        if not m:
            continue
        if phase_filter is not None and int(m.group(1)) != phase_filter:
            continue
        for lesson in sorted(phase.iterdir()):
            if lesson.is_dir() and LESSON_DIR_RE.match(lesson.name):
                yield lesson


def list_python_files(code_dir: Path) -> list[Path]:
    if not code_dir.is_dir():
        return []
    return sorted(p for p in code_dir.rglob("*.py") if p.is_file())


def pick_entry_file(py_files: list[Path]) -> Path | None:
    for path in py_files:
        if path.name.startswith("main."):
            return path
    return py_files[0] if py_files else None


def read_requires(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if not stripped.startswith("#"):
            break
        match = REQUIRES_RE.match(line)
        if match:
            deps = [d.strip() for d in match.group(1).split(",")]
            return [d for d in deps if d]
    return []


def syntax_check(py_files: list[Path]) -> tuple[bool, str]:
    for path in py_files:
        try:
            py_compile.compile(str(path), doraise=True)
        except py_compile.PyCompileError as exc:
            return False, f"{path.relative_to(ROOT).as_posix()}: {exc.msg.strip()}"
    return True, ""


def execute_lesson(entry: Path) -> tuple[bool, str]:
    try:
        proc = subprocess.run(
            [sys.executable, str(entry)],
            cwd=str(entry.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=EXECUTE_TIMEOUT_SEC,
            check=False,
            text=True,
        )
    except subprocess.TimeoutExpired:
        return False, f"timeout after {EXECUTE_TIMEOUT_SEC}s"
    except OSError as exc:
        return False, f"failed to launch interpreter: {exc}"
    if proc.returncode == 0:
        return True, ""
    stderr = (proc.stderr or "").strip()
    last_line = stderr.splitlines()[-1] if stderr else f"exit {proc.returncode}"
    return False, f"exit {proc.returncode}: {last_line}"


def check_lesson(lesson: Path, execute: bool) -> LessonResult:
    rel = lesson.relative_to(ROOT).as_posix()
    code_dir = lesson / "code"
    py_files = list_python_files(code_dir)
    result = LessonResult(
        lesson=rel,
        files=[p.relative_to(ROOT).as_posix() for p in py_files],
    )
    if not py_files:
        result.status = "skipped"
        result.reason = "pythonファイルなし"
        return result

    ok, msg = syntax_check(py_files)
    if not ok:
        result.status = "failed"
        result.reason = msg
        return result

    if execute:
        entry = pick_entry_file(py_files)
        if entry is None:
            result.status = "skipped"
            result.reason = "エントリファイルなし"
            return result
        deps = read_requires(entry)
        if deps:
            result.status = "skipped"
            result.reason = f"needs {', '.join(deps)}"
            return result
        ok, msg = execute_lesson(entry)
        if not ok:
            result.status = "failed"
            result.reason = msg

    return result


def render_report(results: list[LessonResult], execute: bool) -> str:
    passed = [r for r in results if r.status == "passed"]
    failed = [r for r in results if r.status == "failed"]
    skipped = [r for r in results if r.status == "skipped"]
    mode = "execute" if execute else "syntax"
    total_files = sum(len(r.files) for r in results)
    lines = [
        f"lesson_run.py ({mode}) — {len(results)} レッスン、"
        f"{total_files} 個のPythonファイル: "
        f"passed={len(passed)} failed={len(failed)} skipped={len(skipped)}",
    ]
    if failed:
        lines.append("")
        lines.append("失敗:")
        for r in failed:
            lines.append(f"  [FAIL] {r.lesson}: {r.reason}")
    if skipped and execute:
        lines.append("")
        lines.append("スキップ:")
        for r in skipped:
            lines.append(f"  [SKIP] {r.lesson}: {r.reason}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase", type=int, default=None, help="指定したフェーズ番号だけに限定"
    )
    parser.add_argument(
        "--json", action="store_true", help="JSONレポートをstdoutへ出力"
    )
    parser.add_argument(
        "--strict", action="store_true", help="失敗したレッスンがあればexit 1"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help=f"各レッスンのエントリファイルを{EXECUTE_TIMEOUT_SEC}秒タイムアウトで実行",
    )
    args = parser.parse_args(argv)

    results = [check_lesson(lesson, args.execute) for lesson in iter_lesson_dirs(args.phase)]
    failed = [r for r in results if r.status == "failed"]

    if args.json:
        payload = {
            "mode": "execute" if args.execute else "syntax",
            "checked": len(results),
            "passed": [r.to_dict() for r in results if r.status == "passed"],
            "failed": [r.to_dict() for r in results if r.status == "failed"],
            "skipped": [r.to_dict() for r in results if r.status == "skipped"],
        }
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(render_report(results, args.execute) + "\n")

    return 1 if (args.strict and failed) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
