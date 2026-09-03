#!/usr/bin/env python3
"""Regression checks for the translation registry and workflow publisher."""

from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import tempfile
import textwrap
import time
import unittest
from pathlib import Path

from build_readme_i18n import render
from readme_translations import HERO2, TRANSLATIONS


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "translate.yml"
CURRICULUM_WORKFLOW = ROOT / ".github" / "workflows" / "curriculum.yml"
LANGUAGES = ROOT / "languages.json"
PREPARE_STEP = "      - id: set"
LANGUAGE_CODE = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
TRANSLATION_TARGET_STEP = "      - name: Enforce the translation publication boundary"
CONFIGURE_REMOTE_STEP = "      - name: Configure translation publication remote"
RESTORE_STEP = "      - name: Restore this language's cache + output from configured branch"
PUBLISH_STEP = "      - name: Publish this phase slice to configured branch (race-safe)"
CLEANUP_STEP = "      - name: Prune deleted translation artifacts (race-safe)"
CURRICULUM_AUDIT_STEP = "      - name: audit published Simplified Chinese lessons"
TEST_REPOSITORY = "example/curriculum"
TEST_TRANSLATION_REF = "localized-content"


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


def workflow_step_script(workflow: Path, marker: str) -> str:
    lines = workflow.read_text(encoding="utf-8").splitlines()
    start = lines.index(marker)
    run_line = next(i for i in range(start, len(lines)) if lines[i] == "        run: |")
    body: list[str] = []
    for line in lines[run_line + 1 :]:
        if line and not line.startswith("          "):
            break
        body.append(line[10:] if line else "")
    return textwrap.dedent("\n".join(body))


def step_script(marker: str) -> str:
    return workflow_step_script(WORKFLOW, marker)


def publish_script() -> str:
    return step_script(PUBLISH_STEP)


def cleanup_script() -> str:
    return step_script(CLEANUP_STEP)


def source_key(phase: str, lesson: str) -> str:
    return f"phases/{phase}/{lesson}/docs/en.md"


def source_doc(source: Path, phase: str, lesson: str) -> Path:
    return source / source_key(phase, lesson)


def translated_doc(source: Path, lang: str, phase: str, lesson: str) -> Path:
    return source / f"i18n/{lang}/phases/{phase}/{lesson}/docs/{lang}.md"


def cache_record(marker: str) -> dict[str, str]:
    return {
        "source_sha256": marker * 64,
        "output_sha256": marker * 64,
        "provider": "nllb",
    }


def write_cache(path: Path, entries: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, sort_keys=True) + "\n", encoding="utf-8")


def create_publisher_fixture(root: Path) -> tuple[Path, Path, Path]:
    source = root / "source"
    origin = root / "origin.git"
    remote = root / "translation.git"
    runner_temp = root / "runner"
    source.mkdir()
    runner_temp.mkdir()

    run("git", "init", "--bare", "--initial-branch=main", str(origin), cwd=root)
    run("git", "init", "--bare", "--initial-branch=main", str(remote), cwd=root)
    run("git", "init", "--initial-branch=main", cwd=source)
    run("git", "config", "user.name", "test", cwd=source)
    run("git", "config", "user.email", "test@example.com", cwd=source)
    (source / ".gitignore").write_text(
        "i18n/*/phases/\ni18n/*/.cache/\n", encoding="utf-8"
    )
    (source / "README.md").write_text("English source\n", encoding="utf-8")
    (source / "languages.json").write_text(
        '{"languages":['
        '{"code":"en","source":true},'
        '{"code":"fr","ci":true},'
        '{"code":"de","ci":false},'
        '{"code":"zh","manual":true},'
        '{"code":"xx","ci":false}'
        ']}\n',
        encoding="utf-8",
    )
    canonical_lessons = {
        "01-foundations": ("01-kept", "02-deleted"),
        "01-deleted": ("01-old",),
        "02-active": ("01-active",),
    }
    for phase, lessons in canonical_lessons.items():
        for lesson in lessons:
            canonical_doc = source_doc(source, phase, lesson)
            canonical_doc.parent.mkdir(parents=True, exist_ok=True)
            canonical_doc.write_text(f"# {phase} / {lesson}\n", encoding="utf-8")
    run(
        "git",
        "add",
        ".gitignore",
        "README.md",
        "languages.json",
        "phases",
        cwd=source,
    )
    run("git", "commit", "-m", "initial", cwd=source)
    run("git", "remote", "add", "origin", str(origin), cwd=source)
    run("git", "push", "origin", "main", cwd=source)

    translated = translated_doc(source, "fr", "01-foundations", "01-kept")
    translated.parent.mkdir(parents=True)
    translated.write_text("traduit\n", encoding="utf-8")
    cache = source / "i18n/fr/.cache/01-foundations.json"
    write_cache(cache, {source_key("01-foundations", "01-kept"): cache_record("a")})
    return source, remote, runner_temp


def publisher_env(remote: Path, runner_temp: Path) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "GH_TOKEN": "test",
            "GITHUB_REPOSITORY": TEST_REPOSITORY,
            "AIFS_TRANSLATION_REPOSITORY": TEST_REPOSITORY,
            "AIFS_TRANSLATION_REF": TEST_TRANSLATION_REF,
            "LANG_CODE": "fr",
            "PHASE": "01-foundations",
            "RUNNER_TEMP": str(runner_temp),
            "TRANSLATION_TEST_REMOTE_URL": str(remote),
            "TRANSLATION_PUBLISH_RETRY_DELAY": "0",
        }
    )
    return env


def configure_translation_remote(source: Path, env: dict[str, str]) -> None:
    run(
        "bash",
        "-euo",
        "pipefail",
        "-c",
        step_script(CONFIGURE_REMOTE_STEP),
        cwd=source,
        env=env,
    )


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

    def test_curriculum_rejects_invalid_translation_ref_before_remote_access(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            call_log = root / "git-calls"
            real_git = shutil.which("git")
            self.assertIsNotNone(real_git)
            fake_git = fake_bin / "git"
            fake_git.write_text(
                "#!/bin/sh\n"
                "printf '%s\\n' \"$*\" >> \"$GIT_CALL_LOG\"\n"
                'if [ "$1" = check-ref-format ]; then\n'
                f"  exec {shlex.quote(real_git)} \"$@\"\n"
                "fi\n"
                "exit 97\n",
                encoding="utf-8",
            )
            fake_git.chmod(fake_git.stat().st_mode | stat.S_IXUSR)
            env = os.environ.copy()
            env.update(
                {
                    "AIFS_TRANSLATION_REPOSITORY": TEST_REPOSITORY,
                    "AIFS_TRANSLATION_REF": "../not-a-branch",
                    "GIT_CALL_LOG": str(call_log),
                    "PATH": str(fake_bin) + os.pathsep + env["PATH"],
                }
            )

            result = run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                workflow_step_script(CURRICULUM_WORKFLOW, CURRICULUM_AUDIT_STEP),
                cwd=ROOT,
                env=env,
                capture=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            calls = call_log.read_text(encoding="utf-8")
            self.assertIn("check-ref-format", calls)
            self.assertNotIn("ls-remote", calls)
            self.assertNotIn("fetch", calls)

    def test_third_party_actions_are_pinned_to_commit_shas(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        actions = re.findall(r"^\s*uses:\s+(actions/[^@\s]+)@([^#\s]+)", workflow, re.M)

        self.assertTrue(actions)
        for action, revision in actions:
            with self.subTest(action=action):
                self.assertRegex(revision, r"^[0-9a-f]{40}$")

    def test_write_token_is_not_persisted_in_translation_remote(self) -> None:
        configure = step_script(CONFIGURE_REMOTE_STEP)
        publish = publish_script()
        workflow = WORKFLOW.read_text(encoding="utf-8")
        before_publish = workflow[: workflow.index(PUBLISH_STEP)]

        self.assertNotIn("GH_TOKEN", configure)
        self.assertNotIn("x-access-token", configure)
        self.assertNotIn("${{ github.token }}", before_publish)
        self.assertIn("GH_TOKEN: ${{ github.token }}", workflow[workflow.index(PUBLISH_STEP):])
        self.assertIn("http.https://github.com/.extraheader", publish)
        self.assertNotIn("remote set-url", publish)
        self.assertNotIn("pushurl", publish)
        self.assertNotIn("credential.helper", publish)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run("git", "init", cwd=root)
            env = os.environ.copy()
            env.update(
                {
                    "AIFS_TRANSLATION_REPOSITORY": TEST_REPOSITORY,
                    "GH_TOKEN": "credential-canary",
                }
            )
            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                configure,
                cwd=root,
                env=env,
            )
            config = (root / ".git/config").read_text(encoding="utf-8")
            remote = run(
                "git",
                "remote",
                "get-url",
                "aifs-translations",
                cwd=root,
                capture=True,
            ).stdout.strip()

            self.assertEqual(
                remote, f"https://github.com/{TEST_REPOSITORY}.git"
            )
            self.assertNotIn("credential-canary", config)
            self.assertNotIn("x-access-token", config)

    def test_trigger_and_manual_scope_remain_phase_only(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn('- "phases/**/docs/en.md"', workflow)
        self.assertIn('- "languages.json"', workflow)
        self.assertIn('- "scripts/translate_lessons.py"', workflow)
        self.assertIn('- "scripts/audit_translations.py"', workflow)
        self.assertIn('- ".github/translate-requirements.txt"', workflow)
        self.assertIn('- ".github/workflows/translate.yml"', workflow)
        self.assertIn("REQUESTED_PHASE: ${{ github.event.inputs.phase }}", workflow)
        self.assertIn("grep -Fqx -- \"$REQUESTED_PHASE\"", workflow)
        self.assertNotIn("certifications/", workflow)
        self.assertIn("python3 scripts/audit_translations.py", workflow)
        self.assertIn('--phase "$PHASE"', workflow)
        self.assertIn("--translation-root .", workflow)

    def test_publication_uses_the_site_and_audit_translation_source(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        configure = step_script(CONFIGURE_REMOTE_STEP)
        restore = step_script(RESTORE_STEP)
        publish = publish_script()

        self.assertIn(
            "AIFS_TRANSLATION_REPOSITORY: "
            "${{ vars.AIFS_TRANSLATION_REPOSITORY || github.repository }}",
            workflow,
        )
        self.assertIn(
            "AIFS_TRANSLATION_REF: ${{ vars.AIFS_TRANSLATION_REF || 'translations' }}",
            workflow,
        )
        self.assertIn(
            "if: needs.prepare.outputs.publish_enabled == 'true'", workflow
        )
        self.assertIn("${AIFS_TRANSLATION_REPOSITORY}.git", configure)
        self.assertIn('TRANSLATION_REMOTE_REF="refs/heads/$AIFS_TRANSLATION_REF"', restore)
        self.assertIn("aifs-translations", restore)
        self.assertIn('TRANSLATION_REMOTE_REF="refs/heads/$AIFS_TRANSLATION_REF"', publish)
        self.assertIn("aifs-translations", publish)
        self.assertNotIn("origin/translations", restore + publish)
        self.assertNotIn("refs/heads/translations", restore + publish)
        self.assertNotIn("git fetch origin", restore + publish)
        self.assertNotIn("git push origin", publish)

    def test_external_translation_repository_explicitly_disables_publication(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "github-output"
            env = os.environ.copy()
            env.update(
                {
                    "AIFS_TRANSLATION_REPOSITORY": "example/shared-translations",
                    "AIFS_TRANSLATION_REF": TEST_TRANSLATION_REF,
                    "GITHUB_REPOSITORY": TEST_REPOSITORY,
                    "GITHUB_OUTPUT": str(output),
                }
            )

            result = run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                step_script(TRANSLATION_TARGET_STEP),
                cwd=ROOT,
                env=env,
                capture=True,
            )

            self.assertIn("publish_enabled=false", output.read_text(encoding="utf-8"))
            self.assertIn("external read-only source", result.stdout)

    def test_current_repository_enables_publication_and_rejects_invalid_ref(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output = root / "github-output"
            env = os.environ.copy()
            env.update(
                {
                    "AIFS_TRANSLATION_REPOSITORY": TEST_REPOSITORY,
                    "AIFS_TRANSLATION_REF": TEST_TRANSLATION_REF,
                    "GITHUB_REPOSITORY": TEST_REPOSITORY,
                    "GITHUB_OUTPUT": str(output),
                }
            )

            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                step_script(TRANSLATION_TARGET_STEP),
                cwd=ROOT,
                env=env,
            )
            self.assertIn("publish_enabled=true", output.read_text(encoding="utf-8"))

            for invalid_ref in ("", "../not-a-branch", "refs/heads/other", "-bad", "@"):
                with self.subTest(invalid_ref=invalid_ref):
                    env["AIFS_TRANSLATION_REF"] = invalid_ref
                    result = run(
                        "bash",
                        "-euo",
                        "pipefail",
                        "-c",
                        step_script(TRANSLATION_TARGET_STEP),
                        cwd=ROOT,
                        env=env,
                        capture=True,
                        check=False,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(
                        "AIFS_TRANSLATION_REF must name a branch", result.stdout
                    )

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

    def test_manual_language_cannot_enter_machine_translation_matrix(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "languages.json").write_text(
                '{"languages":['
                '{"code":"zh","manual":true},'
                '{"code":"fr","ci":true}'
                ']}\n',
                encoding="utf-8",
            )
            output = root / "github-output"
            env = os.environ.copy()
            env.update(
                {
                    "REQUESTED": "zh",
                    "REQUESTED_PHASE": "",
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
            self.assertIn("no machine-managed languages selected", result.stderr)

    def test_requested_languages_keep_only_machine_managed_entries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "phases/01-foundations").mkdir(parents=True)
            (root / "languages.json").write_text(
                '{"languages":['
                '{"code":"zh","manual":true},'
                '{"code":"fr","ci":true}'
                ']}\n',
                encoding="utf-8",
            )
            output = root / "github-output"
            env = os.environ.copy()
            env.update(
                {
                    "REQUESTED": "zh fr",
                    "REQUESTED_PHASE": "01-foundations",
                    "GITHUB_OUTPUT": str(output),
                }
            )

            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                step_script(PREPARE_STEP),
                cwd=root,
                env=env,
            )

            self.assertIn('langs=["fr"]', output.read_text(encoding="utf-8"))

    def test_publisher_uses_retryable_detached_worktree(self) -> None:
        script = publish_script()
        self.assertIn('git worktree remove --force "$PUBLISH_DIR"', script)
        self.assertIn('git worktree add --detach "$PUBLISH_DIR" "$BASE"', script)
        self.assertIn("BASE=$TRANSLATION_TRACKING_REF", script)
        self.assertIn("BASE=HEAD", script)
        self.assertIn(
            'git push aifs-translations "HEAD:${TRANSLATION_REMOTE_REF}"', script
        )
        self.assertIn("if ! git add -f", script)
        self.assertIn("if ! git commit", script)
        self.assertIn("if ! git push", script)
        self.assertNotIn("worktree add --force -B translations", script)

    def test_cleanup_is_not_multiplied_into_the_translation_matrix(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        cleanup_job = workflow.index("  cleanup:")
        cleanup_step = workflow.index(CLEANUP_STEP)

        self.assertLess(cleanup_job, cleanup_step)
        self.assertNotIn(
            "matrix:",
            workflow[cleanup_job:cleanup_step],
            "phase deletion cleanup must remain one job, not consume matrix slots",
        )
        self.assertIn("needs: [prepare, translate]", workflow[cleanup_job:cleanup_step])

    def test_deleted_phase_cleanup_preserves_concurrent_phase_publish(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, remote, runner_temp = create_publisher_fixture(root)
            env = publisher_env(remote, runner_temp)
            configure_translation_remote(source, env)

            # Seed two machine-managed locales and a manual locale with an old
            # phase. Once canonical main deletes it, every non-source locale is
            # pruned; the active phase must survive a publication racing cleanup.
            for lang in ("en", "fr", "de", "zh", "xx"):
                stale_slice = translated_doc(source, lang, "01-deleted", "01-old")
                stale_slice.parent.mkdir(parents=True, exist_ok=True)
                stale_slice.write_text(f"old {lang}\n", encoding="utf-8")
                stale_cache = source / f"i18n/{lang}/.cache/01-deleted.json"
                write_cache(
                    stale_cache,
                    {source_key("01-deleted", "01-old"): cache_record("b")},
                )

            active_slice = translated_doc(source, "fr", "02-active", "01-active")
            active_slice.parent.mkdir(parents=True, exist_ok=True)
            active_slice.write_text("active v1\n", encoding="utf-8")
            active_cache = source / "i18n/fr/.cache/02-active.json"
            active_key = source_key("02-active", "01-active")
            write_cache(active_cache, {active_key: cache_record("c")})
            retired_readme = source / "i18n/xx/README.md"
            retired_readme.write_text("hand-authored\n", encoding="utf-8")

            seed_env = env.copy()
            seed_env["PHASE"] = "01-deleted"
            for lang in ("en", "fr", "de", "zh", "xx"):
                seed_env["LANG_CODE"] = lang
                run(
                    "bash",
                    "-euo",
                    "pipefail",
                    "-c",
                    publish_script(),
                    cwd=source,
                    env=seed_env,
                )
            retired_seed = root / "retired-locale-seed"
            run(
                "git",
                "clone",
                "--branch",
                TEST_TRANSLATION_REF,
                str(remote),
                str(retired_seed),
                cwd=root,
            )
            run("git", "config", "user.name", "test", cwd=retired_seed)
            run(
                "git",
                "config",
                "user.email",
                "test@example.com",
                cwd=retired_seed,
            )
            retired_remote_readme = retired_seed / "i18n/xx/README.md"
            retired_remote_readme.parent.mkdir(parents=True, exist_ok=True)
            retired_remote_readme.write_text("hand-authored\n", encoding="utf-8")
            run("git", "add", "i18n/xx/README.md", cwd=retired_seed)
            run("git", "commit", "-m", "seed retired locale README", cwd=retired_seed)
            run("git", "push", "origin", TEST_TRANSLATION_REF, cwd=retired_seed)
            seed_env.update({"LANG_CODE": "fr", "PHASE": "02-active"})
            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                publish_script(),
                cwd=source,
                env=seed_env,
            )

            registry = json.loads(
                (source / "languages.json").read_text(encoding="utf-8")
            )
            registry["languages"] = [
                language
                for language in registry["languages"]
                if language["code"] != "xx"
            ]
            (source / "languages.json").write_text(
                json.dumps(registry) + "\n", encoding="utf-8"
            )
            shutil.rmtree(source / "phases/01-deleted")
            run(
                "git",
                "add",
                "-u",
                "--",
                "languages.json",
                "phases/01-deleted",
                cwd=source,
            )
            run(
                "git",
                "commit",
                "-m",
                "delete canonical phase and locale",
                cwd=source,
            )
            run("git", "push", "origin", "main", cwd=source)

            # Delay cleanup's first push after it has read the publication
            # branch. Publishing v2 then forces cleanup to retry from the new
            # remote tip instead of overwriting the concurrent slice update.
            cleanup_ready = root / "cleanup-ready"
            release_cleanup = root / "release-cleanup"
            cleanup_once = remote / "delay-cleanup-once"
            cleanup_once.touch()
            hook = remote / "hooks/pre-receive"
            hook.write_text(
                "#!/bin/sh\n"
                "read old new ref\n"
                f"if [ -f {shlex.quote(str(cleanup_once))} ] && "
                "git diff-tree --no-commit-id --name-only -r \"$new\" "
                "| grep -q 'i18n/fr/phases/01-deleted'; then\n"
                f"  rm {shlex.quote(str(cleanup_once))}\n"
                f"  touch {shlex.quote(str(cleanup_ready))}\n"
                f"  while [ ! -f {shlex.quote(str(release_cleanup))} ]; do sleep 0.05; done\n"
                "fi\n",
                encoding="utf-8",
            )
            hook.chmod(hook.stat().st_mode | stat.S_IXUSR)

            cleanup_env = env.copy()
            cleanup_env["RUNNER_TEMP"] = str(root / "cleanup-runner")
            Path(cleanup_env["RUNNER_TEMP"]).mkdir()
            cleaner = subprocess.Popen(
                ["bash", "-euo", "pipefail", "-c", cleanup_script()],
                cwd=source,
                env=cleanup_env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                deadline = time.monotonic() + 5
                while not cleanup_ready.exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(cleanup_ready.exists(), "cleanup never reached its first push")

                active_slice.write_text("active v2\n", encoding="utf-8")
                active_v2_cache = {active_key: cache_record("d")}
                write_cache(active_cache, active_v2_cache)
                publisher_runner = root / "publisher-runner"
                publisher_runner.mkdir()
                publish_env = env.copy()
                publish_env.update(
                    {
                        "LANG_CODE": "fr",
                        "PHASE": "02-active",
                        "RUNNER_TEMP": str(publisher_runner),
                    }
                )
                run(
                    "bash",
                    "-euo",
                    "pipefail",
                    "-c",
                    publish_script(),
                    cwd=source,
                    env=publish_env,
                )
                release_cleanup.touch()
                stdout, stderr = cleaner.communicate(timeout=10)
                self.assertEqual(cleaner.returncode, 0, stdout + stderr)
                self.assertIn("cleanup push race, retrying", stdout)
            finally:
                release_cleanup.touch()
                if cleaner.poll() is None:
                    cleaner.kill()
                    cleaner.communicate()

            tree = run(
                "git",
                f"--git-dir={remote}",
                "ls-tree",
                "-r",
                "--name-only",
                TEST_TRANSLATION_REF,
                cwd=root,
                capture=True,
            ).stdout.splitlines()
            for lang in ("fr", "de", "zh"):
                self.assertNotIn(
                    f"i18n/{lang}/phases/01-deleted/01-old/docs/{lang}.md", tree
                )
                self.assertNotIn(f"i18n/{lang}/.cache/01-deleted.json", tree)
            self.assertFalse(any(path.startswith("i18n/xx/phases/") for path in tree))
            self.assertFalse(any(path.startswith("i18n/xx/.cache/") for path in tree))
            self.assertIn("i18n/xx/README.md", tree)
            self.assertIn("i18n/en/phases/01-deleted/01-old/docs/en.md", tree)
            self.assertIn("i18n/en/.cache/01-deleted.json", tree)
            self.assertIn("i18n/fr/phases/02-active/01-active/docs/fr.md", tree)
            self.assertIn("i18n/fr/.cache/02-active.json", tree)
            published = run(
                "git",
                f"--git-dir={remote}",
                "show",
                f"{TEST_TRANSLATION_REF}:i18n/fr/phases/02-active/01-active/docs/fr.md",
                cwd=root,
                capture=True,
            )
            self.assertEqual(published.stdout, "active v2\n")
            published_cache = run(
                "git",
                f"--git-dir={remote}",
                "show",
                f"{TEST_TRANSLATION_REF}:i18n/fr/.cache/02-active.json",
                cwd=root,
                capture=True,
            )
            self.assertEqual(json.loads(published_cache.stdout), active_v2_cache)

    def test_cleanup_prunes_deleted_lesson_and_combined_cache_for_manual_locale(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, remote, runner_temp = create_publisher_fixture(root)
            env = publisher_env(remote, runner_temp)
            configure_translation_remote(source, env)

            phase = "01-foundations"
            kept_key = source_key(phase, "01-kept")
            deleted_key = source_key(phase, "02-deleted")
            manual_kept = translated_doc(source, "zh", phase, "01-kept")
            manual_deleted = translated_doc(source, "zh", phase, "02-deleted")
            for path, content in (
                (manual_kept, "保留\n"),
                (manual_deleted, "删除\n"),
            ):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            write_cache(
                source / f"i18n/zh/.cache/{phase}.json",
                {kept_key: cache_record("a"), deleted_key: cache_record("b")},
            )
            write_cache(
                source / "i18n/zh/.translate-cache.json",
                {
                    kept_key: cache_record("a"),
                    deleted_key: cache_record("b"),
                    source_key("99-gone", "01-old"): cache_record("c"),
                },
            )
            legacy_kept = translated_doc(source, "de", phase, "01-kept")
            legacy_deleted = translated_doc(source, "de", phase, "02-deleted")
            for path, content in (
                (legacy_kept, "Behalten\n"),
                (legacy_deleted, "Löschen\n"),
            ):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            write_cache(
                source / "i18n/de/.translate-cache.json",
                {kept_key: cache_record("d"), deleted_key: cache_record("e")},
            )

            publish_env = env.copy()
            publish_env.update({"LANG_CODE": "zh", "PHASE": phase})
            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                publish_script(),
                cwd=source,
                env=publish_env,
            )
            # The slice publisher intentionally excludes the legacy combined
            # cache, so seed it into the real publication branch explicitly.
            seed = root / "combined-cache-seed"
            run("git", "clone", "--branch", TEST_TRANSLATION_REF, str(remote), str(seed), cwd=root)
            run("git", "config", "user.name", "test", cwd=seed)
            run("git", "config", "user.email", "test@example.com", cwd=seed)
            for lang in ("zh", "de"):
                combined = seed / f"i18n/{lang}/.translate-cache.json"
                combined.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source / f"i18n/{lang}/.translate-cache.json", combined)
            for path, content in (
                (
                    seed / "i18n/de/phases/01-foundations/01-kept/docs/de.md",
                    "Behalten\n",
                ),
                (
                    seed / "i18n/de/phases/01-foundations/02-deleted/docs/de.md",
                    "Löschen\n",
                ),
            ):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            run("git", "add", "-f", "i18n/zh", "i18n/de", cwd=seed)
            run(
                "git",
                "commit",
                "-m",
                "seed sharded and legacy-only combined caches",
                cwd=seed,
            )
            run("git", "push", "origin", TEST_TRANSLATION_REF, cwd=seed)

            shutil.rmtree(source / f"phases/{phase}/02-deleted")
            run(
                "git",
                "add",
                "-u",
                "--",
                f"phases/{phase}/02-deleted",
                cwd=source,
            )
            run("git", "commit", "-m", "delete one canonical lesson", cwd=source)

            cleanup_env = env.copy()
            cleanup_env["RUNNER_TEMP"] = str(root / "cleanup-runner")
            Path(cleanup_env["RUNNER_TEMP"]).mkdir()
            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                cleanup_script(),
                cwd=source,
                env=cleanup_env,
            )

            tree = run(
                "git",
                f"--git-dir={remote}",
                "ls-tree",
                "-r",
                "--name-only",
                TEST_TRANSLATION_REF,
                cwd=root,
                capture=True,
            ).stdout.splitlines()
            self.assertIn("i18n/zh/phases/01-foundations/01-kept/docs/zh.md", tree)
            self.assertNotIn(
                "i18n/zh/phases/01-foundations/02-deleted/docs/zh.md", tree
            )
            phase_cache = run(
                "git",
                f"--git-dir={remote}",
                "show",
                f"{TEST_TRANSLATION_REF}:i18n/zh/.cache/{phase}.json",
                cwd=root,
                capture=True,
            )
            self.assertEqual(list(json.loads(phase_cache.stdout)), [kept_key])
            combined_cache = run(
                "git",
                f"--git-dir={remote}",
                "cat-file",
                "-e",
                f"{TEST_TRANSLATION_REF}:i18n/zh/.translate-cache.json",
                cwd=root,
                check=False,
            )
            self.assertNotEqual(combined_cache.returncode, 0)
            legacy_cache = run(
                "git",
                f"--git-dir={remote}",
                "show",
                f"{TEST_TRANSLATION_REF}:i18n/de/.translate-cache.json",
                cwd=root,
                capture=True,
            )
            self.assertEqual(list(json.loads(legacy_cache.stdout)), [kept_key])

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
            env = publisher_env(remote, runner_temp)
            configure_translation_remote(source, env)

            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                publish_script(),
                cwd=source,
                env=env,
            )

            published = run(
                "git",
                f"--git-dir={remote}",
                "show",
                f"{TEST_TRANSLATION_REF}:i18n/fr/phases/01-foundations/01-kept/docs/fr.md",
                cwd=root,
                capture=True,
            )
            self.assertEqual(published.stdout, "traduit\n")
            published_cache = run(
                "git",
                f"--git-dir={remote}",
                "show",
                f"{TEST_TRANSLATION_REF}:i18n/fr/.cache/01-foundations.json",
                cwd=root,
                capture=True,
            )
            self.assertEqual(
                json.loads(published_cache.stdout),
                {source_key("01-foundations", "01-kept"): cache_record("a")},
            )
            default_branch = run(
                "git",
                f"--git-dir={remote}",
                "show-ref",
                "--verify",
                "--quiet",
                "refs/heads/translations",
                cwd=root,
                check=False,
            )
            self.assertNotEqual(default_branch.returncode, 0)

            translated = translated_doc(
                source, "fr", "01-foundations", "01-kept"
            )
            translated.write_text("stale local copy\n", encoding="utf-8")
            run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                step_script(RESTORE_STEP),
                cwd=source,
                env=env,
            )
            self.assertEqual(translated.read_text(encoding="utf-8"), "traduit\n")
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
            env = publisher_env(remote, runner_temp)
            configure_translation_remote(source, env)

            result = run(
                "bash",
                "-euo",
                "pipefail",
                "-c",
                publish_script(),
                cwd=source,
                env=env,
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
                f"refs/heads/{TEST_TRANSLATION_REF}",
                cwd=root,
                check=False,
            )
            self.assertNotEqual(branch.returncode, 0)


if __name__ == "__main__":
    unittest.main()
