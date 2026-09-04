#!/usr/bin/env python3
"""Regression checks for the translation registry and workflow publisher."""

from __future__ import annotations

import json
import os
import re
import shlex
import stat
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

from build_readme_i18n import render
from readme_translations import HERO2, TRANSLATIONS


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "translate.yml"
CURRICULUM_WORKFLOW = ROOT / ".github" / "workflows" / "curriculum.yml"
LANGUAGES = ROOT / "languages.json"
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


def publish_script() -> str:
    return step_script(PUBLISH_STEP)


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

                codes.append(language["code"])
                if language.get("source") is True:
                    sources.append(language)

        self.assertEqual(len(codes), len(set(codes)), "language codes must be unique")
        self.assertEqual(len(sources), 1, "exactly one source language is required")
        self.assertFalse(
            sources[0].get("ci", False),
            "the source language must not enter the translation matrix",
        )

    def test_default_translation_matrix_fits_github_limit(self) -> None:
        registry = json.loads(LANGUAGES.read_text(encoding="utf-8"))
        enabled = [
            language["code"]
            for language in registry["languages"]
            if language.get("ci") is True
        ]
        phases = [
            path.name
            for path in (ROOT / "phases").iterdir()
            if path.is_dir() and re.fullmatch(r"[0-9]{2}-[a-z0-9-]+", path.name)
        ]
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

    def test_trigger_and_manual_scope_remain_phase_only(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn('- "phases/**/docs/en.md"', workflow)
        self.assertIn('- "languages.json"', workflow)
        self.assertIn('- ".github/workflows/translate.yml"', workflow)
        self.assertIn("REQUESTED_PHASE: ${{ github.event.inputs.phase }}", workflow)
        self.assertIn("grep -Fqx -- \"$REQUESTED_PHASE\"", workflow)
        self.assertNotIn("certifications/", workflow)

    def test_manual_phase_rejects_traversal_that_resolves_to_a_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "phases/01-math-foundations").mkdir(parents=True)
            (root / "phases/02-ml-foundations").mkdir()
            (root / "languages.json").write_text(
                '{"languages":[{"code":"fr","ci":true}]}\n', encoding="utf-8"
            )
            output = root / "github-output"
            env = os.environ.copy()
            env.update(
                {
                    "REQUESTED": "fr",
                    "REQUESTED_PHASE": "01-math-foundations/../02-ml-foundations",
                    "GITHUB_OUTPUT": str(output),
                }
            )
            result = run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                step_script(PREPARE_STEP),
                cwd=root,
                env=env,
                capture=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unknown phase", result.stderr)

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


if __name__ == "__main__":
    unittest.main()
