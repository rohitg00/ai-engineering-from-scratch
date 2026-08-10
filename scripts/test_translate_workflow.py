#!/usr/bin/env python3
"""Regression checks for scoped lesson translation and its workflow publisher."""

from __future__ import annotations

import importlib.util
import io
import os
import shlex
import stat
import subprocess
import tempfile
import textwrap
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "translate.yml"
PREPARE_STEP = "      - id: set"
PUBLISH_STEP = "      - name: Publish this translation slice (race-safe)"
TRANSLATOR_PATH = ROOT / "scripts" / "translate_lessons.py"
TRANSLATOR_SPEC = importlib.util.spec_from_file_location("translate_lessons_under_test", TRANSLATOR_PATH)
assert TRANSLATOR_SPEC and TRANSLATOR_SPEC.loader
TRANSLATOR = importlib.util.module_from_spec(TRANSLATOR_SPEC)
TRANSLATOR_SPEC.loader.exec_module(TRANSLATOR)


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


def create_publisher_fixture(root: Path, *, certification: bool = False) -> tuple[Path, Path, Path]:
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
        "i18n/*/phases/\ni18n/*/certifications/\ni18n/*/.cache/\n", encoding="utf-8"
    )
    (source / "README.md").write_text("English source\n", encoding="utf-8")
    run("git", "add", ".gitignore", "README.md", cwd=source)
    run("git", "commit", "-m", "initial", cwd=source)
    run("git", "remote", "add", "origin", str(remote), cwd=source)
    run("git", "push", "origin", "main", cwd=source)

    translated = source / (
        "i18n/fr/certifications/claude/lessons/01-api/docs/fr.md"
        if certification else "i18n/fr/phases/01-foundations/lesson.md"
    )
    translated.parent.mkdir(parents=True)
    translated.write_text("traduit\n", encoding="utf-8")
    cache_name = "certifications-claude.json" if certification else "01-foundations.json"
    cache = source / f"i18n/fr/.cache/{cache_name}"
    cache.parent.mkdir(parents=True)
    cache.write_text("{}\n", encoding="utf-8")
    return source, remote, runner_temp


def publisher_env(
    remote: Path, runner_temp: Path, *, certification: bool = False
) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "GH_TOKEN": "test",
            "LANG_CODE": "fr",
            "SCOPE": "certifications/claude" if certification else "core",
            "SHARD": "claude" if certification else "01-foundations",
            "RUNNER_TEMP": str(runner_temp),
            "TRANSLATION_PUSH_URL": str(remote),
            "TRANSLATION_PUBLISH_RETRY_DELAY": "0",
        }
    )
    return env


class TranslateWorkflowContractTest(unittest.TestCase):
    def test_reviewed_russian_targets_are_gated_before_publication(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("scripts/audit_ru_translations.py", workflow)
        self.assertIn("i18n/ru/.quality/manifest.json", workflow)
        self.assertIn("refusing to bootstrap Russian NLLB", workflow)
        script = publish_script()
        self.assertIn('if [ "$LANG_CODE" = ru ]', script)
        self.assertIn("Russian publication candidate has no quality manifest", script)
        self.assertIn('python3 "$AUDIT_SCRIPT" --root .', script)
        self.assertLess(script.index('python3 "$AUDIT_SCRIPT" --root .'), script.index("git push origin"))

    def test_reviewed_target_gate_detects_stale_and_tampered_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "ru.md"
            target.write_text("Проверенный перевод\n", encoding="utf-8")
            target_sha = TRANSLATOR.hashlib.sha256(target.read_bytes()).hexdigest()
            item = {
                "status": "approved",
                "source_sha256": "source-v1",
                "target_sha256": target_sha,
            }
            self.assertEqual(
                TRANSLATOR.reviewed_target_state(item, "source-v1", target), "current"
            )
            self.assertEqual(
                TRANSLATOR.reviewed_target_state(item, "source-v2", target), "stale"
            )
            target.write_text("Подмена\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "target SHA-256"):
                TRANSLATOR.reviewed_target_state(item, "source-v1", target)

    def test_real_gitignore_excludes_generated_certification_outputs(self) -> None:
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("i18n/*/certifications/", ignore.splitlines())

    def test_orphaned_certification_output_and_cache_entry_are_pruned(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            out = root / "i18n"
            current = root / "certifications/claude/lessons/01/docs/en.md"
            current.parent.mkdir(parents=True)
            current.write_text("current\n", encoding="utf-8")
            orphan = out / "ru/certifications/claude/lessons/99/docs/ru.md"
            orphan.parent.mkdir(parents=True)
            orphan.write_text("orphan\n", encoding="utf-8")
            cache = {
                "certifications/claude/lessons/01/docs/en.md": "ok",
                "certifications/claude/lessons/99/docs/en.md": "stale",
            }
            with mock.patch.object(TRANSLATOR, "ROOT", root), mock.patch.object(TRANSLATOR, "OUT_ROOT", out):
                removed = TRANSLATOR.prune_orphans(
                    docs=[current], lang="ru", scope="certifications/claude",
                    phase=None, cache=cache, dry_run=False,
                )
            self.assertEqual(2, removed)
            self.assertFalse(orphan.exists())
            self.assertNotIn("certifications/claude/lessons/99/docs/en.md", cache)

    def test_trigger_and_matrix_cover_core_and_claude_certifications(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn('- "phases/**/docs/en.md"', workflow)
        self.assertIn('- "certifications/claude/lessons/**/docs/en.md"', workflow)
        self.assertIn('- "languages.json"', workflow)
        self.assertIn('- ".github/workflows/translate.yml"', workflow)
        self.assertIn("REQUESTED_PHASE: ${{ github.event.inputs.phase }}", workflow)
        self.assertIn("REQUESTED_SCOPE: ${{ github.event.inputs.scope }}", workflow)
        self.assertIn("grep -Fqx -- \"$REQUESTED_PHASE\"", workflow)
        self.assertIn("--scope certifications/claude", workflow)
        self.assertIn("matrix.slice.scope", workflow)

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

    def test_certification_publisher_uses_an_independent_slice_and_cache(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, remote, runner_temp = create_publisher_fixture(root, certification=True)
            run(
                "bash", "-euo", "pipefail", "-c", publish_script(), cwd=source,
                env=publisher_env(remote, runner_temp, certification=True),
            )
            translated = run(
                "git", f"--git-dir={remote}", "show",
                "translations:i18n/fr/certifications/claude/lessons/01-api/docs/fr.md",
                cwd=root, capture=True,
            )
            self.assertEqual(translated.stdout, "traduit\n")
            cache = run(
                "git", f"--git-dir={remote}", "show",
                "translations:i18n/fr/.cache/certifications-claude.json",
                cwd=root, capture=True,
            )
            self.assertEqual(cache.stdout, "{}\n")

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


class TranslateCliScopeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.patchers = [
            mock.patch.object(TRANSLATOR, "ROOT", self.root),
            mock.patch.object(TRANSLATOR, "PHASES", self.root / "phases"),
            mock.patch.object(
                TRANSLATOR, "CERTIFICATION_LESSONS", self.root / "certifications/claude/lessons"
            ),
            mock.patch.object(TRANSLATOR, "OUT_ROOT", self.root / "i18n"),
        ]
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self) -> None:
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.temporary.cleanup()

    def write_source(self, path: str, text: str = "# English\n") -> Path:
        source = self.root / path
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(text, encoding="utf-8")
        return source

    def invoke(self, *args: str) -> tuple[int, str, str]:
        stdout, stderr = io.StringIO(), io.StringIO()
        argv = [str(TRANSLATOR_PATH), "--lang", "ru", "--provider", "echo", *args]
        with mock.patch.object(TRANSLATOR.sys, "argv", argv), redirect_stdout(stdout), redirect_stderr(stderr):
            try:
                TRANSLATOR.main()
            except SystemExit as error:
                code = error.code if isinstance(error.code, int) else 1
            else:
                code = 0
        return code, stdout.getvalue(), stderr.getvalue()

    def test_default_core_scope_is_unchanged(self) -> None:
        phase = self.write_source("phases/01-foundations/01-intro/docs/en.md")
        cert = self.write_source("certifications/claude/lessons/01-api/docs/en.md")
        code, output, error = self.invoke()
        self.assertEqual(code, 0, error)
        self.assertTrue(TRANSLATOR.out_path(phase, "ru").is_file())
        self.assertFalse(TRANSLATOR.out_path(cert, "ru").exists())
        self.assertIn("phases/01-foundations/01-intro/docs/en.md", output)

    def test_certification_scope_uses_contract_target_and_separate_cache(self) -> None:
        source = self.write_source("certifications/claude/lessons/01-api/docs/en.md")
        code, output, error = self.invoke("--scope", "certifications/claude")
        self.assertEqual(code, 0, error)
        target = self.root / "i18n/ru/certifications/claude/lessons/01-api/docs/ru.md"
        self.assertEqual(target.read_text(encoding="utf-8"), source.read_text(encoding="utf-8"))
        self.assertIn("certifications/claude/lessons/01-api/docs/en.md", output)
        self.assertTrue((self.root / "i18n/ru/.cache/certifications-claude.json").is_file())

    def test_certification_only_accepts_exact_safe_lesson_paths(self) -> None:
        self.write_source("certifications/claude/lessons/01-api/docs/en.md")
        valid, output, _ = self.invoke(
            "--scope", "certifications/claude", "--only", "certifications/claude/lessons/01-api"
        )
        self.assertEqual(valid, 0)
        self.assertIn("01-api/docs/en.md", output)
        for unsafe in (
            "certifications/claude/lessons/01-api/../01-api",
            "/certifications/claude/lessons/01-api",
            "phases/01-foundations/01-intro",
            "certifications/claude/lessons/not-present",
        ):
            with self.subTest(unsafe=unsafe):
                code, _, error = self.invoke(
                    "--scope", "certifications/claude", "--only", unsafe, "--dry-run"
                )
                self.assertNotEqual(code, 0)
                self.assertIn("invalid --only", error)

    def test_cache_invalidates_on_source_change(self) -> None:
        source = self.write_source("certifications/claude/lessons/01-api/docs/en.md")
        self.assertIn("1 translated", self.invoke("--scope", "certifications/claude")[1])
        self.assertIn("1 unchanged", self.invoke("--scope", "certifications/claude")[1])
        source.write_text("# Changed\n", encoding="utf-8")
        self.assertIn("1 translated", self.invoke("--scope", "certifications/claude")[1])

    def test_dry_run_writes_neither_target_nor_cache(self) -> None:
        self.write_source("certifications/claude/lessons/01-api/docs/en.md")
        code, output, error = self.invoke("--scope", "certifications/claude", "--dry-run")
        self.assertEqual(code, 0, error)
        self.assertIn("would translate", output)
        self.assertFalse((self.root / "i18n").exists())

    def test_current_source_is_a_dry_run_cache_hit(self) -> None:
        self.write_source("certifications/claude/lessons/01-api/docs/en.md")
        self.assertEqual(self.invoke("--scope", "certifications/claude")[0], 0)
        cache = self.root / "i18n/ru/.cache/certifications-claude.json"
        before = cache.read_bytes()
        code, output, error = self.invoke("--scope", "certifications/claude", "--dry-run")
        self.assertEqual(code, 0, error)
        self.assertIn("0 translated, 1 unchanged", output)
        self.assertNotIn("would translate", output)
        self.assertEqual(cache.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
