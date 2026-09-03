#!/usr/bin/env python3
"""Regression tests for exact README translation coverage."""
import io
import json
import re
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_readme_i18n


README_TEXT = """# Welcome

First prose block.

## Next step

Second prose block.
"""


def complete_table():
    return {
        span["key"]: f"translated: {span['key']}"
        for span in build_readme_i18n.spans(README_TEXT)
    }


class ReadmeTranslationCoverageTest(unittest.TestCase):
    def test_missing_zh_key_fails(self):
        table = complete_table()
        missing_key = next(iter(table))
        del table[missing_key]

        error = build_readme_i18n.validate_complete_translations(
            README_TEXT, {"zh": table}
        )

        self.assertIn("missing 1 current span key(s)", error)
        self.assertIn(repr(missing_key), error)

    def test_stale_zh_key_fails(self):
        table = complete_table()
        table["Removed English copy."] = "已移除的文案"

        error = build_readme_i18n.validate_complete_translations(
            README_TEXT, {"zh": table}
        )

        self.assertIn("stale 1 translation key(s)", error)
        self.assertIn(repr("Removed English copy."), error)

    def test_complete_zh_table_passes(self):
        error = build_readme_i18n.validate_complete_translations(
            README_TEXT, {"zh": complete_table()}
        )

        self.assertEqual("", error)

    def test_current_exact_zh_line_is_valid_supplemental_coverage(self):
        table = complete_table()
        table["| Source | Value |"] = "| 来源 | 值 |"
        readme = README_TEXT + "\n| Source | Value |\n|---|---|\n"

        error = build_readme_i18n.validate_complete_translations(
            readme, {"zh": table}
        )

        self.assertEqual("", error)

    def test_other_languages_may_be_partial_or_stale(self):
        translations = {
            "zh": complete_table(),
            "fr": {"Welcome": "Bienvenue"},
            "de": {"Removed English copy.": "Veralteter Text"},
        }

        error = build_readme_i18n.validate_complete_translations(
            README_TEXT, translations
        )

        self.assertEqual("", error)

    def test_phase_zero_catalog_spans_do_not_require_prose_translations(self):
        readme = """# Welcome

Introductory prose.

### Phase 0: Test Phase `1 lessons`
> English phase description.
"""
        translations = {
            "zh": {
                "Welcome": "欢迎",
                "Introductory prose.": "介绍文字。",
            }
        }

        error = build_readme_i18n.validate_complete_translations(
            readme, translations
        )

        self.assertEqual("", error)

    def test_normal_build_and_check_both_fail_before_writing(self):
        incomplete = complete_table()
        del incomplete[next(iter(incomplete))]
        translations_module = types.ModuleType("readme_translations")
        translations_module.TRANSLATIONS = {"zh": incomplete}
        translations_module.README_NOTE = {}

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            readme = root / "README.md"
            readme.write_text(README_TEXT, encoding="utf-8")
            out_root = root / "i18n"
            for argv in ([], ["--check"]):
                with self.subTest(argv=argv), patch.object(
                    build_readme_i18n, "README", readme
                ), patch.object(
                    build_readme_i18n, "OUT_ROOT", out_root
                ), patch.dict(
                    sys.modules, {"readme_translations": translations_module}
                ), patch("sys.stderr", new_callable=io.StringIO) as stderr:
                    self.assertEqual(1, build_readme_i18n.main(argv))
                    self.assertIn("refusing to fall back to English", stderr.getvalue())
                self.assertFalse(out_root.exists())

    def test_zh_catalog_must_cover_every_lesson_and_phase(self):
        phases = {
            "00-test-phase": {"title": "测试阶段", "description": "说明。"}
        }
        lessons = {"phases/00-test-phase/01-first/": "第一课"}
        readme = """### Phase 0: Test Phase `2 lessons`
> Description.

| # | Lesson | Type | Lang |
|---|---|---|---|
| 01 | [First](phases/00-test-phase/01-first/) | Learn | Python |
| 02 | [Second](phases/00-test-phase/02-second/) | Build | Python |
"""
        with tempfile.TemporaryDirectory() as tmp, patch.object(
            build_readme_i18n, "ROOT", Path(tmp)
        ):
            docs = Path(tmp) / "phases/00-test-phase/01-first/docs/en.md"
            docs.parent.mkdir(parents=True)
            docs.write_text("# First\n", encoding="utf-8")
            errors = build_readme_i18n.validate_zh_assets(
                readme, phases, lessons, {"lineTranslations": {}, "allowedEnglishLines": []}
            )

        self.assertTrue(any("missing 1 zh lesson title" in error for error in errors))

    def test_catalog_render_translates_labels_but_preserves_target(self):
        line = "| 01 | [First Lesson](phases/00-test-phase/01-first/) | Build | Python |"

        rendered = build_readme_i18n.render_zh_catalog_line(
            line,
            {},
            {"phases/00-test-phase/01-first/": "第一课"},
        )

        self.assertEqual(
            "| 01 | [第一课](phases/00-test-phase/01-first/) | 实践 | Python |",
            rendered,
        )

    def test_phase_zero_catalog_content_drives_complete_render(self):
        readme = """### Phase 0: Test Phase `1 lessons`
> English phase description.

| # | Lesson | Type | Lang |
|:---:|--------|:----:|------|
| 01 | [First Lesson](phases/00-test-phase/01-first/) | Build | Python |
"""
        translations = {
            "zh": {
                "Phase 0: Test Phase `1 lessons`": "不应使用的固定阶段标题",
                "English phase description.": "不应使用的固定阶段说明。",
            }
        }
        phases = {
            "00-test-phase": {
                "title": "目录阶段标题",
                "description": "目录阶段说明。",
            }
        }
        lessons = {
            "phases/00-test-phase/01-first/": "目录课程标题",
        }

        rendered = build_readme_i18n.render_complete_zh(
            readme, translations, phases, lessons, {"lineTranslations": {}}
        )

        self.assertIn("### 第 0 阶段：目录阶段标题 `1 节课`", rendered)
        self.assertIn("> 目录阶段说明。", rendered)
        self.assertIn(
            "| 01 | [目录课程标题](phases/00-test-phase/01-first/) | 实践 | Python |",
            rendered,
        )
        self.assertNotIn("不应使用的固定", rendered)

    def test_structural_line_translation_skips_fenced_code(self):
        source = "<kbd>Build It / Use It</kbd>"
        translated = "<kbd>动手构建 / 实际使用</kbd>"
        readme = f"""```text
{source}
```
{source}
"""

        rendered = build_readme_i18n.render_complete_zh(
            readme,
            {"zh": {}},
            {},
            {},
            {"lineTranslations": {source: translated}},
        )

        self.assertEqual(
            f"""```text
{source}
```
{translated}
""",
            rendered,
        )

    def test_repository_zh_assets_cover_all_523_catalog_rows(self):
        text = build_readme_i18n.README.read_text(encoding="utf-8")
        phases, lessons, structural = build_readme_i18n.load_zh_assets()

        self.assertEqual(20, len(phases))
        self.assertEqual(523, len(lessons))
        self.assertEqual(
            [], build_readme_i18n.validate_zh_assets(
                text, phases, lessons, structural
            )
        )
        rendered = build_readme_i18n.render_complete_zh(
            text, {"zh": {}}, phases, lessons, structural
        )
        self.assertEqual(523, len(re.findall(r"^\|\s*\d+\s*\|\s*\[", rendered, re.M)))

    def test_repository_zh_structural_inventory_has_no_unclassified_lines(self):
        text = build_readme_i18n.README.read_text(encoding="utf-8")
        _, _, structural = build_readme_i18n.load_zh_assets()
        candidates = build_readme_i18n.zh_structural_candidates(text)
        translated = set(structural["lineTranslations"])
        allowed = set(structural["allowedEnglishLines"])

        self.assertEqual(set(), candidates - translated - allowed)
        self.assertEqual(set(), translated & allowed)

    def test_zh_start_table_has_dedicated_exact_translations(self):
        text = build_readme_i18n.README.read_text(encoding="utf-8")
        _, _, structural = build_readme_i18n.load_zh_assets()
        from readme_translations import TRANSLATIONS

        lines = text.splitlines()
        start = lines.index("| Your goal | Learn on GitHub | Learn on the website |")
        table_lines = []
        for line in lines[start:]:
            if not line.startswith("|"):
                break
            if line != "|---|---|---|":
                table_lines.append(line)

        self.assertEqual(10, len(table_lines))
        for source in table_lines:
            with self.subTest(source=source):
                self.assertIn(source, TRANSLATIONS["zh"])
                self.assertEqual(
                    structural["lineTranslations"][source],
                    TRANSLATIONS["zh"][source],
                )

    def test_zh_structural_translations_preserve_link_and_code_targets(self):
        _, _, structural = build_readme_i18n.load_zh_assets()
        token_pattern = re.compile(
            r"(?:href|src)=\"[^\"]+\"|\[[^]]*\]\(([^)]+)\)|`[^`]+`"
        )

        for source, translated in structural["lineTranslations"].items():
            with self.subTest(source=source):
                def targets(line):
                    values = []
                    for match in token_pattern.finditer(line):
                        token = match.group(0)
                        if token.startswith("["):
                            values.append(match.group(1))
                        elif token.startswith("`"):
                            values.append(token)
                        else:
                            values.append(token)
                    return values

                self.assertEqual(targets(source), targets(translated))

    def test_generated_zh_readme_is_current_and_fully_classified(self):
        text = build_readme_i18n.README.read_text(encoding="utf-8")
        phases, lessons, structural = build_readme_i18n.load_zh_assets()
        from readme_translations import README_NOTE, TRANSLATIONS

        body = build_readme_i18n.render_complete_zh(
            text, TRANSLATIONS, phases, lessons, structural
        )
        expected = README_NOTE["zh"] + "\n" + build_readme_i18n.localize_links(body)
        actual = (
            build_readme_i18n.OUT_ROOT / "zh" / "README.md"
        ).read_text(encoding="utf-8")

        self.assertEqual(expected, actual)
        for source in structural["lineTranslations"]:
            with self.subTest(source=source):
                self.assertNotIn(build_readme_i18n.localize_links(source), actual)


if __name__ == "__main__":
    unittest.main()
