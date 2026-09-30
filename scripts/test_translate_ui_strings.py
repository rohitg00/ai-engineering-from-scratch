#!/usr/bin/env python3
"""Regression checks for the interface-string translator and its source file."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import translate_ui_strings as ui  # noqa: E402


FIXED_TOKENS = ("SKILL.md", "README.md", "phases/", "start-learning", "@rohitg00", "(⌘K)")


class SourceFileTest(unittest.TestCase):
    def test_source_file_is_consistent(self):
        keys, overrides = ui.load_source()
        self.assertTrue(keys)
        self.assertEqual(ui.check_source(keys, overrides), [])

    def test_check_source_reports_problems(self):
        problems = ui.check_source(["A", "A", " B"], {"zh": {"C": "x", "A": " "}})
        self.assertEqual(len(problems), 4)


class BuildLanguageTest(unittest.TestCase):
    def test_override_then_existing_then_translate(self):
        calls = []

        def translate(text):
            calls.append(text)
            return text.upper()

        strings, count = ui.build_language(
            ["Contents", "Catalog", "About"], {"Contents": "目录"}, {"Catalog": "cached"}, translate
        )
        self.assertEqual(strings, {"Contents": "目录", "Catalog": "cached", "About": "ABOUT"})
        self.assertEqual(count, 1)
        self.assertEqual(calls, ["About"])

    def test_removed_override_is_retranslated_instead_of_reused(self):
        calls = []

        def translate(text):
            calls.append(text)
            return text.upper()

        strings, count = ui.build_language(
            ["Build", "Run"], {}, {"Build": "old pin", "Run": "machine"}, translate, pinned_before={"Build"}
        )
        self.assertEqual(strings, {"Build": "BUILD", "Run": "machine"})
        self.assertEqual(count, 1)
        self.assertEqual(calls, ["Build"])

    def test_load_published_accepts_flat_and_wrapped_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ui.json"
            self.assertEqual(ui.load_published(path), ({}, set()))
            path.write_text(json.dumps({"A": "a"}), encoding="utf-8")
            self.assertEqual(ui.load_published(path), ({"A": "a"}, {"A"}))
            path.write_text(json.dumps({"strings": {"A": "a"}, "pinned": ["A"]}), encoding="utf-8")
            self.assertEqual(ui.load_published(path), ({"A": "a"}, {"A"}))

    def test_flat_file_values_are_refreshed_once_on_migration(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "ui-strings.json"
            source.write_text(json.dumps({"keys": ["Build"], "overrides": {}}), encoding="utf-8")
            out = Path(tmp) / "es" / "ui.json"
            out.parent.mkdir()
            out.write_text(json.dumps({"Build": "old pin"}), encoding="utf-8")
            ui.main(["--lang", "es", "--provider", "echo", "--out", tmp, "--source", str(source)])
            self.assertEqual(json.loads(out.read_text(encoding="utf-8")), {"strings": {"Build": "Build"}, "pinned": []})

    def test_dropped_keys_disappear_from_output(self):
        strings, _ = ui.build_language(["A"], {}, {"A": "x", "Gone": "y"}, lambda s: s)
        self.assertEqual(list(strings), ["A"])

    def test_dry_run_counts_without_translating(self):
        strings, count = ui.build_language(["A", "B"], {"A": "a"}, {}, None)
        self.assertEqual(strings, {"A": "a"})
        self.assertEqual(count, 1)

    def test_fixed_tokens_never_reach_the_model(self):
        samples = [
            "Open SKILL.md",
            "Use start-learning to begin the course.",
            "Follow @rohitg00",
            "Search (⌘K)",
            "Requires a local clone. Run copied commands from the repository root, the directory containing README.md and phases/.",
        ]
        seen = []

        def translate(text):
            seen.append(text)
            return text.upper()

        strings, _ = ui.build_language(samples, {}, {}, translate)
        for text in seen:
            for token in FIXED_TOKENS:
                self.assertNotIn(token, text)
        for sample in samples:
            for token in FIXED_TOKENS:
                if token in sample:
                    self.assertIn(token, strings[sample])
        self.assertEqual(strings["Open SKILL.md"], "OPEN SKILL.md")
        self.assertEqual(strings["Follow @rohitg00"], "FOLLOW @rohitg00")

    def test_placeholder_loss_leaves_the_key_english(self):
        strings, count = ui.build_language(["Open SKILL.md"], {}, {}, lambda s: "opened")
        self.assertEqual(strings, {})
        self.assertEqual(count, 0)


class EndToEndTest(unittest.TestCase):
    def test_echo_provider_writes_every_language(self):
        keys, overrides = ui.load_source()
        with tempfile.TemporaryDirectory() as tmp:
            ui.main(["--lang", "zh", "--lang", "tr", "--provider", "echo", "--out", tmp])
            for lang in ("zh", "tr"):
                data = json.loads((Path(tmp) / lang / "ui.json").read_text(encoding="utf-8"))
                self.assertEqual(list(data["strings"]), keys)
                self.assertEqual(data["pinned"], [key for key in keys if key in overrides.get(lang, {})])
                for key, value in overrides.get(lang, {}).items():
                    self.assertEqual(data["strings"][key], value)

    def test_second_run_reuses_published_translations_until_a_pin_is_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "ui-strings.json"
            source.write_text(
                json.dumps({"keys": ["Contents", "Catalog"], "overrides": {"es": {"Contents": "Contenido"}}}),
                encoding="utf-8",
            )
            args = ["--lang", "es", "--provider", "echo", "--out", tmp, "--source", str(source)]
            ui.main(args)
            out = Path(tmp) / "es" / "ui.json"
            data = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(data, {"strings": {"Contents": "Contenido", "Catalog": "Catalog"}, "pinned": ["Contents"]})
            data["strings"]["Catalog"] = "kept"
            out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            ui.main(args)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["strings"], {"Contents": "Contenido", "Catalog": "kept"})
            source.write_text(json.dumps({"keys": ["Contents", "Catalog"], "overrides": {}}), encoding="utf-8")
            ui.main(args)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8")), {"strings": {"Contents": "Contents", "Catalog": "kept"}, "pinned": []})
            ui.main(args + ["--force"])
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["strings"]["Catalog"], "Catalog")

    def test_unknown_language_fails_loudly(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                ui.main(["--lang", "xx", "--provider", "echo", "--out", tmp])


if __name__ == "__main__":
    unittest.main()
