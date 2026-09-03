#!/usr/bin/env python3
"""Regression tests for the prose-only lesson translation walker."""

from __future__ import annotations

import json
import select
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


sys.path.insert(0, str(Path(__file__).resolve().parent))

import translate_lessons


class TranslationWalkerTest(unittest.TestCase):
    def test_translation_lock_serializes_independent_processes(self) -> None:
        helper = """
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import translate_lessons
translate_lessons.OUT_ROOT = Path(sys.argv[2])
print("ready", flush=True)
with translate_lessons.translation_lock("fr"):
    print("acquired", flush=True)
    if sys.argv[3] == "hold":
        sys.stdin.readline()
"""
        with tempfile.TemporaryDirectory() as tmp:
            output_root = Path(tmp) / "i18n"
            command = [
                sys.executable,
                "-c",
                helper,
                str(Path(translate_lessons.__file__).parent),
                str(output_root),
            ]
            first = subprocess.Popen(
                [*command, "hold"],
                text=True,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            second = None
            try:
                self.assertEqual("ready\n", first.stdout.readline())
                self.assertEqual("acquired\n", first.stdout.readline())
                second = subprocess.Popen(
                    [*command, "probe"],
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                self.assertEqual("ready\n", second.stdout.readline())
                readable, _, _ = select.select([second.stdout], [], [], 0.2)
                self.assertEqual([], readable)

                first.stdin.write("release\n")
                first.stdin.flush()
                self.assertEqual(0, first.wait(timeout=5), first.stderr.read())
                self.assertEqual("acquired\n", second.stdout.readline())
                self.assertEqual(0, second.wait(timeout=5), second.stderr.read())
            finally:
                for process in (first, second):
                    if process is not None and process.poll() is None:
                        process.kill()
                        process.wait()
                    if process is not None:
                        for stream in (process.stdin, process.stdout, process.stderr):
                            if stream is not None:
                                stream.close()

    def test_main_loads_cache_only_after_acquiring_translation_lock(self) -> None:
        events = []

        class RecordingLock:
            def __enter__(self):
                events.append("lock-enter")

            def __exit__(self, *_args):
                events.append("lock-exit")

        def load_cache(*_args):
            events.append("cache-path")
            return Path("/does/not/exist")

        with mock.patch.object(
            sys, "argv", ["translate_lessons.py", "--lang", "fr", "--dry-run"]
        ), mock.patch.object(
            translate_lessons, "translation_lock", return_value=RecordingLock()
        ), mock.patch.object(
            translate_lessons, "cache_path", side_effect=load_cache
        ), mock.patch.object(translate_lessons, "targets", return_value=()):
            translate_lessons.main()

        self.assertEqual(
            ["lock-enter", "cache-path", "lock-exit"], events
        )

    def test_atomic_json_write_replaces_cache_with_complete_document(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cache_file = Path(tmp) / "cache.json"
            cache_file.write_text('{"old": true}', encoding="utf-8")

            translate_lessons.write_json_atomically(
                cache_file, {"lesson": {"provider": "openai"}}
            )

            self.assertEqual(
                {"lesson": {"provider": "openai"}},
                json.loads(cache_file.read_text(encoding="utf-8")),
            )
            self.assertEqual([], list(cache_file.parent.glob(".cache.json.*.tmp")))

    def test_atomic_json_write_preserves_cache_when_serialization_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cache_file = Path(tmp) / "cache.json"
            original = '{"complete": true}'
            cache_file.write_text(original, encoding="utf-8")

            def interrupt_dump(_value, **_kwargs):
                raise RuntimeError("simulated interruption")

            with mock.patch.object(
                translate_lessons.json, "dumps", side_effect=interrupt_dump
            ), self.assertRaisesRegex(RuntimeError, "simulated interruption"):
                translate_lessons.write_json_atomically(cache_file, {"new": True})

            self.assertEqual(original, cache_file.read_text(encoding="utf-8"))
            self.assertEqual([], list(cache_file.parent.glob(".cache.json.*.tmp")))

    def test_atomic_json_write_preserves_cache_when_replace_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cache_file = Path(tmp) / "cache.json"
            original = '{"complete": true}'
            cache_file.write_text(original, encoding="utf-8")

            with mock.patch.object(
                translate_lessons.os,
                "replace",
                side_effect=OSError("simulated replace failure"),
            ), self.assertRaisesRegex(OSError, "simulated replace failure"):
                translate_lessons.write_json_atomically(cache_file, {"new": True})

            self.assertEqual(original, cache_file.read_text(encoding="utf-8"))
            self.assertEqual([], list(cache_file.parent.glob(".cache.json.*.tmp")))

    def test_human_maintained_language_refuses_machine_translation(self) -> None:
        with mock.patch.object(sys, "argv", ["translate_lessons.py", "--lang", "zh"]), \
                mock.patch.object(translate_lessons, "cache_path") as cache_path, \
                mock.patch.object(translate_lessons, "_nllb_pipe") as nllb_pipe:
            with self.assertRaises(SystemExit):
                translate_lessons.main()
        cache_path.assert_not_called()
        nllb_pipe.assert_not_called()

    def test_cli_rejects_unknown_source_and_traversal_languages_early(self) -> None:
        for lang in ("unknown", "en", "x/../zh", "../../"):
            with self.subTest(lang=lang), \
                    mock.patch.object(
                        sys, "argv", ["translate_lessons.py", "--lang", lang]
                    ), \
                    mock.patch.object(translate_lessons, "cache_path") as cache_path, \
                    mock.patch.object(translate_lessons, "_nllb_pipe") as nllb_pipe:
                with self.assertRaises(SystemExit):
                    translate_lessons.main()
                cache_path.assert_not_called()
                nllb_pipe.assert_not_called()

    def test_cli_rejects_invalid_or_missing_phase_before_cache_access(self) -> None:
        for phase in ("../../", "00-missing-phase", "00-valid/../other"):
            with self.subTest(phase=phase), \
                    mock.patch.object(
                        sys,
                        "argv",
                        [
                            "translate_lessons.py",
                            "--lang",
                            "es",
                            "--phase",
                            phase,
                            "--dry-run",
                        ],
                    ), \
                    mock.patch.object(translate_lessons, "cache_path") as cache_path:
                with self.assertRaises(SystemExit):
                    translate_lessons.main()
                cache_path.assert_not_called()

    def test_cache_and_output_paths_reject_symlink_escape(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "repo"
            output_root = root / "i18n"
            outside = Path(tmp) / "outside"
            output_root.mkdir(parents=True)
            outside.mkdir()
            (output_root / "es").symlink_to(outside, target_is_directory=True)
            doc = root / "phases/00-test/01-lesson/docs/en.md"
            doc.parent.mkdir(parents=True)
            doc.write_text("# Test\n", encoding="utf-8")

            with mock.patch.object(translate_lessons, "ROOT", root), \
                    mock.patch.object(translate_lessons, "OUT_ROOT", output_root):
                with self.assertRaisesRegex(ValueError, "symlink|outside"):
                    translate_lessons.cache_path("es")
                with self.assertRaisesRegex(ValueError, "symlink|outside"):
                    translate_lessons.out_path(doc, "es")

    def test_safe_language_path_rejects_every_symlink_component(self) -> None:
        cases = (
            ("language", ("fr",), ("language-sibling",), True, ("phases", "00-test", "01-lesson", "docs", "fr.md")),
            ("phases", ("fr", "phases"), ("fr", "phases-sibling"), True, ("phases", "00-test", "01-lesson", "docs", "fr.md")),
            ("phase", ("fr", "phases", "00-test"), ("fr", "phases", "99-sibling"), True, ("phases", "00-test", "01-lesson", "docs", "fr.md")),
            ("cache", ("fr", ".cache"), ("fr", "cache-sibling"), True, (".cache", "00-test.json")),
            ("cache file", ("fr", ".cache", "00-test.json"), ("fr", ".cache", "99-sibling.json"), False, (".cache", "00-test.json")),
            ("lesson", ("fr", "phases", "00-test", "02-orphan"), ("fr", "phases", "00-test", "01-current"), True, ("phases", "00-test", "02-orphan", "docs", "fr.md")),
            ("docs", ("fr", "phases", "00-test", "02-orphan", "docs"), ("fr", "phases", "00-test", "01-current", "docs"), True, ("phases", "00-test", "02-orphan", "docs", "fr.md")),
            ("file", ("fr", "phases", "00-test", "02-orphan", "docs", "fr.md"), ("fr", "phases", "00-test", "01-current", "docs", "fr.md"), False, ("phases", "00-test", "02-orphan", "docs", "fr.md")),
        )
        for label, link_parts, target_parts, target_is_dir, request_parts in cases:
            with self.subTest(component=label), tempfile.TemporaryDirectory() as tmp:
                output_root = Path(tmp) / "i18n"
                link = output_root.joinpath(*link_parts)
                target = output_root.joinpath(*target_parts)
                link.parent.mkdir(parents=True, exist_ok=True)
                if target_is_dir:
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text("sibling\n", encoding="utf-8")
                link.symlink_to(target, target_is_directory=target_is_dir)

                with mock.patch.object(translate_lessons, "OUT_ROOT", output_root):
                    with self.assertRaisesRegex(ValueError, "contains a symlink"):
                        translate_lessons._safe_language_path(
                            "fr", *request_parts
                        )

    def test_safe_language_path_rejects_output_root_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            real_output = base / "real-i18n"
            real_output.mkdir()
            output_root = base / "i18n"
            output_root.symlink_to(real_output, target_is_directory=True)

            with mock.patch.object(translate_lessons, "OUT_ROOT", output_root):
                with self.assertRaisesRegex(ValueError, "output root is a symlink"):
                    translate_lessons._safe_language_path(
                        "fr", "phases", "00-test", "01-lesson", "docs", "fr.md"
                    )

    def test_lesson_docs_rejects_symlinked_source_components(self) -> None:
        for component in ("phase", "lesson", "docs", "file"):
            with self.subTest(component=component), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                phases = root / "phases"
                phases.mkdir()
                outside = root / "outside"
                outside.mkdir()

                phase = phases / "00-test"
                lesson = phase / "01-lesson"
                docs = lesson / "docs"
                doc = docs / "en.md"
                if component == "phase":
                    target = outside / "phase"
                    (target / "01-lesson/docs").mkdir(parents=True)
                    (target / "01-lesson/docs/en.md").write_text(
                        "# Test\n", encoding="utf-8"
                    )
                    phase.symlink_to(target, target_is_directory=True)
                elif component == "lesson":
                    phase.mkdir()
                    target = outside / "lesson"
                    (target / "docs").mkdir(parents=True)
                    (target / "docs/en.md").write_text(
                        "# Test\n", encoding="utf-8"
                    )
                    lesson.symlink_to(target, target_is_directory=True)
                elif component == "docs":
                    lesson.mkdir(parents=True)
                    target = outside / "docs"
                    target.mkdir()
                    (target / "en.md").write_text(
                        "# Test\n", encoding="utf-8"
                    )
                    docs.symlink_to(target, target_is_directory=True)
                else:
                    docs.mkdir(parents=True)
                    target = outside / "en.md"
                    target.write_text("# Test\n", encoding="utf-8")
                    doc.symlink_to(target)

                with mock.patch.object(translate_lessons, "PHASES", phases):
                    with self.assertRaisesRegex(
                        ValueError, "source lesson path contains a symlink"
                    ):
                        list(translate_lessons.lesson_docs())

    def test_orphan_lesson_symlink_to_current_lesson_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_root = root / "i18n"
            phase_root = output_root / "fr/phases/00-test"
            current = phase_root / "01-current/docs/fr.md"
            current.parent.mkdir(parents=True)
            current.write_text("Traduction actuelle.\n", encoding="utf-8")
            (phase_root / "02-orphan").symlink_to(
                phase_root / "01-current", target_is_directory=True
            )

            with mock.patch.object(translate_lessons, "ROOT", root), \
                    mock.patch.object(translate_lessons, "OUT_ROOT", output_root):
                with self.assertRaisesRegex(ValueError, "contains a symlink"):
                    translate_lessons.remove_orphan_phase_outputs(
                        "fr", "00-test", {current.resolve()}
                    )

            self.assertEqual("Traduction actuelle.\n", current.read_text(encoding="utf-8"))

    def test_only_zero_match_does_not_prune_the_whole_phase(self) -> None:
        source = "# Current\n\nTranslate this lesson.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            phase = "00-test"
            current = root / f"phases/{phase}/01-current/docs/en.md"
            current.parent.mkdir(parents=True)
            current.write_text(source, encoding="utf-8")
            output_root = root / "i18n"
            orphan = output_root / f"fr/phases/{phase}/02-orphan/docs/fr.md"
            orphan.parent.mkdir(parents=True)
            orphan.write_text("À conserver pendant --only.\n", encoding="utf-8")
            orphan_key = f"phases/{phase}/02-orphan/docs/en.md"
            cache_file = output_root / f"fr/.cache/{phase}.json"
            cache_file.parent.mkdir(parents=True)
            cache_file.write_text(
                json.dumps({orphan_key: {"source_sha256": "a" * 64, "provider": "openai"}}),
                encoding="utf-8",
            )

            with mock.patch.object(translate_lessons, "ROOT", root), \
                    mock.patch.object(translate_lessons, "PHASES", root / "phases"), \
                    mock.patch.object(translate_lessons, "OUT_ROOT", output_root), \
                    mock.patch.object(
                        sys,
                        "argv",
                        [
                            "translate_lessons.py",
                            "--lang",
                            "fr",
                            "--provider",
                            "openai",
                            "--phase",
                            phase,
                            "--only",
                            f"phases/{phase}/99-no-match",
                        ],
                    ), mock.patch.object(
                        translate_lessons, "translate_doc"
                    ) as translate_doc:
                translate_lessons.main()

            self.assertTrue(orphan.is_file())
            self.assertIn(
                orphan_key, json.loads(cache_file.read_text(encoding="utf-8"))
            )
            translate_doc.assert_not_called()

    def test_phase_dry_run_reports_but_does_not_prune(self) -> None:
        source = "# Current\n\nTranslate this lesson.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            phase = "00-test"
            current = root / f"phases/{phase}/01-current/docs/en.md"
            current.parent.mkdir(parents=True)
            current.write_text(source, encoding="utf-8")
            output_root = root / "i18n"
            orphan = output_root / f"fr/phases/{phase}/02-orphan/docs/fr.md"
            orphan.parent.mkdir(parents=True)
            orphan.write_text("À conserver pendant --dry-run.\n", encoding="utf-8")
            orphan_key = f"phases/{phase}/02-orphan/docs/en.md"
            cache_file = output_root / f"fr/.cache/{phase}.json"
            cache_file.parent.mkdir(parents=True)
            original_cache = json.dumps(
                {orphan_key: {"source_sha256": "a" * 64, "provider": "openai"}}
            )
            cache_file.write_text(original_cache, encoding="utf-8")

            with mock.patch.object(translate_lessons, "ROOT", root), \
                    mock.patch.object(translate_lessons, "PHASES", root / "phases"), \
                    mock.patch.object(translate_lessons, "OUT_ROOT", output_root), \
                    mock.patch.object(
                        sys,
                        "argv",
                        [
                            "translate_lessons.py",
                            "--lang",
                            "fr",
                            "--provider",
                            "openai",
                            "--phase",
                            phase,
                            "--dry-run",
                        ],
                    ), mock.patch("sys.stdout") as stdout:
                translate_lessons.main()

            self.assertTrue(orphan.is_file())
            self.assertEqual(original_cache, cache_file.read_text(encoding="utf-8"))
            self.assertTrue(
                any(
                    "would remove orphan translation" in str(call)
                    for call in stdout.write.call_args_list
                )
            )

    def test_identity_translation_round_trips_every_lesson(self) -> None:
        documents = list(translate_lessons.lesson_docs())
        inventory = json.loads(
            subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).with_name("build_catalog.py")),
                    "--stdout",
                ],
                check=True,
                capture_output=True,
                text=True,
            ).stdout
        )
        self.assertEqual(inventory["totals"]["lessons"], len(documents))
        for path in documents:
            with self.subTest(path=path):
                source = path.read_text(encoding="utf-8")
                translated = translate_lessons.nllb_translate_doc(
                    source,
                    "zho_Hans",
                    translate_fn=lambda fragment: fragment,
                )
                self.assertEqual(source, translated)

    def test_translation_changes_prose_but_preserves_protected_content(self) -> None:
        source = """# Build attention

Translate this sentence around `softmax`, $QK^T$, **Transformer**, and [the spec](https://example.com/spec).

| Keep | This table |
| --- | --- |

```python
print("keep this code")
```
"""

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: "译文" if fragment.strip() else fragment,
        )

        self.assertNotEqual(source, translated)
        for protected in (
            "`softmax`",
            "$QK^T$",
            "https://example.com/spec",
            'print("keep this code")',
        ):
            self.assertIn(protected, translated)
        self.assertIn("**译文**", translated)
        self.assertIn("[译文](https://example.com/spec)", translated)
        self.assertIn("| 译文 | 译文 |", translated)

    def test_balanced_and_escaped_link_destinations_are_preserved(self) -> None:
        doi = "https://doi.org/10.1016/0004-3702(71)90002-6"
        escaped = r"https://example.com/a\(b\)/figure(c).svg"
        source = (
            f"Read [the paper]({doi}), inspect ![the figure]({escaped}), "
            f"then open {doi}."
        )

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: {
                "Read": "阅读",
                "the paper": "论文",
                ", inspect": "，查看",
                "the figure": "图示",
                ", then open": "，然后打开",
            }.get(fragment, fragment),
        )

        self.assertIn(f"[论文]({doi})", translated)
        self.assertIn(f"![图示]({escaped})", translated)
        self.assertIn(f"打开 {doi}.", translated)
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )
        self.assertEqual(
            [],
            translate_lessons.translation_integrity_issues(
                source, translated, "zh", "nllb"
            ),
        )
        self.assertIn(("link-target", doi), translate_lessons.protected_inline_values(source))
        self.assertIn(("image-target", escaped), translate_lessons.protected_inline_values(source))
        protected, store = translate_lessons.protect(source)
        self.assertNotIn(doi, protected)
        self.assertIn(doi, store)
        self.assertTrue(any(escaped in value for value in store))
        self.assertEqual(source, translate_lessons.restore(protected, store))
        destinations_only, destination_store = (
            translate_lessons.protect_inline_destinations(source)
        )
        self.assertNotIn(doi, destinations_only)
        self.assertEqual(2, destination_store.count(doi))
        self.assertIn(escaped, destination_store)
        self.assertEqual(
            source,
            translate_lessons.restore(destinations_only, destination_store),
        )

    def test_angle_destination_with_parenthesis_preserves_wrapper_and_url(self) -> None:
        destination = "<https://example.com/a(b>"
        source = f"Read [the paper]({destination})."

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: {
                "Read": "阅读",
                "the paper": "论文",
            }.get(fragment, fragment),
        )

        self.assertEqual(f"阅读 [论文]({destination}).", translated)
        self.assertIn(
            ("link-target", destination),
            translate_lessons.protected_inline_values(source),
        )
        protected, store = translate_lessons.protect(source)
        self.assertIn(destination, store)
        self.assertEqual(source, translate_lessons.restore(protected, store))
        destinations_only, destination_store = (
            translate_lessons.protect_inline_destinations(source)
        )
        self.assertIn(destination, destination_store)
        self.assertEqual(
            source,
            translate_lessons.restore(destinations_only, destination_store),
        )
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )
        self.assertEqual(
            [],
            translate_lessons.translation_integrity_issues(
                source, translated, "zh", "nllb"
            ),
        )

    def test_angle_destination_wrapper_corruption_fails_integrity(self) -> None:
        source = "Read [the paper](<https://example.com/a(b>)."
        corruptions = (
            "阅读 [论文](https://example.com/a(b>)。",
            "阅读 [论文](<https://example.com/a(b)。",
            "阅读 [论文](<https://example.com/a(b>。",
        )

        for corrupted in corruptions:
            with self.subTest(corrupted=corrupted):
                self.assertIn(
                    "NLLB changed content that must remain byte-identical",
                    translate_lessons.translation_integrity_issues(
                        source, corrupted, "zh", "nllb"
                    ),
                )

    def test_integrity_check_rejects_corrupted_protected_content(self) -> None:
        source = "See [the spec](https://example.com/spec) and `token`."
        corrupted = "请参阅 [the spec](https://example.com/spec错误) 和 `token`。"
        issues = translate_lessons.translation_integrity_issues(
            source, corrupted, "zh", "nllb"
        )
        self.assertIn("NLLB changed content that must remain byte-identical", issues)

    def test_integrity_check_accepts_valid_chinese_translation(self) -> None:
        source = "See [the spec](https://example.com/spec) and `token`."
        translated = "请参阅 [the spec](https://example.com/spec) 和 `token`."
        self.assertEqual(
            [],
            translate_lessons.translation_integrity_issues(
                source, translated, "zh", "nllb"
            ),
        )
        self.assertTrue(
            translate_lessons.translation_cache_is_valid(
                source, translated, "zh", "nllb"
            )
        )

    def test_metadata_values_may_be_localized_but_keys_must_stay_english(self) -> None:
        source = (
            "**Type:** Build\n"
            "**Languages:** Python\n"
            "**Prerequisites:** Phase 1\n"
            "**Phases exercised:** P1 · P2\n"
            "**Time:** ~60 minutes\n"
            "**Related:** Phase 2\n"
        )
        translated = (
            "**Type:** 构建\n"
            "**Languages:** Python\n"
            "**Prerequisites:** 阶段 1\n"
            "**Phases exercised:** P1 · P2\n"
            "**Time:** 约 60 分钟\n"
            "**Related:** 阶段 2\n"
        )
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )
        singular_source = "**Language:** Python\n"
        singular_translated = "**Language:** Python（标准库）\n"
        self.assertEqual(
            translate_lessons.nllb_protected_segments(singular_source),
            translate_lessons.nllb_protected_segments(singular_translated),
        )
        self.assertFalse(
            translate_lessons.nllb_technical_contracts_are_preserved(
                "**Languages:** Python", "**Languages:** Java"
            )
        )

    def test_corrupt_cached_translation_is_not_reusable(self) -> None:
        source = "See [the spec](https://example.com/spec)."
        corrupted = "请参阅 [the spec](https://example.com/spec错误)。"
        self.assertFalse(
            translate_lessons.translation_cache_is_valid(
                source, corrupted, "zh", "nllb"
            )
        )

    def test_api_translation_rejects_truncated_visible_paragraphs(self) -> None:
        source = (
            "# Test\n\nThis first paragraph explains the workflow.\n\n"
            "This trailing paragraph must remain in the result.\n"
        )
        truncated = "# 测试\n\n第一段解释了工作流程。\n"

        issues = translate_lessons.translation_integrity_issues(
            source, truncated, "zh", "openai"
        )

        self.assertTrue(any("omits 1 substantive visible block" in issue for issue in issues))

    def test_cache_hit_requires_output_model_and_pipeline_fingerprint(self) -> None:
        source_digest = "a" * 64
        output_digest = "b" * 64
        with mock.patch.dict(
            translate_lessons.os.environ, {"LLM_MODEL": "reviewed-model"}
        ):
            current = {
                "source_sha256": source_digest,
                "output_sha256": output_digest,
                "provider": "openai",
                "model": "reviewed-model",
                "pipeline_version": translate_lessons.TRANSLATION_PIPELINE_VERSION,
            }
            self.assertTrue(
                translate_lessons.cache_entry_matches(
                    current, source_digest, "openai", output_digest
                )
            )
            for field, value in (
                ("output_sha256", "c" * 64),
                ("model", "older-model"),
                ("pipeline_version", "older-pipeline"),
            ):
                with self.subTest(field=field):
                    stale = {**current, field: value}
                    self.assertFalse(
                        translate_lessons.cache_entry_matches(
                            stale, source_digest, "openai", output_digest
                        )
                    )

        # These formats remain audit-compatible provenance, but cannot prove
        # which output/model/prompt produced the destination and must refresh.
        for legacy in (
            source_digest,
            {"source_sha256": source_digest, "provider": "openai"},
        ):
            self.assertFalse(
                translate_lessons.cache_entry_matches(
                    legacy, source_digest, "openai", output_digest
                )
            )

    def test_main_writes_and_invalidates_provider_aware_cache(self) -> None:
        source = "# Test\n\nTranslate this sentence.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            doc = root / "phases/00-test/01-lesson/docs/en.md"
            output_root = root / "i18n"
            doc.parent.mkdir(parents=True)
            doc.write_text(source, encoding="utf-8")

            def run(
                provider,
                output="# Essai\n\nPhrase traduite.\n",
                model="reviewed-model",
            ):
                with mock.patch.dict(
                        translate_lessons.os.environ, {"LLM_MODEL": model}
                    ), mock.patch.object(translate_lessons, "ROOT", root), \
                        mock.patch.object(translate_lessons, "PHASES", root / "phases"), \
                        mock.patch.object(translate_lessons, "OUT_ROOT", output_root), \
                        mock.patch.object(
                            sys,
                            "argv",
                            [
                                "translate_lessons.py",
                                "--lang",
                                "fr",
                                "--provider",
                                provider,
                            ],
                        ), \
                        mock.patch.object(
                            translate_lessons,
                            "translate_doc",
                            return_value=output,
                        ) as translate_doc:
                    translate_lessons.main()
                    return translate_doc.call_count

            self.assertEqual(1, run("openai"))
            cache_file = output_root / "fr/.translate-cache.json"
            cache = json.loads(cache_file.read_text(encoding="utf-8"))
            self.assertEqual(
                {
                    "source_sha256": translate_lessons.source_hash(source),
                    "output_sha256": translate_lessons.source_hash(
                        "# Essai\n\nPhrase traduite.\n"
                    ),
                    "provider": "openai",
                    "model": "reviewed-model",
                    "pipeline_version": (
                        translate_lessons.TRANSLATION_PIPELINE_VERSION
                    ),
                },
                cache["phases/00-test/01-lesson/docs/en.md"],
            )
            self.assertEqual(0, run("openai"))
            self.assertEqual(1, run("openai", model="upgraded-model"))
            self.assertEqual(0, run("openai", model="upgraded-model"))
            updated_source = "# Test\n\nTranslate this updated sentence.\n"
            doc.write_text(updated_source, encoding="utf-8")
            self.assertEqual(1, run("openai", model="upgraded-model"))
            cache = json.loads(
                cache_file.read_text(encoding="utf-8")
            )
            self.assertEqual(
                translate_lessons.source_hash(updated_source),
                cache["phases/00-test/01-lesson/docs/en.md"]["source_sha256"],
            )
            self.assertEqual(1, run("deepl"))
            self.assertEqual(1, run("echo"))
            cache = json.loads(
                cache_file.read_text(encoding="utf-8")
            )
            self.assertNotIn("phases/00-test/01-lesson/docs/en.md", cache)

            self.assertEqual(1, run("openai"))
            destination = output_root / "fr/phases/00-test/01-lesson/docs/fr.md"
            destination.write_text(
                "# Autre essai\n\nAutre phrase traduite.\n", encoding="utf-8"
            )
            self.assertEqual(1, run("openai"))
            self.assertEqual(
                "# Essai\n\nPhrase traduite.\n",
                destination.read_text(encoding="utf-8"),
            )
            destination.write_text("Corrupt\n", encoding="utf-8")
            self.assertEqual(1, run("openai", None))
            cache = json.loads(
                cache_file.read_text(encoding="utf-8")
            )
            self.assertNotIn("phases/00-test/01-lesson/docs/en.md", cache)

    def test_phase_run_removes_orphan_translations_and_cache_keys(self) -> None:
        source = "# Renamed\n\nTranslate this renamed lesson.\n"
        translated = "# Renommé\n\nTraduisez cette leçon renommée.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase = "00-test"
            current_key = f"phases/{phase}/03-renamed/docs/en.md"
            current_doc = root / current_key
            output_root = root / "i18n"
            current_doc.parent.mkdir(parents=True)
            current_doc.write_text(source, encoding="utf-8")

            renamed_key = f"phases/{phase}/01-old-name/docs/en.md"
            cache_only_key = f"phases/{phase}/04-cache-only/docs/en.md"
            renamed_output = (
                output_root / f"fr/phases/{phase}/01-old-name/docs/fr.md"
            )
            deleted_output = (
                output_root / f"fr/phases/{phase}/02-deleted/docs/fr.md"
            )
            for orphan in (renamed_output, deleted_output):
                orphan.parent.mkdir(parents=True)
                orphan.write_text("Traduction obsolète.\n", encoding="utf-8")
            cache_file = output_root / f"fr/.cache/{phase}.json"
            cache_file.parent.mkdir(parents=True)
            cache_file.write_text(
                json.dumps(
                    {
                        renamed_key: {
                            "source_sha256": "a" * 64,
                            "provider": "openai",
                        },
                        cache_only_key: {
                            "source_sha256": "b" * 64,
                            "provider": "openai",
                        },
                    }
                ),
                encoding="utf-8",
            )
            other_phase_output = (
                output_root / "fr/phases/99-other/01-kept/docs/fr.md"
            )
            other_phase_output.parent.mkdir(parents=True)
            other_phase_output.write_text("À conserver.\n", encoding="utf-8")

            with mock.patch.object(translate_lessons, "ROOT", root), \
                    mock.patch.object(translate_lessons, "PHASES", root / "phases"), \
                    mock.patch.object(translate_lessons, "OUT_ROOT", output_root), \
                    mock.patch.object(
                        sys,
                        "argv",
                        [
                            "translate_lessons.py",
                            "--lang",
                            "fr",
                            "--provider",
                            "openai",
                            "--phase",
                            phase,
                        ],
                    ), \
                    mock.patch.object(
                        translate_lessons, "translate_doc", return_value=translated
                    ):
                translate_lessons.main()

            self.assertFalse(renamed_output.exists())
            self.assertFalse(deleted_output.exists())
            self.assertTrue(other_phase_output.is_file())
            cache = json.loads(cache_file.read_text(encoding="utf-8"))
            self.assertEqual(
                {
                    current_key: {
                        "source_sha256": translate_lessons.source_hash(source),
                        "output_sha256": translate_lessons.source_hash(translated),
                        "provider": "openai",
                        "model": translate_lessons.translation_model("openai"),
                        "pipeline_version": (
                            translate_lessons.TRANSLATION_PIPELINE_VERSION
                        ),
                    }
                },
                cache,
            )

    def test_placeholder_sequence_validation_rejects_non_nllb_corruption_modes(self) -> None:
        protected = (
            "Intro "
            + translate_lessons.SENTINEL.format(0)
            + " middle "
            + translate_lessons.SENTINEL.format(1)
            + " end."
        )
        valid = (
            "译文 "
            + translate_lessons.SENTINEL.format(0)
            + " 中间 "
            + translate_lessons.SENTINEL.format(1)
            + " 结束。"
        )
        self.assertTrue(
            translate_lessons.placeholder_sequence_is_valid(protected, valid)
        )

        corruptions = (
            "译文 " + translate_lessons.SENTINEL.format(0) + " 中间 结束。",  # dropped
            "译文 "
            + translate_lessons.SENTINEL.format(0)
            + " 中间 "
            + translate_lessons.SENTINEL.format(1)
            + " 额外 "
            + translate_lessons.SENTINEL.format(1),  # repeated
            "译文 "
            + translate_lessons.SENTINEL.format(1)
            + " 中间 "
            + translate_lessons.SENTINEL.format(0)
            + " 结束。",  # reordered
            "译文 "
            + translate_lessons.SENTINEL.format(0)
            + " 中间 "
            + translate_lessons.SENTINEL.format(9)
            + " 结束。",  # unknown
            "译文 ⁣PROTECT 中间 " + translate_lessons.SENTINEL.format(1) + " 结束。",  # broken
        )
        for corrupted in corruptions:
            with self.subTest(corrupted=corrupted):
                self.assertFalse(
                    translate_lessons.placeholder_sequence_is_valid(
                        protected, corrupted
                    )
                )

    def test_placeholder_validation_allows_the_word_protection(self) -> None:
        protected = "Keep " + translate_lessons.SENTINEL.format(0)
        translated = "PROTECTION 译文 " + translate_lessons.SENTINEL.format(0)

        self.assertTrue(
            translate_lessons.placeholder_sequence_is_valid(protected, translated)
        )
        self.assertFalse(
            translate_lessons.has_protection_sentinel_residue("PROTECTION")
        )
        for residue in ("PROTECT12", "⁣PROTECT", "⁣"):
            with self.subTest(residue=residue):
                self.assertTrue(
                    translate_lessons.has_protection_sentinel_residue(residue)
                )

    def test_translate_doc_rejects_non_nllb_placeholder_reordering(self) -> None:
        source = "Translate this around `token` and [the spec](https://example.com/spec)."

        def reorder(_text: str, _lang: str, _provider: str) -> str:
            return (
                "译文 "
                + translate_lessons.SENTINEL.format(1)
                + " 然后 "
                + translate_lessons.SENTINEL.format(0)
            )

        with mock.patch.object(translate_lessons, "translate_text", side_effect=reorder):
            self.assertIsNone(
                translate_lessons.translate_doc(source, "fr", "openai")
            )

    def test_long_outer_fence_keeps_inner_short_fence_verbatim(self) -> None:
        source = """````markdown
literal fenced example
```python
print("not a real nested fence")
```
````

Translate this prose.
"""

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: "翻译这段正文。" if fragment.strip() else fragment,
        )

        self.assertIn(
            "````markdown\nliteral fenced example\n```python\n"
            'print("not a real nested fence")\n```\n````',
            translated,
        )
        self.assertTrue(translated.endswith("翻译这段正文。\n"))

    def test_protect_commonmark_fence_transition_ignores_shorter_inner_backticks(self) -> None:
        source = """Before prose.

````markdown
literal fenced example
```python
print("still inside outer fence")
```
````

After prose with `token`.
"""

        protected, store = translate_lessons.protect(source)

        self.assertEqual(source, translate_lessons.restore(protected, store))
        self.assertEqual(2, len(store))
        self.assertIn(
            "````markdown\nliteral fenced example\n```python\n"
            'print("still inside outer fence")\n```\n````\n',
            store,
        )
        self.assertNotIn("`token`", protected)
        self.assertIn(translate_lessons.SENTINEL.format(1), protected)

    def test_invalid_backtick_info_string_does_not_open_a_fence(self) -> None:
        source = "```python`invalid\nTranslate this prose.\n"

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: "翻译正文。" if fragment.strip() else fragment,
        )
        protected, store = translate_lessons.protect(source)

        self.assertEqual("```python`翻译正文。\n翻译正文。\n", translated)
        self.assertEqual(source, translate_lessons.restore(protected, store))

    def test_inline_display_math_does_not_hide_trailing_prose(self) -> None:
        source = "$$x = y + 1$$ Translate this prose."

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: "翻译这段正文。"
            if fragment.strip()
            else fragment,
        )
        protected, store = translate_lessons.protect(source)

        self.assertEqual("$$x = y + 1$$ 翻译这段正文。", translated)
        self.assertNotIn("$$x = y + 1$$", protected)
        self.assertIn("$$x = y + 1$$", store)
        self.assertEqual(source, translate_lessons.restore(protected, store))

    def test_single_line_display_math_does_not_hide_following_prose(self) -> None:
        source = "$$x = y + 1$$\n\nTranslate after the equation.\n"

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: "翻译公式后的正文。" if fragment.strip() else fragment,
        )

        self.assertEqual("$$x = y + 1$$\n\n翻译公式后的正文。\n", translated)

    def test_multiline_display_math_is_preserved_and_prose_resumes(self) -> None:
        source = "$$\nx = y + 1\n$$\nTranslate after the block."

        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: "翻译块后的正文。" if fragment.strip() else fragment,
        )

        self.assertEqual("$$\nx = y + 1\n$$\n翻译块后的正文。", translated)

    def test_untranslated_substantive_prose_is_rejected(self) -> None:
        source = "# Example\n\nTranslate this complete English sentence."
        incomplete = "# 示例\n\nTranslate this complete English sentence."

        findings = translate_lessons.untranslated_fragments(source, incomplete)

        self.assertEqual(
            ((3, 3, "Translate this complete English sentence."),), findings
        )
        self.assertTrue(
            any("substantive English fragment" in issue for issue in
                translate_lessons.translation_integrity_issues(
                    source, incomplete, "zh", "nllb"
                ))
        )

    def test_machine_managed_non_chinese_rejects_missing_and_untranslated_prose(self) -> None:
        source = (
            "# Example\n\n"
            "This first paragraph must be translated.\n\n"
            "This second paragraph remains untranslated.\n\n"
            "This third paragraph must also be translated.\n\n"
            "| Detail | Meaning |\n|---|---|\n"
            "| first | This table explanation must be translated |"
        )
        incomplete = (
            "# Exemple\n\n"
            "Ce premier paragraphe est traduit.\n\n"
            "This second paragraph remains untranslated.\n\n"
            "| Détail | Signification |\n|---|---|\n"
            "| premier | This table explanation must be translated |"
        )

        issues = translate_lessons.translation_integrity_issues(
            source, incomplete, "fr", "openai"
        )

        self.assertTrue(any("omits 1 substantive visible block" in issue for issue in issues))
        self.assertTrue(any("substantive English fragment" in issue for issue in issues))
        self.assertTrue(any("substantive English table cell" in issue for issue in issues))

    def test_untranslated_prose_survives_target_blank_line_insertion(self) -> None:
        source = "# Example\n\nThis complete English sentence remains."
        incomplete = "# 示例\n\n\nThis complete English sentence remains."

        self.assertEqual(
            ((3, 4, "This complete English sentence remains."),),
            translate_lessons.untranslated_fragments(source, incomplete),
        )

    def test_untranslated_paragraph_normalizes_soft_breaks_and_spaces(self) -> None:
        source = (
            "# Example\n\n"
            "This complete English sentence continues across a source\n"
            "soft line break."
        )
        incomplete = (
            "# 示例\n\n"
            "This  complete English sentence\n"
            "continues across a source soft line break."
        )

        self.assertEqual(
            ((
                3,
                3,
                "This complete English sentence continues across a source "
                "soft line break.",
            ),),
            translate_lessons.untranslated_fragments(source, incomplete),
        )

    def test_untranslated_paragraph_ignores_verbatim_non_prose_blocks(self) -> None:
        source = """# Example

**Prerequisites:** This long English metadata value stays unchanged

    This indented English code block stays unchanged.

```text
This fenced English code block stays unchanged.
```

<https://example.com/this-long-english-url-stays-unchanged>
"""
        translated = source.replace("# Example", "# 示例")

        self.assertEqual(
            (), translate_lessons.untranslated_fragments(source, translated)
        )

    def test_untranslated_paragraph_does_not_cross_markdown_blocks(self) -> None:
        source = """Alpha beta
# Gamma delta
- Epsilon zeta
- Eta theta
> Iota kappa
Lambda mu

Nu xi
-----
Omicron pi

Rho sigma
***
Tau upsilon
"""

        self.assertEqual(
            (), translate_lessons.untranslated_fragments(source, source)
        )

    def test_untranslated_prose_matches_only_the_corresponding_block(self) -> None:
        first = "This ordinary English sentence belongs in the first block."
        second = "Another ordinary English sentence belongs in the second block."
        source = f"{first}\n\n{second}"
        translated = f"第一段已经翻译。\n\n{first}"

        self.assertEqual((), translate_lessons.untranslated_fragments(source, translated))

    def test_untranslated_prose_survives_inserted_target_block(self) -> None:
        first = "This first paragraph should be translated."
        second = "Second paragraph remains entirely in English."
        source = f"{first}\n\n{second}"
        translated = f"额外的中文段落。\n\n第一段已翻译。\n\n{second}"

        self.assertEqual(
            ((3, 5, second),),
            translate_lessons.untranslated_fragments(source, translated),
        )

    def test_duplicate_source_prose_does_not_reuse_one_target_match(self) -> None:
        sentence = "This ordinary English sentence still needs translation."
        source = f"{sentence}\n\n{sentence}"
        translated = f"{sentence}\n\n第二段已经翻译。"

        self.assertEqual(
            ((1, 1, sentence),),
            translate_lessons.untranslated_fragments(source, translated),
        )

    def test_untranslated_table_cell_survives_target_blank_line_insertion(self) -> None:
        source = "| Metric | This sentence explains the metric |\n|---|---|"
        incomplete = "| 指标 | This sentence explains the metric |\n\n|---|---|"

        self.assertEqual(
            ((1, 2, "This sentence explains the metric"),),
            translate_lessons.untranslated_table_cells(source, incomplete),
        )

    def test_untranslated_table_cells_match_only_corresponding_row_and_column(self) -> None:
        first = "This explanation belongs in the first row"
        second = "This explanation belongs in the second row"
        source = (
            f"| Key | {first} |\n"
            "|---|---|\n"
            f"| Other | {second} |"
        )
        translated = (
            "| 键 | 第一行已经翻译 |\n"
            "|---|---|\n"
            f"| 其他 | {first} |"
        )

        self.assertEqual(
            (), translate_lessons.untranslated_table_cells(source, translated)
        )

    def test_untranslated_table_cell_survives_row_shift_within_its_table(self) -> None:
        sentence = "This sentence remains entirely in English"
        source = (
            "| Key | Explanation |\n|---|---|\n"
            f"| one | {sentence} |\n| two | translated source |"
        )
        translated = (
            "| 键 | 说明 |\n|---|---|\n"
            f"| extra | 新增行 |\n| 一 | {sentence} |\n| 二 | 已翻译 |"
        )

        self.assertEqual(
            ((4, 2, sentence),),
            translate_lessons.untranslated_table_cells(source, translated),
        )

    def test_untranslated_table_cell_survives_blank_line_inside_table(self) -> None:
        sentence = "Second ordinary explanation remains untranslated"
        source = (
            "| Key | Explanation |\n|---|---|\n"
            "| A | First explanation is translated |\n"
            f"| B | {sentence} |"
        )
        translated = (
            "| 键 | 说明 |\n|---|---|\n"
            "| A | 第一条已经翻译 |\n\n"
            f"| B | {sentence} |"
        )

        self.assertEqual(
            ((5, 2, sentence),),
            translate_lessons.untranslated_table_cells(source, translated),
        )

    def test_untranslated_scan_ignores_protected_technical_content(self) -> None:
        source = """# Build it

Use **OpenAI Structured Outputs** with [the official guide](https://example.com).

```text
This English code example stays unchanged.
```
"""
        translated = """# 构建它

请将 **OpenAI 结构化输出** 与 [官方指南](https://example.com) 配合使用。

```text
This English code example stays unchanged.
```
"""

        self.assertEqual(
            (), translate_lessons.untranslated_fragments(source, translated)
        )

    def test_table_links_and_emphasis_translate_only_visible_text(self) -> None:
        source = (
            "| **What it means** | [Read the guide](https://example.com/docs) | "
            "`do_not_translate` |\n|---|---|---|"
        )
        translated = translate_lessons.nllb_translate_doc(
            source,
            "zho_Hans",
            translate_fn=lambda fragment: {
                "What it means": "含义",
                "Read the guide": "阅读指南",
            }.get(fragment, fragment),
        )

        self.assertEqual(
            "| **含义** | [阅读指南](https://example.com/docs) | "
            "`do_not_translate` |\n|---|---|---|",
            translated,
        )
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )

    def test_commonmark_multi_backtick_code_span_is_preserved_whole(self) -> None:
        source = "Press `` Ctrl+` `` to open the terminal."
        seen = []

        def hostile_translator(fragment):
            seen.append(fragment)
            return fragment.replace("Ctrl", "BROKEN")

        translated = translate_lessons.nllb_translate_doc(
            source, "zho_Hans", translate_fn=hostile_translator
        )

        self.assertIn(("inline-code", "`` Ctrl+` ``"), translate_lessons.protected_inline_values(source))
        self.assertNotIn("Ctrl", " ".join(seen))
        self.assertIn("`` Ctrl+` ``", translated)
        self.assertFalse(
            translate_lessons.translation_contract_is_preserved(
                source, translated.replace("Ctrl", "BROKEN"), provider="nllb"
            )
        )

    def test_manual_completeness_rejects_equal_count_unrelated_prose(self) -> None:
        source = (
            "# Example\n\n"
            "The first source paragraph explains deterministic retries.\n\n"
            "The second source paragraph explains idempotent writes."
        )
        unrelated = (
            "# 示例\n\n"
            "无关填充。\n\n"
            "仍然无关。"
        )

        self.assertNotEqual((), translate_lessons.missing_visible_fragments(source, unrelated))

    def test_incremental_table_translation_changes_only_verbatim_cells(self) -> None:
        source = "| Metric | What it means | `formula` |\n|---|---|---|"
        current = "| 指标 | What it means | `formula` |\n|---|---|---|"

        translated, count = translate_lessons.translate_untranslated_table_cells(
            source,
            current,
            lambda values: [value.replace("What it means", "含义") for value in values],
        )

        self.assertEqual(1, count)
        self.assertEqual("| 指标 | 含义 | `formula` |\n|---|---|---|", translated)
        self.assertEqual((), translate_lessons.untranslated_table_cells(source, translated))

    def test_untranslated_substantive_table_cell_is_rejected(self) -> None:
        source = "| Metric | This sentence explains the metric |\n|---|---|"
        incomplete = "| 指标 | This sentence explains the metric |\n|---|---|"

        self.assertEqual(
            ((1, 2, "This sentence explains the metric"),),
            translate_lessons.untranslated_table_cells(source, incomplete),
        )
        self.assertEqual((), translate_lessons.untranslated_fragments(source, incomplete))

    def test_technical_identifiers_and_formulas_are_not_flagged_as_prose(self) -> None:
        for fragment in (
            "torch.optim.lr_scheduler",
            "Dirichlet(alpha + counts)",
            "in_ch*out_ch*k*k + out_ch",
            "score(text: str, threshold: float) -> bool",
            "request_id, trace_id, status",
            "pending | running | completed",
            "precision = tp / (tp + fp)",
            r"P(data\|params) * P(params)",
            '(handle_unknown="ignore")',
            "(params, lr, momentum)",
            "num_experts_per_tok",
            "min_pixels / max_pixels",
            "anthropic / openai / aws.bedrock / google.vertex",
            "harassment, harassment/threatening",
            "Stable Diffusion 3.5 Large",
        ):
            with self.subTest(fragment=fragment):
                self.assertFalse(
                    translate_lessons.visible_plain_needs_translation(fragment)
                )
        self.assertTrue(
            translate_lessons.visible_plain_needs_translation(
                "+ transformer decoder for line-level"
            )
        )
        self.assertFalse(
            translate_lessons.visible_plain_needs_translation(
                "params + grads + optim"
            )
        )

        source = (
            "| Posterior | Parameters |\n"
            "|---|---|\n"
            "| Dirichlet(alpha + counts) | in_ch*out_ch*k*k + out_ch |\n"
            "torch.optim.lr_scheduler\n"
        )
        translated = (
            "| 后验分布 | 参数 |\n"
            "|---|---|\n"
            "| Dirichlet(alpha + counts) | in_ch*out_ch*k*k + out_ch |\n"
            "torch.optim.lr_scheduler\n"
        )

        self.assertEqual((), translate_lessons.untranslated_table_cells(source, translated))
        self.assertEqual((), translate_lessons.untranslated_fragments(source, translated))
        self.assertTrue(
            translate_lessons.visible_plain_needs_translation(
                "a faster, safer result for ordinary users"
            )
        )
        self.assertTrue(
            translate_lessons.visible_plain_needs_translation(
                "An Ordinary Title Case Sentence"
            )
        )
        for ordinary in (
            "first, second, third",
            "efficient, reliable, scalable",
            "fast | safe | reliable",
            "Yes (multiple per turn)",
        ):
            with self.subTest(ordinary=ordinary):
                self.assertTrue(
                    translate_lessons.visible_plain_needs_translation(ordinary)
                )

    def test_numeric_math_is_protected_but_currency_is_visible(self) -> None:
        math_source = (
            "Use $2x + 1$, $1+ x$, $1-2$, $1/x$, $2 / x$, and $1_{t}$ "
            "in the derivation."
        )
        values = translate_lessons.protected_inline_values(math_source)
        self.assertIn(("inline-math", "$2x + 1$"), values)
        self.assertIn(("inline-math", "$1+ x$"), values)
        self.assertIn(("inline-math", "$1-2$"), values)
        self.assertIn(("inline-math", "$1/x$"), values)
        self.assertIn(("inline-math", "$2 / x$"), values)
        self.assertIn(("inline-math", "$1_{t}$"), values)
        self.assertIn(
            ("inline-math", "$1 if x > 0 else 0$"),
            translate_lessons.protected_inline_values(
                "Use $1 if x > 0 else 0$ as the indicator."
            ),
        )
        for formula in (
            "$x + y $",
            "$1 if x > 0$",
            "$1 if x else 0$",
            "$1 for x > 0$",
            "$1 where x > 0$",
            "$1 when x > 0$",
            "$1 otherwise 0$",
            "$1 \\cdot x$",
            "$1 \\le x$",
            "$1 \\text{if } x > 0$",
        ):
            with self.subTest(formula=formula):
                self.assertIn(
                    ("inline-math", formula),
                    translate_lessons.protected_inline_values(
                        f"Use {formula} in the derivation."
                    ),
                )

        for currency in (
            "The run fell from $50,000 to $50 in one week.",
            "Cost ranges from $1,000-$100,000+ per training run | $0.01-$0.10.",
            "An A10 costs $2/hr, while an H100 costs $4/hr.",
            "The bill is $25k/month instead of $50k/month.",
            "A $2M-class deployment can save $600k/year.",
            "Cloud GPUs cost $3-4/hour and a run costs $20.",
            "Each experiment costs $30-40 per run; ten cost $300-400.",
            "The run costs $4 if cached, otherwise $50.",
        ):
            with self.subTest(currency=currency):
                self.assertFalse(
                    any(kind == "inline-math" for kind, _ in translate_lessons.protected_inline_values(currency))
                )

        nested = "At $0.50/day use `gpt-4o-mini`; above $10/day stop."
        self.assertIn(
            ("inline-code", "`gpt-4o-mini`"),
            translate_lessons.protected_inline_values(nested),
        )

    def test_bare_url_stops_before_fullwidth_punctuation(self) -> None:
        source = "参阅 https://example.com/docs）。后续中文说明。"

        self.assertIn(
            ("url", "https://example.com/docs"),
            translate_lessons.protected_inline_values(source),
        )

    def test_bare_url_stops_before_non_latin_translation(self) -> None:
        source = "https://example.com/docsअनुवाद"

        self.assertIn(
            ("url", "https://example.com/docs"),
            translate_lessons.protected_inline_values(source),
        )

    def test_technical_tokens_survive_adjacent_non_latin_text(self) -> None:
        values = translate_lessons.protected_inline_values(
            "अनुवादRustअनुवाद Julia中文"
        )

        self.assertIn(("technical", "Rust"), values)
        self.assertIn(("technical", "Julia"), values)

    def test_nllb_allows_target_language_tokens_but_keeps_source_tokens(self) -> None:
        source = "Use Python on the GPU."
        translated = "AI अनुवाद Python और GPU."

        self.assertEqual(
            [],
            translate_lessons.translation_integrity_issues(
                source, translated, "hi", "nllb"
            ),
        )
        self.assertIn(
            "NLLB changed content that must remain byte-identical",
            translate_lessons.translation_integrity_issues(
                source, "AI अनुवाद Python और CPU.", "hi", "nllb"
            ),
        )

    def test_nllb_technical_contract_uses_source_literal_boundaries(self) -> None:
        source = (
            "Sample a 7 kHz sine at 10 kHz (Nyquist = 5 kHz). The 7 kHz "
            "tone is above Nyquist and folds to `10 − 7 = 3 kHz`. The FFT "
            "peak appears at 3 kHz. This is the classic aliasing demo and "
            "the reason every DAC/ADC ships with a brick-wall low-pass filter."
        )
        translated = (
            "नमूना ए 7 kHz 10 पर सिनेस kHz (Nyquist = 5 kHz). The 7 kHz "
            "tone is above Nyquist और तह `10 − 7 = 3 kHz`. . . FFT शिखर 3 "
            "पर दिखाई देता है kHz. यह क्लासिक उपनाम डेमो है और कारण हर "
            "DAC/ADC ईंट-दीवार कम-पास फ़िल्टर के साथ जहाज।"
        )

        self.assertTrue(
            translate_lessons.nllb_technical_contracts_are_preserved(
                source, translated
            )
        )
        self.assertTrue(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, translated
            )
        )

        corruptions = (
            translated.replace("Nyquist = 5", "Nyquist = 6"),
            translated.replace("FFT", "", 1),
            translated.replace("DAC/ADC", "DAC/DAC/ADC"),
            translated.replace("DAC/ADC", "ADC/DAC"),
        )
        for corrupted in corruptions:
            with self.subTest(corrupted=corrupted):
                self.assertFalse(
                    translate_lessons.nllb_technical_contracts_are_preserved(
                        source, corrupted
                    )
                )
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, corrupted
                    )
                )

    def test_nllb_contract_preserves_interleaved_duplicate_order(self) -> None:
        source = "Use `first`, then `second`, then `first`."
        reordered = "用 `first`，再用 `first`，最后用 `second`。"

        self.assertFalse(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, reordered
            )
        )

    def test_nllb_allows_new_protected_shapes_but_not_loss_or_reordering(self) -> None:
        source = "Use `first` before `second`."
        translated = "新增 `$target_shape$`，再用 `first`，最后用 `second`."

        self.assertEqual(
            [],
            translate_lessons.translation_integrity_issues(
                source, translated, "fr", "nllb"
            ),
        )
        for corrupted in (
            "只保留 `first`。",
            "先用 `second`，再用 `first`。",
            "先用 `first`，重复 `first`，最后用 `second`。",
        ):
            with self.subTest(corrupted=corrupted):
                self.assertIn(
                    "NLLB changed content that must remain byte-identical",
                    translate_lessons.translation_integrity_issues(
                        source, corrupted, "fr", "nllb"
                    ),
                )

    def test_nllb_rejects_protected_span_moved_to_another_line(self) -> None:
        source = "First uses `alpha`.\nSecond uses `beta`."
        moved = "Première ligne.\nDeuxième ligne `alpha` puis `beta`."

        self.assertFalse(
            translate_lessons.nllb_protected_content_is_preserved(source, moved)
        )

    def test_nllb_rejects_source_span_duplicated_on_another_line(self) -> None:
        source = "First uses `alpha`.\nPlain prose."
        duplicated = "Première ligne `alpha`.\nTexte `alpha`."

        self.assertFalse(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, duplicated
            )
        )

    def test_nllb_integrity_normalizes_platform_newlines(self) -> None:
        source = "First uses `alpha`.\r\n\r\nSecond uses `beta`.\r\n"
        translated = "Premier `alpha`.\n\nDeuxième `beta`.\n"

        self.assertTrue(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, translated
            )
        )

    def test_nllb_rejects_protected_span_moved_to_another_table_cell(self) -> None:
        source = "| Code | Link |\n| --- | --- |\n| `alpha` | [docs](https://example.com) |"
        moved = "| 代码 | 链接 |\n| --- | --- |\n| 空 | `alpha` [文档](https://example.com) |"

        self.assertFalse(
            translate_lessons.nllb_protected_content_is_preserved(source, moved)
        )
        duplicated = (
            "| Code | Link |\n| --- | --- |\n"
            "| `alpha` | `alpha` [文档](https://example.com) |"
        )
        self.assertFalse(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, duplicated
            )
        )

    def test_nllb_rejects_cross_kind_protected_value_reordering(self) -> None:
        cases = (
            ("Use `first` then GPU.", "GPU. puis `first`."),
            (
                "`first` then precision = tp / (tp + fp)",
                "precision = tp / (tp + fp) puis `first`",
            ),
            (
                "Open https://example.com then use Python.",
                "Python puis https://example.com",
            ),
        )

        for source, reordered in cases:
            with self.subTest(source=source):
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, reordered
                    )
                )

    def test_nllb_preserves_inline_markdown_wrappers(self) -> None:
        valid_cases = (
            ("Use **safe mode** now.", "Utilisez **le mode sûr** maintenant."),
            ("Use *safe mode* now.", "Utilisez *le mode sûr* maintenant."),
            ("Use _safe mode_ now.", "Utilisez _le mode sûr_ maintenant."),
            ("Read [the guide](https://example.com).", "Lire [le guide](https://example.com)."),
            ("Use `alpha`.", "Utilisez `alpha` et **important**."),
        )
        for source, translated in valid_cases:
            with self.subTest(source=source):
                self.assertTrue(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, translated
                    )
                )

        corruptions = (
            ("Use **safe mode** now.", "Utilisez le mode sûr maintenant."),
            ("Use **safe mode** now.", "Utilisez __le mode sûr__ maintenant."),
            ("Use *safe mode* now.", "Utilisez le mode sûr maintenant."),
            ("Use _safe mode_ now.", "Utilisez le mode sûr maintenant."),
            ("Read [the guide](https://example.com).", "Lire https://example.com."),
            ("Plain text.", "[Texte](https://evil.example)"),
            ("Use `safe_mode` now.", "Utilisez [`safe_mode`](https://new.test)."),
            ("Use Python now.", "Utilisez [Python](https://new.test)."),
            ("Use **safe mode** now.", "Utilisez [**le mode sûr**](https://new.test)."),
            (
                "Use `safe_mode`.\n\n[img]: image.png",
                "Utilisez ![`safe_mode`][img].\n\n[img]: image.png",
            ),
            ("Use `alpha`.", "Utilisez `alpha` puis $`alpha`$."),
            ("Use GPU.", "Utilisez GPU puis `GPU`."),
            (
                "precision = tp / (tp + fp)",
                "precision = tp / (tp + fp) puis $precision = tp / (tp + fp)$",
            ),
            (
                "request_id, trace_id, status",
                "request_id, trace_id, status puis `request_id, trace_id, status`",
            ),
        )
        for source, corrupted in corruptions:
            with self.subTest(corrupted=corrupted):
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, corrupted
                    )
                )
                self.assertIn(
                    "NLLB changed content that must remain byte-identical",
                    translate_lessons.translation_integrity_issues(
                        source, corrupted, "fr", "nllb"
                    ),
                )

    def test_nllb_rejects_dropped_visible_line_or_cell_content(self) -> None:
        cases = (
            ("Translate this line.\nKeep going.", "\nContinuez."),
            ("| Keep this | Value |", "| | Valeur |"),
        )

        for source, truncated in cases:
            with self.subTest(source=source):
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, truncated
                    )
                )

    def test_nllb_rejects_new_block_syntax_on_plain_source_lines(self) -> None:
        for replacement in (
            "$$\nreplacement\n$$",
            "Texte\n---\nTexte",
            "Texte\n```text\nTexte",
            "Texte\n<section>\nTexte",
            "Texte\n| cellule |\nTexte",
            "Texte\n<script>alert(1)</script>\nTexte",
        ):
            with self.subTest(replacement=replacement):
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        "First line.\nSecond line.\nThird line.", replacement
                    )
                )

    def test_nllb_preserves_reference_link_identifiers(self) -> None:
        source = (
            "Read [the guide][docs], [docs][], [docs], and ![diagram][docs].\n\n"
            "[docs]: ../guide.md"
        )
        translated = (
            "Lire [le guide][docs], [docs][], [docs], et ![diagramme][docs].\n\n"
            "[docs]: ../guide.md"
        )

        self.assertTrue(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, translated
            )
        )

        compact = "Read [guide].\n\n[guide]:/guide.md"
        compact_out = translate_lessons.nllb_translate_doc(
            compact, "fra_Latn", translate_fn=lambda value: value
        )
        self.assertEqual(compact, compact_out)
        corruptions = (
            translated.replace("[le guide][docs]", "[le guide][other]"),
            translated.replace("[docs][]", "[other][]"),
            translated.replace(", [docs],", ", [other],"),
            translated.replace("![diagramme][docs]", "![diagramme][other]"),
            translated.replace("[docs][], [docs]", "[docs], [docs]"),
            translated.replace("[docs]: ../guide.md", "[other]: ../guide.md"),
            translated.replace("../guide.md", "../other.md"),
        )
        for corrupted in corruptions:
            with self.subTest(corrupted=corrupted):
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, corrupted
                    )
                )
                self.assertIn(
                    "NLLB changed content that must remain byte-identical",
                    translate_lessons.translation_integrity_issues(
                        source, corrupted, "fr", "nllb"
                    ),
                )

    def test_nllb_walker_preserves_reference_link_contract(self) -> None:
        source = (
            "Read [the guide][docs], [docs], and ![diagram][docs].\n\n"
            "[docs]: ../guide.md"
        )
        translated = translate_lessons.nllb_translate_doc(
            source,
            "fra_Latn",
            translate_fn=lambda fragment: {
                "Read": "Lire",
                "the guide": "le guide",
                ",": ",",
                "and": "et",
                "diagram": "diagramme",
                ".": ".",
            }.get(fragment.strip(), fragment),
        )

        self.assertIn("[le guide][docs]", translated)
        self.assertIn("[docs]", translated)
        self.assertIn("![diagramme][docs]", translated)
        self.assertTrue(translated.endswith("[docs]: ../guide.md"))
        self.assertTrue(
            translate_lessons.nllb_translation_contract_is_preserved(
                source, translated
            )
        )

        multiline = (
            "Read [guide].\n\n[guide]:\n  ../guide.md\n  \"Official guide\""
        )
        calls = []
        multiline_out = translate_lessons.nllb_translate_doc(
            multiline,
            "fra_Latn",
            translate_fn=lambda value: calls.append(value) or "Lire",
        )
        self.assertEqual(
            "Lire [guide].\n\n[guide]:\n  ../guide.md\n  \"Official guide\"",
            multiline_out,
        )
        self.assertEqual(["Read"], calls)
        self.assertTrue(
            translate_lessons.nllb_translation_contract_is_preserved(
                multiline, multiline_out
            )
        )
        self.assertFalse(
            translate_lessons.nllb_translation_contract_is_preserved(
                multiline, multiline_out.replace("../guide.md", "../other.md")
            )
        )

        compact = "Read [guide].\n\n[guide]:/guide\n'Official guide'"
        compact_out = translate_lessons.nllb_translate_doc(
            compact,
            "fra_Latn",
            translate_fn=lambda value: "Lire",
        )
        self.assertEqual(
            "Lire [guide].\n\n[guide]:/guide\n'Official guide'",
            compact_out,
        )
        self.assertFalse(
            translate_lessons.nllb_translation_contract_is_preserved(
                compact, compact_out.replace("'Official guide'", "Titre officiel")
            )
        )

    def test_nllb_requires_walker_verbatim_lines_byte_identical(self) -> None:
        cases = (
            ("   ", "changed"),
            ("123", "456"),
            ("12.5 Hz", "99 Hz"),
            ("| 123 |", "| 456 |"),
            ("| Alpha | Beta |", "| --- | --- |"),
            ("$$x = y + 1$$", " $$x = y + 1$$"),
            ("| --- | :---: |", "| === | :===: |"),
            ("<section>", "<article>"),
            ("**Type:** Build", "**Type:** Construire"),
            ("---", "==="),
            ("```python\nprint('ok')\n```", "```python\nprint('changed')\n```"),
            ("$$\nx = y + 1\n$$", "$$\nx = z + 1\n$$"),
        )

        for source, corrupted in cases:
            with self.subTest(source=source):
                self.assertFalse(
                    translate_lessons.nllb_translation_contract_is_preserved(
                        source, corrupted
                    )
                )

    def test_nllb_integrity_matches_inline_display_math_with_trailing_prose(self) -> None:
        source = "$$x=y$$ Translate this prose."
        translated = "$$x=y$$ 翻译这段正文。"

        self.assertTrue(
            translate_lessons.nllb_protected_content_is_preserved(
                source, translated
            )
        )

    def test_nllb_integrity_rejects_changed_technical_contracts(self) -> None:
        cases = (
            ("score(text: str, threshold: float) -> bool", "score(text: int, threshold: float) -> bool"),
            ("request_id, trace_id, status", "request_id, trace_key, status"),
            ("request_id, trace_id, status", "request_id, trace_id, status_extra"),
            ("pending | running | completed", "pending | failed | completed"),
            ("precision = tp / (tp + fp)", "precision = tp / (tp + fn)"),
        )
        for source, corrupted in cases:
            with self.subTest(source=source):
                self.assertIn(
                    "NLLB changed content that must remain byte-identical",
                    translate_lessons.translation_integrity_issues(
                        source, corrupted, "fr", "nllb"
                    ),
                )

    def test_manual_integrity_allows_reordering_but_rejects_technical_changes(self) -> None:
        source = (
            "Use OpenAI with `request_id`, $x + y$, and "
            "[the API](https://example.com/api).\n\n"
            "score(text: str, threshold: float) -> bool\n"
            "request_id, trace_id, status\n"
            "pending | running | completed\n"
            "precision = tp / (tp + fp)"
        )
        reordered = (
            "precision = tp / (tp + fp)\n\n"
            "pending | running | completed\n"
            "request_id, trace_id, status\n"
            "score(text: str, threshold: float) -> bool\n"
            "参见 [API 接口](https://example.com/api)，并使用 $x + y$、"
            "`request_id` 和 OpenAI。"
        )

        self.assertTrue(
            translate_lessons.protected_content_is_preserved(source, reordered)
        )
        self.assertFalse(
            translate_lessons.protected_content_is_preserved(
                source, reordered.replace("`request_id`", "`request_key`")
            )
        )

    def test_provider_contract_preserves_order_and_table_columns(self) -> None:
        source = (
            "Run `alpha` before `beta`.\n\n"
            "| Name | Value |\n| --- | --- |\n| A | B |"
        )
        valid = (
            "Exécutez `alpha` avant `beta`.\n\n"
            "| Nom | Valeur |\n| --- | --- |\n| A | B |"
        )

        self.assertTrue(
            translate_lessons.translation_contract_is_preserved(
                source, valid, provider="openai"
            )
        )
        for corrupted in (
            valid.replace("`alpha` avant `beta`", "`beta` avant `alpha`"),
            valid.replace("| Nom | Valeur |", "| Nom |"),
            f"[{valid}](https://evil.example)",
            valid.replace("Exécutez", "# Exécutez"),
            valid.replace("Exécutez", "<script>Exécutez</script>"),
            valid.replace("avant", "avant $evil$"),
        ):
            with self.subTest(corrupted=corrupted):
                self.assertFalse(
                    translate_lessons.translation_contract_is_preserved(
                        source, corrupted, provider="openai"
                    )
                )

    def test_manual_reference_title_may_be_localized(self) -> None:
        cases = (
            (
                "Read [the guide][docs].\n\n[docs]: /guide \"Official guide\"",
                "阅读[指南][docs]。\n\n[docs]: /guide \"官方指南\"",
            ),
            (
                "Read [the guide][docs].\n\n[docs]:\n/guide\n\"Official guide\"",
                "阅读[指南][docs]。\n\n[docs]:\n/guide\n\"官方指南\"",
            ),
            (
                "Read [the guide][docs].\n\n[docs]: /guide '\nOfficial\nguide\n'",
                "阅读[指南][docs]。\n\n[docs]: /guide '\n官方\n指南\n'",
            ),
        )
        for source, translated in cases:
            with self.subTest(source=source):
                self.assertTrue(
                    translate_lessons.translation_contract_is_preserved(
                        source, translated, provider="manual"
                    )
                )
                self.assertFalse(
                    translate_lessons.translation_contract_is_preserved(
                        source, translated.replace("/guide", "/other"), provider="manual"
                    )
                )

    def test_reference_link_title_may_remain_but_trailing_prose_may_not(self) -> None:
        source = (
            "## Further Reading\n\n"
            "- [Attention Is All You Need](https://example.com/paper)\n"
            "- [Official Runtime Guide](https://example.com/guide) — "
            "This ordinary explanation still needs translation."
        )
        translated = source.replace("## Further Reading", "## 延伸阅读")

        self.assertEqual(
            ((4, 4, "This ordinary explanation still needs translation."),),
            translate_lessons.untranslated_fragments(source, translated),
        )

    def test_ordinary_link_label_outside_references_is_not_exempt(self) -> None:
        source = "Read [this ordinary English guide](https://example.com/guide)."

        self.assertEqual(
            ((1, 1, "Read this ordinary English guide ."),),
            translate_lessons.untranslated_fragments(source, source),
        )

    def test_repeated_generation_is_detected_but_code_is_ignored(self) -> None:
        text = """正常文字后面出现错误错误错误错误。

```python
label = "错误错误错误错误"
```
"""

        self.assertEqual(
            ((1, "错误错误错误错误"),),
            translate_lessons.suspicious_repetitions(text),
        )

    def test_incremental_table_translation_ignores_pipe_art_inside_fence(self) -> None:
        source = """```text
left | right
  |  (model-agnostic note)
```
| English explanation |
|---|
"""

        translated, count = translate_lessons.translate_untranslated_table_cells(
            source, source, lambda values: ["中文说明" for _ in values]
        )

        self.assertEqual(1, count)
        self.assertIn("left | right\n  |  (model-agnostic note)", translated)
        self.assertTrue(translated.endswith("| 中文说明 |\n|---|\n"))
        self.assertEqual((), translate_lessons.untranslated_table_cells(source, translated))

    def test_incremental_visible_translation_handles_bold_and_link_labels(self) -> None:
        source = (
            "- **Read the guide** at [the official documentation](https://example.com)."
        )
        current = source

        translated, count = translate_lessons.translate_untranslated_visible_fragments(
            source,
            current,
            lambda values: [
                {
                    "Read the guide": "阅读指南",
                    " at ": "，参见",
                    "the official documentation": "官方文档",
                    ".": "。",
                }.get(value, value)
                for value in values
            ],
        )

        self.assertEqual(3, count)
        self.assertEqual(
            "- **阅读指南** at [官方文档](https://example.com).", translated
        )
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )

    def test_table_inequality_is_not_misread_as_html(self) -> None:
        source = "| Rule | P(A) < 0.05 and P(B > 0.5) |"
        seen = []

        def hostile_translator(fragment):
            seen.append(fragment)
            return (
                fragment.replace("Rule", "规则")
                .replace("and", "且")
                .replace("P(", "CORRUPTED(")
                .replace("0.05", "9.99")
            )

        translated = translate_lessons.nllb_translate_doc(
            source, "zho_Hans", translate_fn=hostile_translator
        )

        self.assertEqual(["Rule", "and"], seen)
        self.assertEqual("| 规则 | P(A) < 0.05 且 P(B > 0.5) |", translated)
        self.assertFalse(
            translate_lessons.is_technical_fragment(
                "P(A) < 0.05 and P(B > 0.5)"
            )
        )
        self.assertTrue(translate_lessons.is_technical_fragment("P(A) < 0.05"))
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )

    def test_table_prose_after_inline_code_is_translated(self) -> None:
        source = (
            "| Bit depth | Resolution of each sample | "
            "`int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |"
        )
        replacements = {
            "Bit depth": "位深度",
            "Resolution of each sample": "每个样本的精度",
            "= 65,536 levels;": "= 65,536 个级别；",
            "= 24-bit precision in": "= 在以下范围内具有 24 位精度",
        }
        seen = []

        def translator(fragment):
            seen.append(fragment)
            return replacements.get(fragment, fragment)

        translated = translate_lessons.nllb_translate_doc(
            source, "hin_Deva", translate_fn=translator
        )

        self.assertIn("= 65,536 levels;", seen)
        self.assertIn("= 24-bit precision in", seen)
        for protected in ("`int16`", "`float32`", "`[-1, 1]`"):
            self.assertIn(protected, translated)
        self.assertEqual(
            translate_lessons.nllb_protected_segments(source),
            translate_lessons.nllb_protected_segments(translated),
        )
        self.assertEqual((), translate_lessons.untranslated_table_cells(source, translated))

    def test_mixed_equation_protects_complete_formula_before_prose(self) -> None:
        source = "precision = tp / (tp + fp), where higher precision matters"
        seen = []

        def hostile_translator(fragment):
            seen.append(fragment)
            return fragment.replace("where", "其中").replace("tp", "BROKEN")

        translated = translate_lessons.nllb_translate_doc(
            source, "zho_Hans", translate_fn=hostile_translator
        )

        self.assertEqual([", where higher precision matters"], seen)
        self.assertEqual(
            "precision = tp / (tp + fp), 其中 higher precision matters",
            translated,
        )
        self.assertTrue(
            translate_lessons.translation_contract_is_preserved(
                source, translated, provider="nllb"
            )
        )

    def test_formula_protection_does_not_cross_a_sentence_boundary(self) -> None:
        source = (
            "Sample at 10 kHz (Nyquist = 5 kHz). The 7 kHz tone is above "
            "Nyquist and folds down."
        )
        seen = []

        translated = translate_lessons.nllb_translate_doc(
            source, "hin_Deva", translate_fn=lambda fragment: seen.append(fragment) or fragment
        )

        self.assertIn("Nyquist = 5", [span.raw for span in translate_lessons.inline_spans(source)])
        self.assertTrue(any("The 7" in fragment for fragment in seen))
        self.assertNotIn(
            "Nyquist = 5 kHz). The 7 kHz tone is above Nyquist",
            [span.raw for span in translate_lessons.inline_spans(source)],
        )
        self.assertEqual(source, translated)
        self.assertFalse(
            translate_lessons.visible_plain_needs_translation("12.5 Hz")
        )
        self.assertTrue(
            translate_lessons.visible_plain_needs_translation("The 7")
        )

    def test_pipeline_version_invalidates_outputs_from_an_older_walker(self) -> None:
        entry = {
            "source_sha256": "source-hash",
            "output_sha256": "output-hash",
            "provider": "nllb",
            "model": translate_lessons.translation_model("nllb"),
            "pipeline_version": "2026-08-29.1",
        }

        self.assertFalse(
            translate_lessons.cache_entry_matches(
                entry, "source-hash", "nllb", "output-hash"
            )
        )

    def test_numeric_control_expression_is_protected_as_inline_math(self) -> None:
        for formula in (
            "$1 if x > 0$",
            "$1 if x > 0 else 0$",
            "$1 for x > 0$",
            "$1 where x > 0$",
            "$1 when x > 0$",
            "$1 otherwise 0$",
            "$1 \\cdot x$",
            "$1 \\le x$",
            "$1 \\text{if } x > 0$",
        ):
            with self.subTest(formula=formula):
                source = f"Use {formula} as the indicator."
                seen = []

                def hostile_translator(fragment):
                    seen.append(fragment)
                    return (
                        fragment.replace("Use", "使用")
                        .replace("indicator", "指示量")
                        .replace("x > 0", "x > 9")
                    )

                translated = translate_lessons.nllb_translate_doc(
                    source, "zho_Hans", translate_fn=hostile_translator
                )

                self.assertNotIn(formula[1:-1], " ".join(seen))
                self.assertIn(formula, translated)
                self.assertTrue(
                    translate_lessons.translation_contract_is_preserved(
                        source, translated, provider="nllb"
                    )
                )

    def test_dollar_variable_arithmetic_is_protected_as_one_expression(self) -> None:
        formula = "$input × 4000 + $output × 200"
        source = f"Synchronous pricing uses ({formula}) at full rates."
        seen = []

        def hostile_translator(fragment):
            seen.append(fragment)
            return fragment.replace("output", "输出")

        translated = translate_lessons.nllb_translate_doc(
            source, "zho_Hans", translate_fn=hostile_translator
        )

        self.assertNotIn("input", " ".join(seen))
        self.assertNotIn("output", " ".join(seen))
        self.assertIn(("inline-math", formula), translate_lessons.protected_inline_values(source))
        self.assertIn(formula, translated)
        self.assertTrue(
            translate_lessons.translation_contract_is_preserved(
                source, translated, provider="nllb"
            )
        )

    def test_echo_provider_remains_available_for_wiring_checks(self) -> None:
        source = "English wiring fixture."

        self.assertEqual(
            [], translate_lessons.translation_integrity_issues(
                source, source, "zh", "echo"
            )
        )
        self.assertNotIn("echo", translate_lessons.TRANSLATION_PROVIDERS)


if __name__ == "__main__":
    unittest.main()
