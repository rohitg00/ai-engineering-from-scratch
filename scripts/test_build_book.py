#!/usr/bin/env python3
"""Regression tests for the localized book transform contract."""

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parent.parent
BUILD_BOOK = ROOT / "scripts" / "build_book.py"
sys.path.insert(0, str(ROOT / "scripts"))
import build_book  # noqa: E402


TEST_VOLUME = {
    "number": 1,
    "slug": "foundations",
    "title": "Foundations",
    "subtitle": "From Scratch",
}
TEST_PHASE = "00-test-phase"
TEST_LESSON = "01-test-lesson"


def write_translation_fixture(
    root: Path,
    lang: str,
    *,
    source: str,
    translated: str,
    cache_entry: object,
    phase: str = TEST_PHASE,
) -> None:
    lesson = TEST_LESSON
    source_rel = f"phases/{phase}/{lesson}/docs/en.md"
    canonical = root / source_rel
    canonical.parent.mkdir(parents=True, exist_ok=True)
    canonical.write_text(source, encoding="utf-8")

    localized = (
        root
        / "i18n"
        / lang
        / "phases"
        / phase
        / lesson
        / "docs"
        / f"{lang}.md"
    )
    localized.parent.mkdir(parents=True, exist_ok=True)
    localized.write_text(translated, encoding="utf-8")

    cache = root / "i18n" / lang / ".cache" / f"{phase}.json"
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(
        json.dumps({source_rel: cache_entry}, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def manual_cache_entry(source: str, translated: str) -> dict[str, str]:
    return {
        "source_sha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
        "output_sha256": hashlib.sha256(translated.encode("utf-8")).hexdigest(),
        "provider": "manual",
    }


def run_transform_fixture(canonical: str, localized: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(BUILD_BOOK), "--test-transform-fixture"],
        cwd=ROOT,
        input=json.dumps({"canonical": canonical, "localized": localized}),
        capture_output=True,
        text=True,
        check=False,
    )


def run_transform_fixture_for_lang(
    canonical: str, localized: str, lang: str
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(BUILD_BOOK), "--test-transform-fixture"],
        cwd=ROOT,
        input=json.dumps(
            {"canonical": canonical, "localized": localized, "lang": lang}
        ),
        capture_output=True,
        text=True,
        check=False,
    )


class LocalizedHeadingStructureTest(unittest.TestCase):
    CANONICAL = """# Lesson
## Introduction
Intro.
## Ship It
Artifact.
## Exercises
Practice.
## Further Reading
References.
"""

    def test_missing_h2_prevents_build(self) -> None:
        canonical = """# Lesson
## Introduction
Intro.
## Ship It
Artifact.
## Exercises
Practice.
"""
        localized = """# 课程
## 简介
介绍。
## 练习
练习。
"""

        result = run_transform_fixture(canonical, localized)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("docs/zh.md", result.stderr)
        self.assertIn("expected 3 H2 headings, found 2", result.stderr)

    def test_extra_h2_prevents_build(self) -> None:
        canonical = """# Lesson
## Introduction
Intro.
## Ship It
Artifact.
## Exercises
Practice.
"""
        localized = """# 课程
## 简介
介绍。
## 额外章节
额外内容。
## 交付物
交付物。
## 练习
练习。
"""

        result = run_transform_fixture(canonical, localized)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("docs/zh.md", result.stderr)
        self.assertIn("expected 3 H2 headings, found 4", result.stderr)

    def test_equal_count_h2_replacement_prevents_role_misalignment(self) -> None:
        localized = """# 课程
## 简介
介绍。
## 新增章节
新增内容。
## 练习
练习。
## 延伸阅读
参考资料。
"""

        result = run_transform_fixture(self.CANONICAL, localized)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("H2 section mismatch", result.stderr)
        self.assertIn("Ship It", result.stderr)

    def test_reordered_h2_sections_prevent_role_misalignment(self) -> None:
        localized = """# 课程
## 简介
介绍。
## 练习
练习。
## 交付物
产物。
## 延伸阅读
参考资料。
"""

        result = run_transform_fixture(self.CANONICAL, localized)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("H2 section mismatch", result.stderr)
        self.assertIn("Ship It", result.stderr)

    def test_localized_h2_titles_keep_canonical_roles(self) -> None:
        localized = """# 课程
## 简介
介绍。
## 交付成果
产物。
## 练习
练习。
## 延伸阅读
参考资料。
"""

        result = run_transform_fixture(self.CANONICAL, localized)

        self.assertEqual(result.returncode, 0, result.stderr)
        transformed = json.loads(result.stdout)["transformed"]
        self.assertIn("This chapter ships an artifact.", transformed)
        self.assertNotIn("产物。", transformed)
        self.assertIn("## 练习", transformed)
        self.assertIn("Starter code and the lesson's working implementation", transformed)

    def test_published_language_aliases_preserve_special_roles(self) -> None:
        aliases = {
            "ar": (
                ("أرسله", "الأثاث المُرسل"),
                ("التمارين", "مختبر التدريب"),
            ),
            "es": (
                ("Envío", "Artículo enviado"),
                ("Los ejercicios", "Laboratorio de práctica"),
            ),
            "fr": (
                ("La faire partir", "Artéfact expédié"),
                ("Exercices", "Laboratoire de pratique"),
            ),
            "hi": (
                ("इसे भेजें", "शिप की गई कलाकृतियाँ"),
                ("व्यायाम", "अभ्यास प्रयोगशाला"),
            ),
            "tr": (
                ("Gönder", "Nakliye edilen Sanatlı"),
                ("Egzersizler", "Pratik Laboratuvar"),
            ),
            "pt": (
                ("Envia-o", "Artefato enviado"),
                ("Exercícios", "Laboratório de prática"),
            ),
            "vi": (
                ("Chuyển nó", "Hiện vật đã vận chuyển"),
                ("Các bài tập", "Phòng thực hành"),
            ),
            "zh": (
                (
                    "交付成果",
                    "交付物",
                    "交付它",
                    "交付上线",
                    "交付产物",
                    "产出",
                    "放进系统里",
                ),
                ("练习", "动手练习", "实践实验"),
            ),
        }
        for lang, (artifact_titles, practice_titles) in aliases.items():
            for artifact_title in artifact_titles:
                for practice_title in practice_titles:
                    with self.subTest(
                        lang=lang,
                        artifact_title=artifact_title,
                        practice_title=practice_title,
                    ):
                        localized = (
                            "# Localized\n"
                            "## Introduction\nIntro.\n"
                            f"## {artifact_title}\nArtifact.\n"
                            f"## {practice_title}\nPractice.\n"
                            "## Further Reading\nReferences.\n"
                        )

                        result = run_transform_fixture_for_lang(
                            self.CANONICAL, localized, lang
                        )

                        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unknown_language_requires_canonical_special_titles(self) -> None:
        localized = """# Localized
## Introduction
Intro.
## Translated Artifact
Artifact.
## Translated Practice
Practice.
## Further Reading
References.
"""

        result = run_transform_fixture_for_lang(
            self.CANONICAL, localized, "fixture"
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("H2 section mismatch", result.stderr)


class BookMetadataLanguageTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix="build-book-metadata-")
        self.addCleanup(self.temp_dir.cleanup)
        self.build_dir = Path(self.temp_dir.name) / "build"
        self.dist_dir = Path(self.temp_dir.name) / "dist"
        self.build_dir.mkdir()

    def render_metadata(self, book_lang: str) -> str:
        with (
            mock.patch.object(build_book, "BUILD", self.build_dir),
            mock.patch.object(build_book, "DIST", self.dist_dir),
            mock.patch.object(build_book, "BOOK_LANG", book_lang),
            mock.patch.object(build_book, "git_date", return_value="2026-08-29"),
            mock.patch.object(build_book.subprocess, "run") as run_pandoc,
        ):
            build_book.render(TEST_VOLUME, self.build_dir / "volume.md", chapters=1)

        run_pandoc.assert_called_once()
        return (self.build_dir / "foundations-meta.yaml").read_text(encoding="utf-8")

    def test_metadata_defaults_to_english(self) -> None:
        with mock.patch.object(build_book, "BUILD", self.build_dir):
            metadata_path = build_book.metadata(TEST_VOLUME)

        self.assertIn("lang: en\n", metadata_path.read_text(encoding="utf-8"))

    def test_render_uses_selected_language_in_epub_metadata(self) -> None:
        for book_lang in ("en", "zh"):
            with self.subTest(book_lang=book_lang):
                metadata_text = self.render_metadata(book_lang)
                lang_lines = [
                    line for line in metadata_text.splitlines() if line.startswith("lang:")
                ]
                self.assertEqual(lang_lines, [f"lang: {book_lang}"])


class BookTranslationCoverageTest(unittest.TestCase):
    def test_translation_coverage_counts_none_partial_and_complete(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase = "00-test"
            volume = {**TEST_VOLUME, "phases": [phase]}
            for lesson in ("01-first", "02-second"):
                canonical = root / "phases" / phase / lesson / "docs" / "en.md"
                canonical.parent.mkdir(parents=True, exist_ok=True)
                canonical.write_text(f"# {lesson}\n", encoding="utf-8")

            with mock.patch.object(build_book, "ROOT", root), mock.patch.object(
                build_book, "PHASES", root / "phases"
            ):
                self.assertEqual((0, 2), build_book.translation_coverage(volume, "zh"))
                for localized_count, lesson in enumerate(
                    ("01-first", "02-second"), start=1
                ):
                    translated = (
                        root
                        / "i18n"
                        / "zh"
                        / "phases"
                        / phase
                        / lesson
                        / "docs"
                        / "zh.md"
                    )
                    translated.parent.mkdir(parents=True, exist_ok=True)
                    translated.write_text(f"# {lesson} 中文\n", encoding="utf-8")
                    self.assertEqual(
                        (localized_count, 2),
                        build_book.translation_coverage(volume, "zh"),
                    )

    def test_english_build_does_not_require_translation_coverage(self) -> None:
        with mock.patch.object(build_book, "translation_coverage") as coverage:
            build_book.require_translation_coverage(TEST_VOLUME, "en")

        coverage.assert_not_called()

    def test_non_english_build_fails_when_no_lessons_are_localized(self) -> None:
        with mock.patch.object(
            build_book, "translation_coverage", return_value=(0, 12)
        ), self.assertRaisesRegex(
            SystemExit, "no zh lesson translations found"
        ):
            build_book.require_translation_coverage(TEST_VOLUME, "zh")

    def test_non_english_build_fails_on_partial_translation_coverage(self) -> None:
        with mock.patch.object(
            build_book, "translation_coverage", return_value=(9, 12)
        ), self.assertRaisesRegex(
            SystemExit, r"incomplete zh translation coverage \(9/12\)"
        ):
            build_book.require_translation_coverage(TEST_VOLUME, "zh")

    def test_complete_translation_coverage_is_accepted(self) -> None:
        with mock.patch.object(
            build_book, "translation_coverage", return_value=(12, 12)
        ):
            build_book.require_translation_coverage(TEST_VOLUME, "zh")


class BookTranslationProvenanceTest(unittest.TestCase):
    MANUAL_SOURCE = "# English title\n\n## Build It\n\nExplain the source.\n"
    MANUAL_TRANSLATION = "# 中文标题\n\n## 构建它\n\n解释源内容。\n"

    def test_english_build_skips_translation_provenance(self) -> None:
        with mock.patch.dict(sys.modules, {"audit_translations": None}):
            build_book.require_translation_provenance([TEST_VOLUME], "en")

    def test_manual_bare_source_hash_cache_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_translation_fixture(
                root,
                "zh",
                source=self.MANUAL_SOURCE,
                translated=self.MANUAL_TRANSLATION,
                cache_entry=hashlib.sha256(
                    self.MANUAL_SOURCE.encode("utf-8")
                ).hexdigest(),
            )

            with mock.patch.object(
                build_book, "ROOT", root
            ), self.assertRaisesRegex(SystemExit, "cache-provenance"):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], "zh"
                )

    def test_structured_manual_provenance_cache_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_translation_fixture(
                root,
                "zh",
                source=self.MANUAL_SOURCE,
                translated=self.MANUAL_TRANSLATION,
                cache_entry=manual_cache_entry(
                    self.MANUAL_SOURCE, self.MANUAL_TRANSLATION
                ),
            )

            with mock.patch.object(build_book, "ROOT", root):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], "zh"
                )

    def test_manual_output_hash_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            entry = manual_cache_entry(self.MANUAL_SOURCE, self.MANUAL_TRANSLATION)
            entry["output_sha256"] = "0" * 64
            write_translation_fixture(
                root,
                "zh",
                source=self.MANUAL_SOURCE,
                translated=self.MANUAL_TRANSLATION,
                cache_entry=entry,
            )

            with mock.patch.object(
                build_book, "ROOT", root
            ), self.assertRaisesRegex(SystemExit, "cache-output-hash"):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], "zh"
                )

    def test_legacy_manual_cache_fails_before_any_build_output(self) -> None:
        volumes = [{**TEST_VOLUME, "phases": [TEST_PHASE]}]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            build_dir = root / "book" / "_build"
            dist_dir = root / "dist" / "book"
            write_translation_fixture(
                root,
                "zh",
                source=self.MANUAL_SOURCE,
                translated=self.MANUAL_TRANSLATION,
                cache_entry=hashlib.sha256(
                    self.MANUAL_SOURCE.encode("utf-8")
                ).hexdigest(),
            )

            with (
                mock.patch.object(build_book, "ROOT", root),
                mock.patch.object(build_book, "PHASES", root / "phases"),
                mock.patch.object(build_book, "BUILD", build_dir),
                mock.patch.object(build_book, "DIST", dist_dir),
                mock.patch.object(build_book, "CONFIG", {"volumes": volumes}),
                mock.patch.object(build_book, "BOOK_LANG", "en"),
                mock.patch.object(build_book, "check_phases"),
                mock.patch.object(build_book, "assemble") as assemble,
                mock.patch.object(build_book, "render") as render,
                mock.patch.object(
                    sys,
                    "argv",
                    ["build_book.py", "--lang", "zh", "--assemble-only"],
                ),
                self.assertRaisesRegex(SystemExit, "cache-provenance"),
            ):
                build_book.main()

            assemble.assert_not_called()
            render.assert_not_called()
            self.assertFalse(build_dir.exists())
            self.assertFalse(dist_dir.exists())

    def test_machine_provenance_cache_is_accepted(self) -> None:
        import audit_translations as translation_audit

        lang = "es"
        translated = "# Título\n\n## Build It\n\nExplica la fuente.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_translation_fixture(
                root,
                lang,
                source=self.MANUAL_SOURCE,
                translated=translated,
                cache_entry={
                    "source_sha256": hashlib.sha256(
                        self.MANUAL_SOURCE.encode("utf-8")
                    ).hexdigest(),
                    "output_sha256": hashlib.sha256(
                        translated.encode("utf-8")
                    ).hexdigest(),
                    "provider": "nllb",
                    "model": "fixture-model",
                    "pipeline_version": (
                        translation_audit.TRANSLATION_PIPELINE_VERSION
                    ),
                },
            )

            with mock.patch.object(build_book, "ROOT", root):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], lang
                )

    def test_machine_cache_missing_key_fails_with_audit_report(self) -> None:
        lang = "es"
        translated = "# Título\n\n## Build It\n\nExplica la fuente.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_translation_fixture(
                root,
                lang,
                source=self.MANUAL_SOURCE,
                translated=translated,
                cache_entry={},
            )
            cache = root / "i18n" / lang / ".cache" / f"{TEST_PHASE}.json"
            cache.write_text("{}\n", encoding="utf-8")

            with mock.patch.object(
                build_book, "ROOT", root
            ), self.assertRaisesRegex(SystemExit, "cache-key-missing"):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], lang
                )

    def test_machine_cache_missing_file_fails_with_audit_report(self) -> None:
        lang = "es"
        translated = "# Título\n\n## Build It\n\nExplica la fuente.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_translation_fixture(
                root,
                lang,
                source=self.MANUAL_SOURCE,
                translated=translated,
                cache_entry={},
            )
            cache = root / "i18n" / lang / ".cache" / f"{TEST_PHASE}.json"
            cache.unlink()

            with mock.patch.object(
                build_book, "ROOT", root
            ), self.assertRaisesRegex(SystemExit, "cache-missing"):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], lang
                )

    def test_machine_output_hash_mismatch_is_rejected(self) -> None:
        import audit_translations as translation_audit

        lang = "es"
        translated = "# Título\n\n## Build It\n\nExplica la fuente.\n"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_translation_fixture(
                root,
                lang,
                source=self.MANUAL_SOURCE,
                translated=translated,
                cache_entry={
                    "source_sha256": hashlib.sha256(
                        self.MANUAL_SOURCE.encode("utf-8")
                    ).hexdigest(),
                    "output_sha256": "0" * 64,
                    "provider": "nllb",
                    "model": "fixture-model",
                    "pipeline_version": (
                        translation_audit.TRANSLATION_PIPELINE_VERSION
                    ),
                },
            )

            with mock.patch.object(
                build_book, "ROOT", root
            ), self.assertRaisesRegex(SystemExit, "cache-output-hash"):
                build_book.require_translation_provenance(
                    [{**TEST_VOLUME, "phases": [TEST_PHASE]}], lang
                )

    def test_complete_but_stale_cache_fails_before_any_build_output(self) -> None:
        fresh_phase = "00-fresh-phase"
        stale_phase = "01-stale-phase"
        volumes = [
            {**TEST_VOLUME, "slug": "fresh", "phases": [fresh_phase]},
            {**TEST_VOLUME, "slug": "stale", "phases": [stale_phase]},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            build_dir = root / "book" / "_build"
            dist_dir = root / "dist" / "book"
            fresh_entry = manual_cache_entry(
                self.MANUAL_SOURCE, self.MANUAL_TRANSLATION
            )
            stale_entry = dict(fresh_entry)
            stale_entry["source_sha256"] = "0" * 64
            write_translation_fixture(
                root,
                "zh",
                source=self.MANUAL_SOURCE,
                translated=self.MANUAL_TRANSLATION,
                cache_entry=fresh_entry,
                phase=fresh_phase,
            )
            write_translation_fixture(
                root,
                "zh",
                source=self.MANUAL_SOURCE,
                translated=self.MANUAL_TRANSLATION,
                cache_entry=stale_entry,
                phase=stale_phase,
            )

            with (
                mock.patch.object(build_book, "ROOT", root),
                mock.patch.object(build_book, "PHASES", root / "phases"),
                mock.patch.object(build_book, "BUILD", build_dir),
                mock.patch.object(build_book, "DIST", dist_dir),
                mock.patch.object(build_book, "CONFIG", {"volumes": volumes}),
                mock.patch.object(build_book, "BOOK_LANG", "en"),
                mock.patch.object(build_book, "check_phases"),
                mock.patch.object(build_book, "assemble") as assemble,
                mock.patch.object(build_book, "render") as render,
                mock.patch.object(
                    sys,
                    "argv",
                    ["build_book.py", "--lang", "zh", "--assemble-only"],
                ),
                self.assertRaisesRegex(SystemExit, "is stale"),
            ):
                build_book.main()

            assemble.assert_not_called()
            render.assert_not_called()
            self.assertFalse(build_dir.exists())
            self.assertFalse(dist_dir.exists())


if __name__ == "__main__":
    unittest.main()
