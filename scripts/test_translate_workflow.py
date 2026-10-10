#!/usr/bin/env python3
"""Regression checks for the translation registry, leg selection, and workflow publisher."""

from __future__ import annotations

import ast
import copy
import json
import os
import re
import shlex
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from build_readme_i18n import render
from readme_translations import HERO2, TRANSLATIONS
import translate_matrix


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "translate.yml"
CURRICULUM_WORKFLOW = ROOT / ".github" / "workflows" / "curriculum.yml"
LANGUAGES = ROOT / "languages.json"
SELECTOR = ROOT / "scripts" / "translate_matrix.py"
PREPARE_STEP = "      - id: set"
PUBLISH_STEP = "      - name: Publish this phase slice to translations branch (race-safe)"
LANGUAGE_CODE = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")


def run(
    *args: str,
    cwd: Path,
    env: dict[str, str] | None = None,
    capture: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        env=env,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.PIPE if capture else subprocess.DEVNULL,
    )


def step_script(marker: str) -> str:
    lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
    start = lines.index(marker)
    run_line = next(i for i in range(start, len(lines)) if lines[i] == "        run: |")
    body: list[str] = []
    for line in lines[run_line + 1 :]:
        if line and not line.startswith("          "):
            break
        body.append(line[10:] if line else "")
    return textwrap.dedent("\n".join(body))


def job_block(name: str) -> str:
    text = WORKFLOW.read_text(encoding="utf-8")
    start = text.index(f"\n  {name}:\n")
    following = re.search(r"\n  [a-z][a-z-]*:\n", text[start + 1 :])
    return text[start : start + 1 + following.start()] if following else text[start:]


def publish_script() -> str:
    return step_script(PUBLISH_STEP)


def select(cwd: Path, **values: str) -> tuple[subprocess.CompletedProcess[str], dict]:
    env = os.environ.copy()
    for name in ("EVENT", "REQUESTED", "REQUESTED_PHASE", "BEFORE", "AFTER", "FORCED"):
        env[name] = values.get(name.lower(), "")
    result = run(sys.executable, str(SELECTOR), cwd=cwd, env=env, capture=True, check=False)
    outputs = {}
    for line in result.stdout.splitlines():
        key, value = line.split("=", 1)
        outputs[key] = json.loads(value)
    return result, outputs


def legs(outputs: dict) -> list[tuple[str, str]]:
    return [(leg["lang"], leg["phase"]) for leg in outputs["lessons"]]


def lesson_langs(outputs: dict) -> list[str]:
    return list(dict.fromkeys(leg["lang"] for leg in outputs["lessons"]))


def local_imports(script: Path) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(ast.parse(script.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module.split(".")[0])
    return {f"scripts/{name}.py" for name in names if (ROOT / "scripts" / f"{name}.py").is_file()}


def create_publisher_fixture(root: Path) -> tuple[Path, Path, Path]:
    source = root / "source"
    remote = root / "remote.git"
    runner_temp = root / "runner"
    source.mkdir()
    runner_temp.mkdir()

    run("git", "init", "--bare", "--initial-branch=main", str(remote), cwd=root)
    run("git", "init", "--initial-branch=main", cwd=source)
    run("git", "config", "user.name", "test", cwd=source)
    run("git", "config", "user.email", "test@example.com", cwd=source)
    (source / ".gitignore").write_text(
        "i18n/*/phases/\ni18n/*/.cache/\n", encoding="utf-8"
    )
    (source / "README.md").write_text("English source\n", encoding="utf-8")
    run("git", "add", ".gitignore", "README.md", cwd=source)
    run("git", "commit", "-m", "initial", cwd=source)
    run("git", "remote", "add", "origin", str(remote), cwd=source)
    run("git", "push", "origin", "main", cwd=source)

    translated = source / "i18n/fr/phases/01-foundations/lesson.md"
    translated.parent.mkdir(parents=True)
    translated.write_text("traduit\n", encoding="utf-8")
    cache = source / "i18n/fr/.cache/01-foundations.json"
    cache.parent.mkdir(parents=True)
    cache.write_text("{}\n", encoding="utf-8")
    return source, remote, runner_temp


def publisher_env(remote: Path, runner_temp: Path) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "GH_TOKEN": "test",
            "LANG_CODE": "fr",
            "PHASE": "01-foundations",
            "RUNNER_TEMP": str(runner_temp),
            "TRANSLATION_PUSH_URL": str(remote),
            "TRANSLATION_PUBLISH_RETRY_DELAY": "0",
        }
    )
    return env


FIXTURE_PHASES = ("01-alpha", "02-beta", "03-gamma")
FIXTURE_REGISTRY = {
    "_comment": "fixture registry",
    "languages": [
        {"code": "en", "name": "English", "native": "English", "nllb": "eng_Latn", "source": True},
        {"code": "fr", "name": "French", "native": "Français", "nllb": "fra_Latn", "ci": True},
        {"code": "de", "name": "German", "native": "Deutsch", "nllb": "deu_Latn", "ci": True},
        {"code": "zh-TW", "name": "Traditional Chinese", "native": "繁體中文", "nllb": "zho_Hant", "site": True},
        {"code": "ja", "name": "Japanese", "native": "日本語", "nllb": "jpn_Jpan"},
    ],
}
FIXTURE_UI = ["fr", "de", "zh-TW"]


class TranslateWorkflowContractTest(unittest.TestCase):
    def test_readme_exact_line_translations_skip_fenced_code(self) -> None:
        heading = "| Your goal | Learn on GitHub | Learn on the website |"
        source = f"```text\n{heading}\n```\n{heading}"
        rendered = render(source, "pt", TRANSLATIONS).splitlines()
        self.assertEqual(rendered[1], heading)
        self.assertEqual(rendered[3], "| Seu objetivo | Aprenda no GitHub | Aprenda no site |")

    def test_readme_hero_counts_match_the_canonical_curriculum(self) -> None:
        for language, translations in TRANSLATIONS.items():
            with self.subTest(language=language):
                hero = translations[HERO2]
                self.assertIn("523", hero)
                self.assertIn("342", hero)

    def test_german_hero_uses_the_masculine_skill_article(self) -> None:
        hero = TRANSLATIONS["de"][HERO2]
        self.assertIn("einen Skill", hero)
        self.assertNotIn("eine Skill", hero)

    def test_language_registry_contract(self) -> None:
        registry = json.loads(LANGUAGES.read_text(encoding="utf-8"))
        languages = registry.get("languages")
        self.assertIsInstance(languages, list)
        self.assertTrue(languages)

        codes: list[str] = []
        sources: list[dict[str, object]] = []
        for index, language in enumerate(languages):
            code = language.get("code") if isinstance(language, dict) else None
            with self.subTest(index=index, code=code):
                self.assertIsInstance(language, dict)
                for field in ("code", "name", "native", "nllb"):
                    self.assertIn(field, language)
                    self.assertIsInstance(language[field], str)
                    self.assertTrue(language[field].strip())
                self.assertRegex(language["code"], LANGUAGE_CODE)
                if "source" in language:
                    self.assertIsInstance(language["source"], bool)
                if "ci" in language:
                    self.assertIsInstance(language["ci"], bool)
                if "site" in language:
                    self.assertIsInstance(language["site"], bool)

                codes.append(language["code"])
                if language.get("source") is True:
                    sources.append(language)

        self.assertEqual(len(codes), len(set(codes)), "language codes must be unique")
        self.assertEqual(len(sources), 1, "exactly one source language is required")
        self.assertFalse(
            sources[0].get("ci", False),
            "the source language must not enter the translation matrix",
        )

    def prepare(self, requested="", registry=None, event="workflow_dispatch", requested_phase=""):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "phases/01-math-foundations").mkdir(parents=True)
            (root / "languages.json").write_text(
                json.dumps(registry) if registry else LANGUAGES.read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            return select(root, event=event, requested=requested, requested_phase=requested_phase)

    def test_default_matrices_separate_automatic_lessons_from_site_ui(self) -> None:
        result, outputs = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        langs = lesson_langs(outputs)
        self.assertIn("pt-BR", langs)
        self.assertIn("fa", langs)
        self.assertNotIn("zh-TW", langs)
        self.assertEqual(set(outputs["ui_langs"]), set(langs) | {"zh-TW"})
        self.assertNotIn("en", langs)
        self.assertNotIn("en", outputs["ui_langs"])
        self.assertEqual({phase for _, phase in legs(outputs)}, {"01-math-foundations"})
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("include: ${{ fromJSON(needs.prepare.outputs.lessons) }}", workflow)
        self.assertIn("lang: ${{ fromJSON(needs.prepare.outputs.ui_langs) }}", workflow)

    def test_manual_requests_allow_non_ci_languages_and_exclude_source_and_unknown(self) -> None:
        result, outputs = self.prepare("en pt-BR zh-TW pt-BR unknown ../../outside")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(lesson_langs(outputs), ["pt-BR", "zh-TW"])
        self.assertEqual(outputs["ui_langs"], ["pt-BR", "zh-TW"])

    def test_source_and_unknown_only_requests_fail_before_building_a_matrix(self) -> None:
        for requested in ("en", "unknown", "   "):
            with self.subTest(requested=requested):
                result, outputs = self.prepare(requested)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("no registered non-source languages", result.stderr)
                self.assertEqual(outputs, {})

    def test_empty_automatic_set_skips_instead_of_failing(self) -> None:
        registry = {"languages": [{"code": "en", "source": True}, {"code": "fr"}]}
        for event in ("push", "workflow_dispatch"):
            with self.subTest(event=event):
                result, outputs = self.prepare(registry=registry, event=event)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(outputs, {"lessons": [], "ui_langs": []})

    def test_source_never_enters_default_matrices_even_if_flagged(self) -> None:
        result, outputs = self.prepare(registry={"languages": [
            {"code": "en", "source": True, "ci": True, "site": True},
            {"code": "fa", "ci": True},
        ]})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(legs(outputs), [("fa", "01-math-foundations")])
        self.assertEqual(outputs["ui_langs"], ["fa"])

    def test_default_translation_matrix_fits_github_limit(self) -> None:
        registry = json.loads(LANGUAGES.read_text(encoding="utf-8"))["languages"]
        enabled, _ = translate_matrix.automatic(registry)
        phases = translate_matrix.phase_dirs(ROOT)
        self.assertTrue(enabled)
        self.assertTrue(phases)
        self.assertLessEqual(
            len(enabled) * len(phases),
            256,
            "GitHub Actions permits at most 256 jobs in one matrix",
        )

    def test_registry_changes_trigger_curriculum_checks(self) -> None:
        workflow = CURRICULUM_WORKFLOW.read_text(encoding="utf-8")
        self.assertEqual(workflow.count('- "languages.json"'), 2)
        self.assertEqual(workflow.count('- "scripts/translate_matrix.py"'), 2)

    def test_trigger_and_manual_scope_remain_phase_only(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn('- "phases/**/docs/en.md"', workflow)
        self.assertIn('- "languages.json"', workflow)
        self.assertIn('- ".github/workflows/translate.yml"', workflow)
        self.assertIn('- "scripts/translate_matrix.py"', workflow)
        self.assertIn("REQUESTED_PHASE: ${{ github.event.inputs.phase }}", workflow)
        self.assertNotIn("certifications/", workflow)

    def test_manual_phase_rejects_traversal_that_resolves_to_a_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "phases/01-math-foundations").mkdir(parents=True)
            (root / "phases/02-ml-foundations").mkdir()
            (root / "languages.json").write_text(
                '{"languages":[{"code":"fr","ci":true}]}\n', encoding="utf-8"
            )
            for phase in ("01-math-foundations/../02-ml-foundations", "phases", "99-missing"):
                with self.subTest(phase=phase):
                    result, outputs = select(
                        root, event="workflow_dispatch", requested="fr", requested_phase=phase
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("unknown phase", result.stderr)
                    self.assertEqual(outputs, {})
            result, outputs = select(
                root, event="workflow_dispatch", requested="fr", requested_phase="02-ml-foundations"
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(legs(outputs), [("fr", "02-ml-foundations")])

    def test_prepare_passes_the_event_only_through_env(self) -> None:
        script = step_script(PREPARE_STEP)
        self.assertNotIn("${{", script)
        self.assertIn('python3 scripts/translate_matrix.py >> "$GITHUB_OUTPUT"', script)
        prepare = job_block("prepare")
        for line in (
            "EVENT: ${{ github.event_name }}",
            "BEFORE: ${{ github.event.before }}",
            "AFTER: ${{ github.sha }}",
            "FORCED: ${{ github.event.forced }}",
            "persist-credentials: false",
            "contents: read",
        ):
            self.assertIn(line, prepare)
        self.assertNotIn("fetch-depth", prepare)
        self.assertNotIn("contents: write", prepare)

    def test_empty_matrices_skip_their_jobs(self) -> None:
        self.assertIn("    if: ${{ needs.prepare.outputs.lessons != '[]' }}\n", job_block("translate"))
        self.assertIn("    if: ${{ needs.prepare.outputs.ui_langs != '[]' }}\n", job_block("ui-strings"))
        self.assertIn(
            "    if: ${{ !cancelled() && needs.translate.result != 'skipped' }}\n",
            job_block("coverage"),
        )

    def test_full_run_sources_cover_everything_the_legs_execute(self) -> None:
        def closure(script: str) -> set[str]:
            reached: set[str] = set()
            pending = [script]
            while pending:
                path = pending.pop()
                if path not in reached:
                    reached.add(path)
                    pending.extend(local_imports(ROOT / path))
            return reached

        logic = translate_matrix.LOGIC_SOURCES
        ui = translate_matrix.UI_SOURCES
        self.assertLessEqual(closure("scripts/translate_lessons.py"), logic)
        self.assertLessEqual(closure("scripts/translate_ui_strings.py"), logic | ui)
        self.assertEqual(re.findall(r"python3 (scripts/[\w-]+\.py)", job_block("translate")), ["scripts/translate_lessons.py"])
        self.assertEqual(re.findall(r"python3 (scripts/[\w-]+\.py)", job_block("ui-strings")), ["scripts/translate_ui_strings.py"])
        self.assertEqual(re.findall(r"python3 (scripts/[\w-]+\.py)", job_block("prepare")), ["scripts/translate_matrix.py"])
        requirements = set(re.findall(r"pip install -r (\S+)", WORKFLOW.read_text(encoding="utf-8")))
        self.assertTrue(requirements)
        self.assertLessEqual(requirements, logic)
        self.assertIn(".github/workflows/translate.yml", logic)
        self.assertNotIn("scripts/translate_matrix.py", logic | ui)
        for path in logic | ui:
            self.assertTrue((ROOT / path).is_file(), path)

    def test_publisher_uses_retryable_detached_worktree(self) -> None:
        script = publish_script()
        self.assertIn('git worktree remove --force "$PUBLISH_DIR"', script)
        self.assertIn('git worktree add --detach "$PUBLISH_DIR" "$BASE"', script)
        self.assertIn("BASE=origin/translations", script)
        self.assertIn("BASE=HEAD", script)
        self.assertIn("git push origin HEAD:refs/heads/translations", script)
        self.assertIn("if ! git add -f", script)
        self.assertIn("if ! git commit", script)
        self.assertIn("if ! git push", script)
        self.assertNotIn("worktree add --force -B translations", script)

    def test_rejected_bootstrap_push_retries_and_cleans_registration(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, remote, runner_temp = create_publisher_fixture(root)

            reject_once = remote / "reject-once"
            reject_once.touch()
            hook = remote / "hooks/pre-receive"
            hook.write_text(
                "#!/bin/sh\n"
                f"if [ -f {shlex.quote(str(reject_once))} ]; then\n"
                f"  rm {shlex.quote(str(reject_once))}\n"
                "  echo 'intentional first-push rejection' >&2\n"
                "  exit 1\n"
                "fi\n",
                encoding="utf-8",
            )
            hook.chmod(hook.stat().st_mode | stat.S_IXUSR)

            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                publish_script(),
                cwd=source,
                env=publisher_env(remote, runner_temp),
            )

            published = run(
                "git",
                f"--git-dir={remote}",
                "show",
                "translations:i18n/fr/phases/01-foundations/lesson.md",
                cwd=root,
                capture=True,
            )
            self.assertEqual(published.stdout, "traduit\n")
            published_cache = run(
                "git",
                f"--git-dir={remote}",
                "show",
                "translations:i18n/fr/.cache/01-foundations.json",
                cwd=root,
                capture=True,
            )
            self.assertEqual(published_cache.stdout, "{}\n")
            worktrees = run("git", "worktree", "list", "--porcelain", cwd=source, capture=True)
            self.assertEqual(worktrees.stdout.count("worktree "), 1)
            self.assertFalse((runner_temp / "translation-publish").exists())

    def test_commit_failure_never_reports_publish_success(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, remote, runner_temp = create_publisher_fixture(root)
            hook = source / ".git/hooks/pre-commit"
            hook.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
            hook.chmod(hook.stat().st_mode | stat.S_IXUSR)

            result = run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                publish_script(),
                cwd=source,
                env=publisher_env(remote, runner_temp),
                capture=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("could not commit translation slice", result.stderr)
            self.assertIn("could not publish after retries", result.stderr)
            branch = run(
                "git",
                f"--git-dir={remote}",
                "show-ref",
                "--verify",
                "--quiet",
                "refs/heads/translations",
                cwd=root,
                check=False,
            )
            self.assertNotEqual(branch.returncode, 0)


class PushSelectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base_dir = Path(self.tmp.name)
        self.root = self.base_dir / "repo"
        self.root.mkdir()
        run("git", "init", "--initial-branch=main", cwd=self.root)
        run("git", "config", "user.name", "test", cwd=self.root)
        run("git", "config", "user.email", "test@example.com", cwd=self.root)
        self.write_registry(FIXTURE_REGISTRY)
        for phase in FIXTURE_PHASES:
            self.write(f"phases/{phase}/01-first/docs/en.md", f"# {phase} first\n")
            self.write(f"phases/{phase}/01-first/code/main.py", "print('hello')\n")
        for path in sorted(translate_matrix.LOGIC_SOURCES | translate_matrix.UI_SOURCES):
            self.write(path, "original\n")
        self.base = self.commit()

    def write(self, path: str, text: str) -> None:
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

    def write_registry(self, registry: dict) -> None:
        self.write("languages.json", json.dumps(registry, ensure_ascii=False, indent=2) + "\n")

    def registry_with(self, code: str, **fields) -> dict:
        registry = copy.deepcopy(FIXTURE_REGISTRY)
        for language in registry["languages"]:
            if language["code"] == code:
                language.update(fields)
        return registry

    def commit(self) -> str:
        run("git", "add", "-A", cwd=self.root)
        run("git", "commit", "--allow-empty", "-m", "change", cwd=self.root)
        return run("git", "rev-parse", "HEAD", cwd=self.root, capture=True).stdout.strip()

    def push(self, before: str | None = None, forced: str = "false", cwd: Path | None = None):
        after = run("git", "rev-parse", "HEAD", cwd=self.root, capture=True).stdout.strip()
        result, outputs = select(
            cwd or self.root,
            event="push",
            before=self.base if before is None else before,
            after=after,
            forced=forced,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sorted(outputs), ["lessons", "ui_langs"])
        return outputs, result.stderr

    def every_leg(self) -> list[tuple[str, str]]:
        return [(lang, phase) for lang in ("fr", "de") for phase in FIXTURE_PHASES]

    def test_one_lesson_runs_its_phase_for_each_automatic_language(self) -> None:
        self.write("phases/02-beta/01-first/docs/en.md", "# changed\n")
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(legs(outputs), [("fr", "02-beta"), ("de", "02-beta")])
        self.assertEqual(outputs["ui_langs"], [])

    def test_unrelated_files_and_selector_changes_select_nothing(self) -> None:
        self.write("phases/02-beta/01-first/code/main.py", "print('changed')\n")
        self.write("phases/02-beta/01-first/docs/notes.md", "notes\n")
        self.write("scripts/translate_matrix.py", "changed\n")
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(outputs, {"lessons": [], "ui_langs": []})

    def test_registry_metadata_changes_select_nothing(self) -> None:
        registry = self.registry_with("fr", dir="ltr", locale="fr_FR", native="Francais")
        registry["_comment"] = "a longer explanation"
        registry["languages"][3]["dir"] = "ltr"
        self.write_registry(registry)
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(outputs, {"lessons": [], "ui_langs": []})

    def test_removing_a_language_from_ci_selects_nothing(self) -> None:
        self.write_registry(self.registry_with("de", ci=False))
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(outputs, {"lessons": [], "ui_langs": []})

    def test_newly_automatic_language_runs_every_phase_and_its_interface(self) -> None:
        self.write_registry(self.registry_with("ja", ci=True))
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(legs(outputs), [("ja", phase) for phase in FIXTURE_PHASES])
        self.assertEqual(outputs["ui_langs"], ["ja"])

    def test_site_language_promoted_to_ci_runs_lessons_but_keeps_its_interface(self) -> None:
        self.write_registry(self.registry_with("zh-TW", ci=True))
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(legs(outputs), [("zh-TW", phase) for phase in FIXTURE_PHASES])
        self.assertEqual(outputs["ui_langs"], [])

    def test_newly_listed_site_language_runs_only_its_interface(self) -> None:
        registry = copy.deepcopy(FIXTURE_REGISTRY)
        registry["languages"].append(
            {"code": "ko", "name": "Korean", "native": "한국어", "nllb": "kor_Hang", "site": True}
        )
        self.write_registry(registry)
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(outputs, {"lessons": [], "ui_langs": ["ko"]})

    def test_interface_sources_run_every_interface_language(self) -> None:
        for path in sorted(translate_matrix.UI_SOURCES):
            with self.subTest(path=path):
                self.base = self.commit()
                self.write(path, f"changed {path}\n")
                self.commit()
                outputs, _ = self.push()
                self.assertEqual(outputs, {"lessons": [], "ui_langs": FIXTURE_UI})

    def test_translation_code_changes_run_every_leg(self) -> None:
        for path in sorted(translate_matrix.LOGIC_SOURCES):
            with self.subTest(path=path):
                self.base = self.commit()
                self.write(path, f"changed {path}\n")
                self.commit()
                outputs, log = self.push()
                self.assertEqual(legs(outputs), self.every_leg())
                self.assertEqual(outputs["ui_langs"], FIXTURE_UI)
                self.assertIn(path, log)

    def test_lessons_and_new_language_merge_without_duplicates(self) -> None:
        self.write("phases/03-gamma/01-first/docs/en.md", "# changed\n")
        self.write_registry(self.registry_with("ja", ci=True))
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(
            legs(outputs),
            [("fr", "03-gamma"), ("de", "03-gamma")] + [("ja", phase) for phase in FIXTURE_PHASES],
        )
        self.assertEqual(outputs["ui_langs"], ["ja"])

    def test_moved_lesson_runs_both_phases_and_a_removed_phase_runs_none(self) -> None:
        run("git", "mv", "phases/01-alpha/01-first", "phases/02-beta/02-moved", cwd=self.root)
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(
            legs(outputs),
            [("fr", "01-alpha"), ("fr", "02-beta"), ("de", "01-alpha"), ("de", "02-beta")],
        )
        self.base = self.commit()
        run("git", "rm", "-r", "-q", "phases/03-gamma", cwd=self.root)
        self.commit()
        outputs, _ = self.push()
        self.assertEqual(outputs, {"lessons": [], "ui_langs": []})

    def test_multi_commit_push_diffs_the_whole_range(self) -> None:
        self.write("phases/01-alpha/01-first/docs/en.md", "# first edit\n")
        self.commit()
        self.write("phases/03-gamma/01-first/docs/en.md", "# second edit\n")
        self.commit()
        outputs, _ = self.push()
        self.assertEqual({phase for _, phase in legs(outputs)}, {"01-alpha", "03-gamma"})

    def test_unreadable_ranges_run_every_leg(self) -> None:
        self.write("phases/02-beta/01-first/docs/en.md", "# changed\n")
        self.commit()
        marker = self.base_dir / "injected"
        cases = {
            "new branch": ("0" * 40, "false"),
            "force-push": (self.base, "true"),
            "unknown commit": ("1" * 40, "false"),
            "empty": ("", "false"),
            "option-shaped": (f"--upload-pack=touch {marker}", "false"),
        }
        for name, (before, forced) in cases.items():
            with self.subTest(case=name):
                outputs, log = self.push(before=before, forced=forced)
                self.assertEqual(legs(outputs), self.every_leg())
                self.assertEqual(outputs["ui_langs"], FIXTURE_UI)
                self.assertIn("every leg runs", log)
        self.assertFalse(marker.exists())

    def test_unreadable_previous_registry_runs_every_leg(self) -> None:
        self.write("languages.json", "{not json\n")
        self.base = self.commit()
        self.write_registry(FIXTURE_REGISTRY)
        self.commit()
        outputs, log = self.push()
        self.assertEqual(legs(outputs), self.every_leg())
        self.assertIn("cannot be read", log)

    def test_shallow_checkout_fetches_the_previous_commit(self) -> None:
        self.write("phases/02-beta/01-first/docs/en.md", "# changed\n")
        self.commit()
        origin = self.base_dir / "origin.git"
        shallow = self.base_dir / "shallow"
        run("git", "clone", "--bare", str(self.root), str(origin), cwd=self.base_dir)
        run("git", "clone", "--depth=1", f"file://{origin}", str(shallow), cwd=self.base_dir)
        missing = run("git", "cat-file", "-e", f"{self.base}^{{commit}}", cwd=shallow, check=False)
        self.assertNotEqual(missing.returncode, 0)
        outputs, _ = self.push(cwd=shallow)
        self.assertEqual(legs(outputs), [("fr", "02-beta"), ("de", "02-beta")])
        fetched = run("git", "cat-file", "-e", f"{self.base}^{{commit}}", cwd=shallow, check=False)
        self.assertEqual(fetched.returncode, 0)


if __name__ == "__main__":
    unittest.main()
