#!/usr/bin/env python3
"""Regression checks for the README localization structure audit."""

import re
from contextlib import redirect_stdout, redirect_stderr
from io import StringIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import build_readme_i18n

from audit_readme_locales import (
    BOLD_COUNT, FACT, HTML_ALT, ISO_DATE, ROOT, SOURCE, body, check, check_document,
    fenced_blocks, landing_facts, language_codes, outside_fences, sync_stats_facts,
    numeric_amounts, source_fingerprint, source_review_errors, untranslated_fragments,
)


class ReadmeLocaleAuditTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SOURCE.read_text(encoding="utf-8")
        cls.chinese_document = (ROOT / "i18n" / "zh" / "README.md").read_text(encoding="utf-8")
        cls.chinese = body(cls.chinese_document)

    def assert_reports(self, changed, expected):
        errors = check(self.source, changed, "zh")
        self.assertTrue(any(expected in item for item in errors), errors)

    def test_current_chinese_structure(self):
        self.assertEqual(check(self.source, self.chinese, "zh"), [])
        self.assertEqual(check_document(self.source, self.chinese_document, "zh"), [])

    def test_fence_closes_only_with_matching_character_and_length(self):
        text = "before\n````text\n```\n~~~\n```` trailing\n````\nafter"
        self.assertEqual(outside_fences(text), "before\nafter")
        self.assertEqual(fenced_blocks(text), ["````text\n```\n~~~\n```` trailing\n````"])

    def test_tilde_fence_ignores_backticks_and_short_closers(self):
        text = "before\n~~~~text\n```\n~~~\n~~~~\nafter"
        self.assertEqual(outside_fences(text), "before\nafter")
        self.assertEqual(fenced_blocks(text), ["~~~~text\n```\n~~~\n~~~~"])

    def test_canonical_english_link_is_required(self):
        changed = self.chinese_document.replace('href="../../README.md"', 'href="README.md"', 1)
        errors = check_document(self.source, changed, "zh")
        self.assertTrue(any("canonical English link" in item for item in errors), errors)

    def test_rtl_locale_note_is_removed_before_comparison(self):
        text = '<p align="center" dir="rtl"><sub>Localized note</sub></p>\n' + self.chinese
        self.assertEqual(body(text), self.chinese)

    def test_missing_relative_prefix(self):
        target = re.search(r'src="(\.\./\.\./assets/[^"]+)"', self.chinese).group(1)
        changed = self.chinese.replace(f'src="{target}"', f'src="{target[6:]}"', 1)
        self.assertNotEqual(changed, self.chinese)
        self.assert_reports(changed, "lacks ../../ prefix")

    def test_missing_translated_heading(self):
        changed = re.sub(r"^## [^\n]+\n", "", self.chinese, count=1, flags=re.M)
        self.assert_reports(changed, "heading counts or levels differ")

    def test_missing_translated_paragraph(self):
        paragraph = next(line for line in self.chinese.splitlines() if line.startswith("不确定从哪里开始？"))
        self.assert_reports(self.chinese.replace(paragraph, "", 1), "prose block counts differ")

    def test_missing_anchor(self):
        changed = self.chinese.replace('id="contents"', 'id="missing-contents"', 1)
        self.assert_reports(changed, "HTML IDs differ")

    def test_figure_identifier_is_not_transliterated(self):
        changed = self.chinese.replace("<sub>FIG_001 · A</sub>", "<sub>FIG_001 · А</sub>", 1)
        self.assert_reports(changed, "figure identifiers differ")

    def test_changed_lesson_link(self):
        changed = self.chinese.replace(
            "../../phases/00-setup-and-tooling/01-dev-environment/",
            "../../phases/00-setup-and-tooling/01-dev-environment-missing/",
            1,
        )
        self.assert_reports(changed, "lesson link destinations differ")

    def test_changed_code_block(self):
        changed = self.chinese.replace(
            "git clone https://github.com/rohitg00/ai-engineering-from-scratch.git",
            "git clone https://github.com/example/broken.git",
            1,
        )
        self.assert_reports(changed, "code block")

    def test_programming_language_name_is_not_translated_as_prose(self):
        changed = self.chinese.replace("| Shell |", "| Galpão |", 1)
        self.assertNotEqual(changed, self.chinese)
        self.assert_reports(changed, "programming-language labels differ")

    def test_mermaid_labels_cannot_silently_remain_english(self):
        source = '```mermaid\nflowchart LR\n  A["Start with a small project"] --> B["Run the code"]\n```'
        locale = source.replace("Run the code", "कोड चलाएँ")
        self.assertEqual(untranslated_fragments(source, locale, "hi"), ["Start with a small project"])

    def test_directory_tree_descriptions_are_translated(self):
        tree = "```text\n├── code/      runnable implementations\n```"
        self.assertEqual(untranslated_fragments(tree, tree, "hi"), ["runnable implementations"])

    def test_navigation_cannot_advertise_an_unreviewed_partial_locale(self):
        changed = self.source + '<a href="i18n/zz/README.md">Draft</a>'
        self.assertTrue(any("navigation" in error for error in source_review_errors(changed)))

    def test_stats_prose_changes_still_require_translation_review(self):
        changed = self.source.replace("page views in the last 30 days", "visitors in the last 30 days")
        self.assertNotEqual(source_fingerprint(self.source), source_fingerprint(changed))

    def test_unclosed_fence_reports_a_review_error(self):
        self.assert_reports(self.chinese + "\n```python\nprint('unfinished')\n", "unclosed fenced code block")

    def test_translated_directory_tree_description_is_allowed(self):
        changed = re.sub(r"(├── code/\s{2,})[^\n]+", r"\1可运行实现（校验）", self.chinese, count=1)
        self.assertEqual(check(self.source, changed, "zh"), [])

    def test_directory_tree_path_is_preserved(self):
        changed = self.chinese.replace("├── code/", "├── other/", 1)
        self.assert_reports(changed, "directory tree paths changed")

    def test_changed_stats_date(self):
        _, stats = landing_facts(self.chinese)
        date = ISO_DATE.search(stats).group()
        changed = self.chinese.replace(date, "1900-01-01", 1)
        self.assert_reports(changed, "stats numeric facts differ")

    def test_stats_sync_preserves_translated_copy(self):
        _, stats = landing_facts(self.chinese)
        reader_count = BOLD_COUNT.findall(stats)[0]
        date = ISO_DATE.search(stats).group()
        changed = self.chinese.replace(f"<b>{reader_count}</b>", "<b>1,000</b>", 1)
        changed = changed.replace(date, "1900-01-01", 1)
        self.assertEqual(sync_stats_facts(self.source, changed), self.chinese)

    def test_new_english_prose_requires_translation_review(self):
        with tempfile.TemporaryDirectory() as directory:
            digest = Path(directory) / "readme-source.sha256"
            digest.write_text(source_fingerprint(self.source) + "\n", encoding="utf-8")
            with patch("audit_readme_locales.SOURCE_DIGEST", digest):
                self.assertEqual(source_review_errors(self.source), [])
                self.assertTrue(source_review_errors(self.source + "\nA new learning route is available.\n"))

    def test_automated_stats_do_not_invalidate_translation_review(self):
        _, stats = landing_facts(self.source)
        date = ISO_DATE.search(stats).group()
        changed = self.source.replace(date, "2099-01-01", 1)
        self.assertEqual(source_fingerprint(self.source), source_fingerprint(changed))

    def test_reader_and_page_view_roles_are_not_swapped(self):
        _, stats = landing_facts(self.chinese)
        readers, views = BOLD_COUNT.findall(stats)
        changed = self.chinese.replace(f"<b>{readers}</b>", "<b>TEMP</b>", 1)
        changed = changed.replace(f"<b>{views}</b>", f"<b>{readers}</b>", 1)
        changed = changed.replace("<b>TEMP</b>", f"<b>{views}</b>", 1)
        self.assert_reports(changed, "reader and page-view counts differ")

    def test_changed_hero_count(self):
        line = next(line for line in self.chinese.splitlines() if line.startswith("> ") and FACT.search(line))
        original = FACT.search(line).group()
        altered = line.replace(original, str(int(original.replace(",", "")) + 1), 1)
        changed = self.chinese.replace(line, altered, 1)
        self.assert_reports(changed, "hero numeric facts differ")

    def test_phase_summary_lesson_count_is_preserved(self):
        changed = re.sub(r"(<code>)22", r"\g<1>99", self.chinese, count=1)
        self.assertNotEqual(changed, self.chinese)
        self.assert_reports(changed, "phase summary lesson counts differ")

    def test_study_time_is_preserved(self):
        changed = self.chinese.replace("306", "999", 1)
        self.assertNotEqual(changed, self.chinese)
        self.assert_reports(changed, "study-time table numeric amounts differ")

    def test_native_digits_and_decimal_separators_are_equivalent(self):
        self.assertEqual(numeric_amounts("約9.5時間"), numeric_amounts("~9,5 timer"))
        self.assertEqual(numeric_amounts("23 hours 15 min"), numeric_amounts("٢٣ ساعة ١٥ دقيقة"))

    def test_extra_table_cell(self):
        changed = self.chinese.replace("|---|---|---|", "|---|---|---|---|", 1)
        self.assert_reports(changed, "table row or cell counts differ")

    def test_missing_html_table_opening(self):
        changed = re.sub(r"<table\b[^>]*>", "", self.chinese, count=1)
        self.assertNotEqual(changed, self.chinese)
        self.assert_reports(changed, "HTML table structure differs")

    def test_html_table_closing_order(self):
        changed = self.chinese.replace("</td>", "</tr>", 1)
        self.assert_reports(changed, "HTML table structure differs")

    def test_accidental_list_marker(self):
        changed = self.chinese.replace("不确定从哪里开始？", "- 不确定从哪里开始？", 1)
        self.assert_reports(changed, "Markdown list item counts differ")

    def test_untranslated_english_paragraph(self):
        line = next(
            line for line in outside_fences(self.source).splitlines()
            if len(line) > 80 and len(line.split()) > 10 and not line.lstrip().startswith(("|", "<", ">", "-", "*"))
        )
        self.assert_reports(self.chinese + "\n" + line + "\n", "English text remains untranslated")

    def test_reflowed_english_paragraph_is_rejected(self):
        paragraph = next(span["key"] for span in build_readme_i18n.spans(self.source)
                         if span["kind"] == "prose" and span["end"] - span["start"] > 1
                         and len(span["key"].split()) > 20
                         and not any(mark in span["key"] for mark in ("`", "[", "<")))
        self.assertIn(paragraph, untranslated_fragments(self.source, paragraph, "hi"))

    def test_untranslated_image_description(self):
        description = next(
            match.group(1) for match in HTML_ALT.finditer(self.source)
            if len(match.group(1)) > 70 and len(match.group(1).split()) > 8
        )
        self.assert_reports(self.chinese + "\n<p>" + description + "</p>\n", "English text remains untranslated")

    def test_short_english_prose_heading_and_table_cell(self):
        source = '## Getting started\nStart with a small project.\n| Lesson | [Dev Environment](phases/setup/) | Python |'
        locale = '## Getting started\nStart with a small project.\n| पाठ | [Dev Environment](../../phases/setup/) | Python |'
        self.assertEqual(untranslated_fragments(source, locale, "hi"), [
            "Dev Environment", "Getting started", "Start with a small project.",
        ])

    def test_code_urls_and_technical_names_are_not_prose(self):
        text = '```python\nprint("Start here")\n```\n`Start here`\nhttps://example.com/start\n| Python, Julia | Model Context Protocol (MCP) |'
        self.assertEqual(untranslated_fragments(text, text, "hi"), [])

    def test_complete_locale_rejects_english_sponsor_cta(self):
        source = '<a href="SPONSORS.md">Become a sponsor</a>'
        locale = '<a href="../../SPONSORS.md">Become a sponsor</a>'
        self.assertEqual(untranslated_fragments(source, locale, "he"), ["Become a sponsor"])

    def test_language_bar_accepts_regional_tags(self):
        source = '<a href="i18n/pt-BR/README.md">Português (Brasil)</a><a href="i18n/zh-TW/README.md">繁體中文</a>'
        self.assertEqual(language_codes(source), {"pt-BR", "zh-TW"})
        self.assertEqual(language_codes(source.replace('href="i18n/', 'href="../../i18n/')), {"pt-BR", "zh-TW"})

    def test_chinese_navigation_does_not_require_one_fixed_heading(self):
        changed = self.chinese.replace("选择 README 语言", "阅读语言")
        self.assertFalse(any("Chinese language navigation" in error for error in check(self.source, changed, "zh")))

    def test_critical_inline_path_is_preserved(self):
        changed = self.chinese.replace("catalog.json", "catalog.txt")
        self.assert_reports(changed, "inline code formatting missing")

    def test_inline_code_markers_are_preserved(self):
        changed = self.chinese.replace("`start-learning`", "start-learning")
        self.assert_reports(changed, "inline code formatting missing")

    def test_course_route_range_is_preserved(self):
        changed = self.chinese.replace("第 47–54 课", "第 47 课", 1)
        self.assert_reports(changed, "course range 47")

    def test_regeneration_preserves_full_document_and_does_not_publish_partial_locale(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            readme = root / "README.md"
            out = root / "i18n"
            readme.write_text(self.source, encoding="utf-8")
            full = out / "zh" / "README.md"
            full.parent.mkdir(parents=True)
            full.write_text(self.chinese_document, encoding="utf-8")
            with patch.multiple(build_readme_i18n, ROOT=root, README=readme, OUT_ROOT=out), \
                 patch("audit_readme_locales.FULL_LOCALES", ("zh",)), \
                 patch("readme_translations.TRANSLATIONS", {"zz": {}}), \
                 patch("audit_readme_locales.source_review_errors", return_value=[]), \
                 redirect_stdout(StringIO()), redirect_stderr(StringIO()):
                self.assertEqual(build_readme_i18n.main([]), 0)
            self.assertEqual(full.read_text(encoding="utf-8"), self.chinese_document)
            self.assertFalse((out / "zz" / "README.md").exists())


if __name__ == "__main__":
    unittest.main()
