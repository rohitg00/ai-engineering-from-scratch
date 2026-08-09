#!/usr/bin/env python3
"""Regression checks for the phase-only translation workflow publisher."""

from __future__ import annotations

import os
import shlex
import stat
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "translate.yml"
PREPARE_STEP = "      - id: set"
PUBLISH_STEP = "      - name: Publish this phase slice to translations branch (race-safe)"


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
