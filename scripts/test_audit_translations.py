#!/usr/bin/env python3
"""Deterministic tests for the translation completeness auditor."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

import audit_translations  # noqa: E402


SOURCE_REL = "phases/00-test-phase/01-test-lesson/docs/en.md"
TARGET_REL = "i18n/zh/phases/00-test-phase/01-test-lesson/docs/zh.md"
CACHE_REL = "i18n/zh/.cache/00-test-phase.json"

ENGLISH = """# English title

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 0
**Time:** ~10 minutes
**Related:** Phase 1

## Build It

This paragraph should be translated.

```python
print(\"leave this alone\")
```

| Name | Value |
| --- | --- |
| alpha | one |

<section>
</section>
"""

CHINESE = """# 中文标题

**Type:** 构建
**Language:** Python
**Prerequisites:** 阶段 0
**Time:** 约 10 分钟
**Related:** 阶段 1

## 构建它

这一段应该翻译。

```python
print(\"leave this alone\")
```

| 名称 | 值 |
| --- | --- |
| 阿尔法 | 一 |

<section>
</section>
"""


def write(path: Path, content: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content, encoding="utf-8")


def source_digest(text: str = ENGLISH) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def output_digest(text: str = CHINESE) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def manual_cache_entry(
    source: str = ENGLISH, translated: str = CHINESE
) -> dict[str, str]:
    return {
        "source_sha256": source_digest(source),
        "output_sha256": output_digest(translated),
        "provider": audit_translations.MANUAL_TRANSLATION_PROVIDER,
    }


def make_valid_tree(root: Path, *, combined_cache: bool = False) -> None:
    write(root / SOURCE_REL, ENGLISH)
    write(root / TARGET_REL, CHINESE)
    write(root / "i18n/zh/README.md", "# 中文课程\n")
    cache_rel = "i18n/zh/.translate-cache.json" if combined_cache else CACHE_REL
    write(
        root / cache_rel,
        json.dumps({SOURCE_REL: manual_cache_entry()}, ensure_ascii=False) + "\n",
    )


def audit_local(root: Path) -> audit_translations.AuditResult:
    return audit_translations.audit_translations(
        root, "zh", audit_translations.LocalTranslationSource(root)
    )


def issue_rules(result: audit_translations.AuditResult) -> set[str]:
    return {issue.rule for issue in result.issues}


class TranslationAuditTest(unittest.TestCase):
    def test_cli_rejects_unknown_source_and_traversal_languages_before_source_access(self) -> None:
        for lang in ("unknown", "en", "x/../zh", "../../"):
            with self.subTest(lang=lang), mock.patch.object(
                audit_translations.GitTranslationSource, "list_files"
            ) as list_files:
                with self.assertRaises(SystemExit):
                    audit_translations.main(["--lang", lang])
                list_files.assert_not_called()

    def test_cli_allows_registered_manual_language_for_read_only_audit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)

            result = audit_translations.main(
                [
                    "--repo-root",
                    str(root),
                    "--lang",
                    "zh",
                    "--translation-root",
                    str(root),
                ]
            )

            self.assertEqual(0, result)

    def test_cli_rejects_invalid_or_missing_phase_before_source_access(self) -> None:
        for phase in ("../../", "00-missing-phase", "00-valid/../other"):
            with self.subTest(phase=phase), mock.patch.object(
                audit_translations.GitTranslationSource, "list_files"
            ) as list_files:
                with self.assertRaises(SystemExit):
                    audit_translations.main(
                        ["--lang", "zh", "--phase", phase]
                    )
                list_files.assert_not_called()

    def test_local_source_rejects_symlink_escape(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "root"
            outside = Path(tmp) / "outside"
            root.mkdir()
            outside.mkdir()
            (root / "i18n").symlink_to(outside, target_is_directory=True)
            source = audit_translations.LocalTranslationSource(root)

            with self.assertRaisesRegex(
                audit_translations.TranslationSourceError, "escapes local root"
            ):
                source.list_files("i18n/zh")

    def test_clean_local_tree_with_phase_cache_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)

            result = audit_local(root)

            self.assertEqual(result.issues, [])
            self.assertEqual(result.canonical_count, 1)
            self.assertEqual(result.found_translation_count, 1)
            self.assertEqual(result.checked_translation_count, 1)
            self.assertEqual(result.cache_file_count, 1)
            self.assertEqual(result.found_cache_key_count, 1)
            report = audit_translations.render_report(result)
            self.assertIn("1 found / 1 expected (1 content-checked)", report)
            self.assertIn("PASS: translation audit clean", report)

    def test_combined_local_cache_is_supported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root, combined_cache=True)

            result = audit_local(root)

            self.assertEqual(result.issues, [])
            self.assertEqual(result.cache_file_count, 1)

    def test_combined_and_sharded_cache_layouts_cannot_coexist(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(
                root / "i18n/zh/.translate-cache.json",
                json.dumps({SOURCE_REL: source_digest()}) + "\n",
            )

            result = audit_local(root)

            self.assertIn("cache-layout-conflict", issue_rules(result))

    def test_sharded_cache_rejects_keys_from_another_phase(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(
                root / CACHE_REL,
                json.dumps(
                    {"phases/99-other/01-extra/docs/en.md": source_digest()}
                )
                + "\n",
            )

            result = audit_local(root)

            self.assertIn("cache-shard-key", issue_rules(result))

    def test_phase_scope_rejects_foreign_key_inside_selected_shard(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            cache_path = root / CACHE_REL
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            cache["phases/99-other/01-extra/docs/en.md"] = source_digest()
            write(cache_path, json.dumps(cache) + "\n")

            result = audit_translations.audit_translations(
                root,
                "zh",
                audit_translations.LocalTranslationSource(root),
                "00-test-phase",
            )

            self.assertIn("cache-shard-key", issue_rules(result))

    def test_phase_scope_ignores_other_phase_files_and_caches(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(
                root / "i18n/zh/phases/99-other/01-extra/docs/zh.md",
                CHINESE,
            )
            write(
                root / "i18n/zh/.cache/99-other.json",
                json.dumps({"phases/99-other/01-extra/docs/en.md": "0" * 64}) + "\n",
            )

            result = audit_translations.audit_translations(
                root,
                "zh",
                audit_translations.LocalTranslationSource(root),
                "00-test-phase",
            )

            self.assertEqual(result.issues, [])
            self.assertEqual(result.canonical_count, 1)
            self.assertEqual(result.found_translation_count, 1)
            self.assertEqual(result.cache_file_count, 1)

    def test_phase_scope_filters_a_combined_cache(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root, combined_cache=True)
            cache_path = root / "i18n/zh/.translate-cache.json"
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            cache["phases/99-other/01-extra/docs/en.md"] = "0" * 64
            write(cache_path, json.dumps(cache) + "\n")

            result = audit_translations.audit_translations(
                root,
                "zh",
                audit_translations.LocalTranslationSource(root),
                "00-test-phase",
            )

            self.assertEqual(result.issues, [])
            self.assertEqual(result.found_cache_key_count, 1)

    def test_exact_translation_paths_and_cache_keys_are_required(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            (root / TARGET_REL).unlink()
            extra_source = "phases/00-test-phase/99-extra/docs/en.md"
            extra_target = "i18n/zh/phases/00-test-phase/99-extra/docs/zh.md"
            write(root / extra_target, CHINESE)
            write(
                root / CACHE_REL,
                json.dumps({extra_source: "0" * 64}) + "\n",
            )

            result = audit_local(root)

            self.assertTrue(
                {
                    "translation-missing",
                    "translation-extra",
                    "cache-key-missing",
                    "cache-key-extra",
                }.issubset(issue_rules(result))
            )
            report = audit_translations.render_report(result)
            self.assertIn(TARGET_REL, report)
            self.assertIn(extra_target, report)
            self.assertIn("FAIL: translation audit found errors", report)

    def test_cache_hash_must_be_current_sha256(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            stale_entry = manual_cache_entry()
            stale_entry["source_sha256"] = "0" * 64
            write(root / CACHE_REL, json.dumps({SOURCE_REL: stale_entry}) + "\n")

            stale = audit_local(root)
            self.assertIn("cache-hash", issue_rules(stale))
            self.assertIn("is stale", audit_translations.render_report(stale))

            malformed_entry = manual_cache_entry()
            malformed_entry["source_sha256"] = "not-a-sha"
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: malformed_entry}) + "\n",
            )
            malformed = audit_local(root)
            self.assertIn("cache-hash", issue_rules(malformed))
            self.assertIn("invalid SHA-256", audit_translations.render_report(malformed))

    def test_provider_aware_cache_selects_whole_document_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Use `alpha` here.\nUse `beta` there.",
            )
            translated = source.replace(
                "Use `alpha` here.\nUse `beta` there.",
                "Utilisez `alpha` ici et `beta` là.",
            )
            write(root / SOURCE_REL, source)
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(source),
                            "provider": "openai",
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertNotIn("cache-hash", issue_rules(result))
            self.assertNotIn("cache-provider", issue_rules(result))
            self.assertNotIn("structure-protected-content", issue_rules(result))

            write(root / target_rel, translated.replace("`alpha`", "`changed`"))
            corrupted = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )
            self.assertIn(
                "structure-protected-content", issue_rules(corrupted)
            )

    def test_manual_cache_binds_source_and_output_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(
                root / CACHE_REL,
                json.dumps(
                    {
                        SOURCE_REL: manual_cache_entry()
                    }
                )
                + "\n",
            )

            result = audit_local(root)

            self.assertEqual([], result.issues)

            cache_path = root / CACHE_REL
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            cache[SOURCE_REL]["output_sha256"] = "0" * 64
            write(cache_path, json.dumps(cache) + "\n")

            mismatched = audit_local(root)

            self.assertIn("cache-output-hash", issue_rules(mismatched))

    def test_manual_cache_rejects_legacy_bare_source_hash(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: source_digest()}) + "\n",
            )

            result = audit_local(root)

            self.assertIn("cache-provenance", issue_rules(result))
            self.assertIn(
                "structured source/output provenance is required",
                audit_translations.render_report(result),
            )

    def test_manual_cache_requires_all_provenance_fields(self) -> None:
        for field in ("source_sha256", "output_sha256", "provider"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                make_valid_tree(root)
                entry = manual_cache_entry()
                del entry[field]
                write(root / CACHE_REL, json.dumps({SOURCE_REL: entry}) + "\n")

                result = audit_local(root)

                self.assertIn("cache-provenance", issue_rules(result))

    def test_manual_cache_requires_manual_provider(self) -> None:
        for provider in ("nllb", "openai", "unknown", None):
            with self.subTest(provider=provider), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                make_valid_tree(root)
                entry = manual_cache_entry()
                entry["provider"] = provider
                write(root / CACHE_REL, json.dumps({SOURCE_REL: entry}) + "\n")

                result = audit_local(root)

                self.assertIn("cache-provider", issue_rules(result))

    def test_machine_cache_requires_complete_current_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, ENGLISH)
            write(root / target_rel, CHINESE)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(),
                            "provider": "nllb",
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertIn("cache-provenance", issue_rules(result))

            complete = {
                "source_sha256": source_digest(),
                "output_sha256": hashlib.sha256(CHINESE.encode()).hexdigest(),
                "provider": "nllb",
                "model": "facebook/nllb-200-distilled-600M",
                "pipeline_version": audit_translations.TRANSLATION_PIPELINE_VERSION,
            }
            write(root / cache_rel, json.dumps({SOURCE_REL: complete}) + "\n")
            valid = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )
            self.assertNotIn("cache-provenance", issue_rules(valid))
            self.assertNotIn("cache-pipeline", issue_rules(valid))

    def test_machine_cache_rejects_null_or_invalid_output_hash(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, ENGLISH)
            write(root / target_rel, CHINESE)
            write(root / "i18n/zz/README.md", "# Test\n")
            for output_hash in (None, "not-a-sha256"):
                with self.subTest(output_hash=output_hash):
                    write(
                        root / cache_rel,
                        json.dumps(
                            {
                                SOURCE_REL: {
                                    "source_sha256": source_digest(),
                                    "output_sha256": output_hash,
                                    "provider": "nllb",
                                    "model": "facebook/nllb-200-distilled-600M",
                                    "pipeline_version": audit_translations.TRANSLATION_PIPELINE_VERSION,
                                }
                            }
                        )
                        + "\n",
                    )

                    result = audit_translations.audit_translations(
                        root, "zz", audit_translations.LocalTranslationSource(root)
                    )

                    self.assertIn("cache-output-hash", issue_rules(result))

    def test_machine_translation_without_cache_key_reports_instead_of_crashing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, ENGLISH)
            write(root / target_rel, CHINESE)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(root / cache_rel, "{}\n")

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertIn("cache-key-missing", issue_rules(result))

    def test_machine_non_chinese_audit_rejects_missing_and_untranslated_prose(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "French", "nllb": "fra_Latn"}},
        ):
            root = Path(tmp)
            source = (
                "# Example\n\n"
                "This first paragraph must be translated.\n\n"
                "This second paragraph remains untranslated.\n\n"
                "This third paragraph must also be translated.\n\n"
                "| Detail | Meaning |\n|---|---|\n"
                "| first | This table explanation must be translated |"
            )
            translated = (
                "# Exemple\n\n"
                "Ce premier paragraphe est traduit.\n\n"
                "This second paragraph remains untranslated.\n\n"
                "| Détail | Signification |\n|---|---|\n"
                "| premier | This table explanation must be translated |"
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Français\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(source),
                            "output_sha256": hashlib.sha256(translated.encode()).hexdigest(),
                            "provider": "openai",
                            "model": "reviewed-model",
                            "pipeline_version": audit_translations.TRANSLATION_PIPELINE_VERSION,
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertTrue(
                {
                    "translation-missing-prose",
                    "translation-untranslated-prose",
                    "translation-untranslated-table",
                }.issubset(issue_rules(result))
            )
            self.assertNotIn("translation-no-han", issue_rules(result))

    def test_provider_aware_cache_rejects_unknown_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(
                root / CACHE_REL,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(),
                            "provider": "unknown",
                        }
                    }
                )
                + "\n",
            )

            result = audit_local(root)

            self.assertIn("cache-provider", issue_rules(result))

    def test_machine_language_cache_cannot_claim_manual_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, ENGLISH)
            write(root / target_rel, CHINESE)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(),
                            "provider": "manual",
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertIn("cache-provider", issue_rules(result))

    def test_machine_language_unknown_provider_falls_back_to_strict_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Use **safe mode** now.",
            )
            translated = source.replace(
                "Use **safe mode** now.", "Utilisez le mode sûr maintenant."
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(source),
                            "provider": "unknown",
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertIn("cache-provider", issue_rules(result))
            self.assertIn("structure-protected-content", issue_rules(result))

    def test_structured_nllb_cache_uses_full_strict_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Use **safe mode** now.",
            )
            translated = source.replace(
                "Use **safe mode** now.", "Utilisez le mode sûr maintenant."
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(source),
                            "provider": "nllb",
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertNotIn("cache-provider", issue_rules(result))
            self.assertIn("structure-protected-content", issue_rules(result))

    def test_structured_nllb_cache_uses_line_contract_not_api_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "First uses `alpha`.\nSecond uses `beta`.",
            )
            translated = source.replace(
                "First uses `alpha`.\nSecond uses `beta`.",
                "Première ligne.\nDeuxième ligne `alpha` puis `beta`.",
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(source),
                            "provider": "nllb",
                        }
                    }
                )
                + "\n",
            )

            self.assertTrue(
                audit_translations.translation_contract_is_preserved(
                    source, translated, provider="openai"
                )
            )
            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )
            self.assertIn("structure-protected-content", issue_rules(result))

    def test_cache_hash_matches_translator_newline_normalization(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            crlf_english = ENGLISH.replace("\n", "\r\n")
            write(root / SOURCE_REL, crlf_english.encode("utf-8"))
            # translate_lessons.py calls read_text() before hashing, which
            # normalizes CRLF to LF. The auditor must use the same contract.
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry()}) + "\n",
            )

            result = audit_local(root)

            self.assertEqual(result.issues, [])

    def test_translation_content_guards(self) -> None:
        cases: list[tuple[str, str | bytes, str]] = [
            ("invalid UTF-8", b"\xff\xfe", "translation-utf8"),
            ("empty", " \n\t", "translation-empty"),
            ("sentinel", CHINESE + "\n\u2063PROTECT12\u2063\n", "translation-sentinel"),
            ("bare sentinel", CHINESE + "\nPROTECT12\n", "translation-sentinel"),
            ("broken sentinel", CHINESE + "\n\u2063PROTECT\n", "translation-sentinel"),
            ("isolated sentinel marker", CHINESE + "\n\u2063\n", "translation-sentinel"),
            ("identical English", ENGLISH, "translation-identical"),
            ("no Han", ENGLISH.replace("English title", "Other title"), "translation-no-han"),
        ]
        for label, content, expected_rule in cases:
            with self.subTest(label=label), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                make_valid_tree(root)
                write(root / TARGET_REL, content)

                result = audit_local(root)

                self.assertIn(expected_rule, issue_rules(result))

    def test_metadata_values_may_be_localized_but_keys_may_not(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)

            localized_values = audit_local(root)
            self.assertNotIn("structure-protected-content", issue_rules(localized_values))

            write(root / TARGET_REL, CHINESE.replace("**Related:**", "**相关课程：**"))
            localized_key = audit_local(root)
            self.assertIn("structure-metadata", issue_rules(localized_key))

    def test_substantive_untranslated_prose_is_reported_with_line_numbers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            incomplete = CHINESE.replace(
                "这一段应该翻译。", "This paragraph should be translated."
            )
            write(root / TARGET_REL, incomplete)

            result = audit_local(root)

            self.assertIn("translation-untranslated-prose", issue_rules(result))
            report = audit_translations.render_report(result)
            self.assertIn("target line 11 retains source line 11", report)
            self.assertIn("This paragraph should be translated.", report)

    def test_missing_substantive_visible_paragraph_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "This first paragraph should be translated.\n\n"
                "This trailing paragraph must not disappear.",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。", "第一段已经翻译。"
            )
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, translated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, translated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertIn("translation-missing-prose", issue_rules(result))
            self.assertIn(
                "source line 13", audit_translations.render_report(result)
            )

    def test_short_colon_lead_in_may_be_merged_with_following_paragraph(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Two operational consequences:\n\n"
                "The generated artifact remains deterministic.",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。",
                "这会带来两个实际影响：生成的产物仍然是确定性的。",
            )
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, translated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, translated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertNotIn("translation-missing-prose", issue_rules(result))

    def test_markdown_structure_is_preserved(self) -> None:
        broken = """# 中文标题

### 错误的标题级别

这一段已经翻译。

~~~python
print(\"leave this alone\")
~~~

| 名称 | 值 |
| --- | --- |

<section>
"""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(root / TARGET_REL, broken)

            result = audit_local(root)

            self.assertTrue(
                {
                    "structure-headings",
                    "structure-fences",
                    "structure-tables",
                    "structure-html",
                }.issubset(issue_rules(result))
            )

    def test_manual_audit_rejects_collapsed_table_columns(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            collapsed = CHINESE.replace(
                "| 名称 | 值 |\n| --- | --- |\n| 阿尔法 | 一 |",
                "| 合并后的列 |\n| --- |\n| 只有一列 |",
            )
            write(root / TARGET_REL, collapsed)

            result = audit_local(root)

            self.assertIn("structure-table-columns", issue_rules(result))

    def test_manual_audit_rejects_equal_count_short_filler_prose(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = (
                "# Example\n\n"
                "First substantive source paragraph has important facts.\n\n"
                "Second substantive source paragraph has other facts."
            )
            filler = "# 示例\n\n第一段重要事实。\n\n这是完全无关的新增中文段落。"
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, filler)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, filler)}) + "\n",
            )

            result = audit_local(root)

            self.assertIn("translation-missing-prose", issue_rules(result))

    def test_protected_content_must_be_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(root / TARGET_REL, CHINESE.replace("leave this alone", "changed"))

            result = audit_local(root)

            self.assertIn("structure-protected-content", issue_rules(result))

    def test_human_translation_may_reorder_prose_around_protected_content(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Use `request_id` with $x + y$ and [the API](https://example.com).",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。",
                "参见 [API](https://example.com)，再用 $x + y$ 与 `request_id`。",
            )
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, translated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, translated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertNotIn("structure-protected-content", issue_rules(result))

    def test_human_translation_must_preserve_technical_content(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Keep the identifier `request_id`.",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。",
                "保留标识符 `request_key`。",
            )
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, translated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, translated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertIn("structure-protected-content", issue_rules(result))

    def test_machine_translation_keeps_strict_protected_content_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Use `first` and then `second`.",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。",
                "先用 `second`，再用 `first`。",
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps(
                    {
                        SOURCE_REL: {
                            "source_sha256": source_digest(source),
                            "provider": "nllb",
                        }
                    }
                )
                + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertIn("structure-protected-content", issue_rules(result))

    def test_machine_translation_keeps_protected_content_on_source_line(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "First uses `alpha`.\nSecond uses `beta`.",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。",
                "Première ligne.\nDeuxième ligne `alpha` puis `beta`.",
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / target_rel, translated)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps({SOURCE_REL: source_digest(source)}) + "\n",
            )

            result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )

            self.assertIn("structure-protected-content", issue_rules(result))

    def test_machine_translation_uses_source_side_protected_contracts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(
            audit_translations.LANGUAGE_REGISTRY,
            {"zz": {"code": "zz", "name": "Test", "nllb": "eng_Latn"}},
        ):
            root = Path(tmp)
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                "Use GPU processing with `first` before `second`.",
            )
            target_rel = TARGET_REL.replace("i18n/zh/", "i18n/zz/").replace(
                "/zh.md", "/zz.md"
            )
            cache_rel = CACHE_REL.replace("i18n/zh/", "i18n/zz/")
            write(root / SOURCE_REL, source)
            write(root / "i18n/zz/README.md", "# Test\n")
            write(
                root / cache_rel,
                json.dumps({SOURCE_REL: source_digest(source)}) + "\n",
            )

            valid = source.replace(
                "Use GPU processing with `first` before `second`.",
                "新增 `$target_shape$`，在 GPU 模式下依次使用 `first` 和 `second`.",
            )
            write(root / target_rel, valid)
            valid_result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )
            self.assertNotIn(
                "structure-protected-content", issue_rules(valid_result)
            )

            write(root / target_rel, valid.replace("GPU", "CPU"))
            corrupt_result = audit_translations.audit_translations(
                root, "zz", audit_translations.LocalTranslationSource(root)
            )
            self.assertIn(
                "structure-protected-content", issue_rules(corrupt_result)
            )

    def test_translated_table_text_passes_when_structure_and_literals_match(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = ENGLISH.replace(
                "| alpha | one |", "| `alpha` | [read docs](https://example.com) |"
            )
            translated = CHINESE.replace(
                "| 阿尔法 | 一 |", "| `alpha` | [阅读文档](https://example.com) |"
            )
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, translated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, translated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertEqual(result.issues, [])

    def test_untranslated_table_prose_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            untranslated = CHINESE.replace(
                "| 名称 | 值 |", "| 名称 | This sentence explains the value |"
            )
            source = ENGLISH.replace(
                "| Name | Value |", "| Name | This sentence explains the value |"
            )
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, untranslated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, untranslated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertIn("translation-untranslated-table", issue_rules(result))

    def test_extra_blank_line_does_not_hide_untranslated_prose(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            incomplete = CHINESE.replace(
                "这一段应该翻译。",
                "\nThis paragraph should be translated.",
            )
            write(root / TARGET_REL, incomplete)

            result = audit_local(root)

            self.assertIn("translation-untranslated-prose", issue_rules(result))
            self.assertIn(
                "target line 12 retains source line 11",
                audit_translations.render_report(result),
            )

    def test_balanced_doi_link_target_is_compared_as_one_protected_value(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            doi = "https://doi.org/10.1016/0004-3702(71)90002-6"
            source = ENGLISH.replace(
                "This paragraph should be translated.",
                f"Read [the original paper]({doi}).",
            )
            translated = CHINESE.replace(
                "这一段应该翻译。",
                f"阅读[原始论文]({doi})。",
            )
            make_valid_tree(root)
            write(root / SOURCE_REL, source)
            write(root / TARGET_REL, translated)
            write(
                root / CACHE_REL,
                json.dumps({SOURCE_REL: manual_cache_entry(source, translated)})
                + "\n",
            )

            result = audit_local(root)

            self.assertNotIn("structure-protected-content", issue_rules(result))

    def test_repeated_chinese_generation_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(root / TARGET_REL, CHINESE + "\n错误错误错误错误\n")

            result = audit_local(root)

            self.assertIn("translation-repetition", issue_rules(result))

    def test_structure_scanner_ignores_markdown_like_code_lines(self) -> None:
        text = """# Real heading

```text
## Not a heading
| not | a table |
<not-html>
```

| real | table |
<real-html>
"""
        structure = audit_translations.markdown_structure(text)
        self.assertEqual(structure.heading_levels, (1,))
        self.assertEqual(structure.fence_lines, ("```text", "```"))
        self.assertEqual(structure.table_line_count, 1)
        self.assertEqual(structure.raw_html_line_count, 1)

    def test_default_origin_git_ref_is_audited_without_checkout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            env = os.environ.copy()
            env.update(
                {
                    "GIT_AUTHOR_NAME": "Translation Audit Test",
                    "GIT_AUTHOR_EMAIL": "audit@example.com",
                    "GIT_COMMITTER_NAME": "Translation Audit Test",
                    "GIT_COMMITTER_EMAIL": "audit@example.com",
                }
            )
            subprocess.run(
                ["git", "init", "--quiet"], cwd=root, env=env, check=True
            )
            subprocess.run(["git", "add", "."], cwd=root, env=env, check=True)
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "fixture"],
                cwd=root,
                env=env,
                check=True,
            )
            subprocess.run(
                [
                    "git",
                    "update-ref",
                    "refs/remotes/origin/translations",
                    "HEAD",
                ],
                cwd=root,
                env=env,
                check=True,
            )
            shutil.rmtree(root / "i18n")

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "audit_translations.py"),
                    "--repo-root",
                    str(root),
                    "--lang",
                    "zh",
                ],
                cwd=root,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr + completed.stdout)
            self.assertIn("source=git ref origin/translations", completed.stdout)
            self.assertIn("PASS: translation audit clean", completed.stdout)
            self.assertFalse((root / "i18n").exists())

    def test_cli_returns_nonzero_and_lists_local_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_valid_tree(root)
            write(root / TARGET_REL, "plain English only\n")

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "audit_translations.py"),
                    "--repo-root",
                    str(root),
                    "--lang",
                    "zh",
                    "--translation-root",
                    str(root),
                ],
                cwd=ROOT,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )

            self.assertEqual(completed.returncode, 1)
            self.assertIn("[translation-no-han]", completed.stdout)
            self.assertIn("[structure-headings]", completed.stdout)
            self.assertIn("errors:", completed.stdout)


if __name__ == "__main__":
    unittest.main()
