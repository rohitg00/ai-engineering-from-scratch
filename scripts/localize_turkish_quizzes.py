#!/usr/bin/env python3
"""Localize curriculum quiz copy while preserving quiz schemas and code tokens."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSLATABLE_KEYS = {"title", "question", "q", "options", "choices", "explanation", "explain"}
TURKISH_HINT = re.compile(
    r"[çğıöşüÇĞİÖŞÜ]|(?i:\b(?:nedir|nasıl|hangi|neden|doğru|yanlış|aşağıdaki|"
    r"için|ile|olan|olarak|değildir|verildiğinde)\b)",
)
ENGLISH_HINT = re.compile(
    r"\b(?:what|which|how|why|when|where|given|choose|explain|does|is|are|"
    r"the|this|that|from|with|into|inside|between|following|correct|purpose|"
    r"one|because|they|their|it|its|has|have|can|cannot|only|for)\b",
    re.IGNORECASE,
)
PROTECTED = re.compile(
    r"`[^`]+`|https?://\S+|\b[A-Z][A-Z0-9_-]{1,}\b|"
    r"\b[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)|\{\{[^}]+\}\}"
)


def needs_translation(text: str) -> bool:
    """Return true for prose that is substantially more English than Turkish."""
    if not text.strip():
        return False
    if not re.search(r"\s", text.strip()):
        return False
    return bool(ENGLISH_HINT.search(text)) and not bool(TURKISH_HINT.search(text))


def protect(text: str) -> tuple[str, list[str]]:
    kept: list[str] = []

    def replace(match: re.Match[str]) -> str:
        kept.append(match.group(0))
        return f"ZXQKORU{len(kept) - 1}QXZ"

    return PROTECTED.sub(replace, text), kept


def restore(text: str, kept: list[str]) -> str:
    for index, value in enumerate(kept):
        text = re.sub(
            rf"ZXQKORU\s*{index}\s*QXZ",
            lambda _match, value=value: value,
            text,
            flags=re.IGNORECASE,
        )
    return text


def translate(text: str) -> str:
    prepared, kept = protect(text)
    query = urllib.parse.urlencode(
        {"client": "gtx", "sl": "en", "tl": "tr", "dt": "t", "q": prepared}
    )
    request = urllib.request.Request(
        f"https://translate.googleapis.com/translate_a/single?{query}",
        headers={"User-Agent": "curriculum-localizer/1.0"},
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            translated = "".join(part[0] for part in payload[0] if part[0])
            return restore(translated, kept)
        except Exception:
            if attempt == 5:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def localize_value(value: object, key: str | None = None) -> tuple[object, int]:
    changed = 0
    if isinstance(value, dict):
        result = {}
        for child_key, child in value.items():
            result[child_key], count = localize_value(child, child_key)
            changed += count
        return result, changed
    if isinstance(value, list):
        result = []
        for child in value:
            localized, count = localize_value(child, key)
            result.append(localized)
            changed += count
        return result, changed
    if isinstance(value, str) and key in TRANSLATABLE_KEYS and needs_translation(value):
        return translate(value), 1
    return value, 0


def localize_quiz(quiz: Path, root: Path) -> tuple[Path, int]:
    """Localize one quiz; separate files make this safe to run concurrently."""
    source = json.loads(quiz.read_text(encoding="utf-8"))
    localized, count = localize_value(source)
    if count:
        quiz.write_text(
            json.dumps(localized, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return quiz.relative_to(root), count


def localize(root: Path, workers: int = 12) -> tuple[int, int]:
    files_changed = strings_changed = 0
    quizzes = sorted(root.glob("phases/*/*/quiz.json"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(localize_quiz, quiz, root) for quiz in quizzes]
        for future in concurrent.futures.as_completed(futures):
            relative, count = future.result()
            if not count:
                continue
            files_changed += 1
            strings_changed += count
            print(f"{relative}: {count}", flush=True)
    return files_changed, strings_changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()
    files, strings = localize(args.root.resolve(), args.workers)
    print(f"{files} quiz dosyasında {strings} metin yerelleştirildi.")


if __name__ == "__main__":
    main()
