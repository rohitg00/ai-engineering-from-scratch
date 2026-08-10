#!/usr/bin/env python3
"""Tests for the fail-closed Russian translation auditor."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "audit_ru_translations.py"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class AuditRuTranslationsTest(unittest.TestCase):
    def make_repo(
        self,
        source: str = "# English\n",
        target: str | None = "# Русский\n",
        *,
        source_path: str = "phases/00-phase/01-lesson/docs/en.md",
    ) -> tuple[tempfile.TemporaryDirectory[str], Path, Path]:
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        source_file = root / source_path
        source_file.parent.mkdir(parents=True)
        source_file.write_text(source, encoding="utf-8")
        target_path = Path("i18n/ru") / Path(source_path).parent / "ru.md"
        if target is not None:
            target_file = root / target_path
            target_file.parent.mkdir(parents=True)
            target_file.write_text(target, encoding="utf-8")
        manifest = root / "i18n/ru/.quality/manifest.json"
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "locale": "ru",
                    "items": [
                        {
                            "source": source_path,
                            "target": target_path.as_posix(),
                            "source_sha256": digest(source),
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        return temporary, root, source_file

    def run_audit(self, root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), "--root", str(root), *args],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def test_missing_translation_is_reported_and_fails(self) -> None:
        temporary, root, _ = self.make_repo(target=None)
        with temporary:
            result = self.run_audit(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing", result.stdout)
        self.assertIn("phases/00-phase/01-lesson/docs/en.md", result.stdout)

    def test_valid_certification_translation_is_approved(self) -> None:
        source_path = "certifications/claude/lessons/01-api/docs/en.md"
        temporary, root, _ = self.make_repo(source_path=source_path)
        with temporary:
            result = self.run_audit(root)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"approved {source_path}", result.stdout)

    def test_incomplete_manifest_fails_closed(self) -> None:
        temporary, root, _ = self.make_repo()
        with temporary:
            extra = root / "phases/00-phase/02-extra/docs/en.md"
            extra.parent.mkdir(parents=True)
            extra.write_text("# Extra\n", encoding="utf-8")
            result = self.run_audit(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("manifest incomplete", result.stderr)
        self.assertIn(extra.relative_to(root).as_posix(), result.stderr)

    def test_unknown_paths_are_rejected(self) -> None:
        temporary, root, _ = self.make_repo()
        with temporary:
            result = self.run_audit(root, "--paths", "phases/not-a-lesson/docs/en.md")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown --paths", result.stderr)

    def test_changed_source_is_stale(self) -> None:
        temporary, root, source_file = self.make_repo()
        with temporary:
            source_file.write_text("# Changed English\n", encoding="utf-8")
            result = self.run_audit(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stale phases/00-phase/01-lesson/docs/en.md", result.stdout)

    def test_target_must_be_nonempty_utf8(self) -> None:
        for payload in (b"", b"\xff"):
            with self.subTest(payload=payload):
                temporary, root, _ = self.make_repo()
                with temporary:
                    target = root / "i18n/ru/phases/00-phase/01-lesson/docs/ru.md"
                    target.write_bytes(payload)
                    result = self.run_audit(root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("structurally_invalid", result.stdout)

    def test_currency_markers_are_not_treated_as_math_delimiters(self) -> None:
        source = "# Costs\nRevenue rose from $50 to $75; one vendor uses $/M tokens and another uses $/second.\n"
        target = "# Стоимость\nВыручка выросла с $50 до $75; один поставщик считает в $/M токенов, другой — в $/second.\n"
        temporary, root, _ = self.make_repo(source=source, target=target)
        with temporary:
            result = self.run_audit(root)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("approved", result.stdout)

    def test_protected_markdown_structure_must_match(self) -> None:
        source = """# Heading
## Section
Use `token --flag` and [the API](https://example.com/api?q=1).
Raw https://example.org/docs and [the spec][spec].

[spec]: https://example.net/spec "Spec"

Math $x + y$, \\(z^2\\), and:
$$
a^2 + b^2
$$
\\[c = d\\]

```mermaid
graph LR
```
```figure
figure-one
```
```python
print("protected")
```
"""
        target = source.replace("Heading", "Заголовок").replace("Section", "Раздел")
        temporary, root, _ = self.make_repo(source=source, target=target)
        with temporary:
            baseline = self.run_audit(root)
        self.assertEqual(baseline.returncode, 0, baseline.stdout + baseline.stderr)
        self.assertIn("approved", baseline.stdout)

        mutations = {
            "fenced code tags/count/order": ("```python", "```bash"),
            "figure IDs/order": ("figure-one", "figure-two"),
            "inline code tokens": ("`token --flag`", "`другой`"),
            "URL/link targets": ("https://example.com/api?q=1", "https://bad.example/api"),
            "reference links": ("https://example.net/spec", "https://bad.example/spec"),
            "formula delimiters/protected math": ("$x + y$", "$x - y$"),
            "heading-level sequence": ("## Раздел", "### Раздел"),
        }
        for label, (old, new) in mutations.items():
            with self.subTest(label=label):
                temporary, root, _ = self.make_repo(source=source, target=target.replace(old, new))
                with temporary:
                    result = self.run_audit(root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("structurally_invalid", result.stdout)


if __name__ == "__main__":
    unittest.main()
